/**
 * /auth — sign-in page. Users choose their method:
 *
 *  1. EMAIL magic link — `claimEmail` claims the anonymous account the
 *     first time (history preserved) or logs into the existing account.
 *  2. GOOGLE OAuth — `signInWithGoogle` links the Google identity to the
 *     anonymous account when possible (history preserved), otherwise logs
 *     into the previously registered Google account.
 *
 * Visual: dark page, centered gradient card, dark input, black button —
 * as per the Figma mockup. Signed-in users see their email + Sign out.
 */

import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { useAuth } from "@/context/auth";

export default function AuthPage() {
  const { ready, isAnonymous, session, claimEmail, signInWithGoogle, resetIdentity } = useAuth();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || state === "sending") return;
    setState("sending");
    const err = await claimEmail(email.trim());
    setState(err ? "error" : "sent");
    setError(err);
  }

  async function handleGoogle() {
    const err = await signInWithGoogle();
    // On success the page is already redirecting to Google — an error is
    // the only outcome worth rendering here.
    if (err) {
      setState("error");
      setError(err);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm rounded-3xl bg-gradient-to-br from-grad-blue via-grad-lilac to-grad-pink p-8 shadow-2xl">
        {!ready ? (
          <p className="m-0 text-center text-black/70">Loading…</p>
        ) : isAnonymous ? (
          state === "sent" ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="m-0 text-lg font-semibold text-black">Check your inbox ✉️</p>
              <p className="m-0 text-sm text-black/70">
                We sent a sign-in link to <strong>{email}</strong>.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <h1 className="m-0 text-lg font-semibold text-black">Save your history:</h1>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="rounded-xl border border-border-ui bg-surface px-3.5 py-2.5 text-white placeholder:text-white/40 focus:border-white/70 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={state === "sending"}
                  className="rounded-xl bg-black px-3 py-2.5 font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
                >
                  {state === "sending" ? "Sending…" : "Email me a sign-in link"}
                </button>
              </form>

              <div className="flex items-center gap-3" role="separator">
                <span className="h-px flex-1 bg-black/20" />
                <span className="text-[12px] font-medium text-black/60">or</span>
                <span className="h-px flex-1 bg-black/20" />
              </div>

              <button
                onClick={handleGoogle}
                className="flex items-center justify-center gap-2.5 rounded-xl bg-white px-3 py-2.5 font-semibold text-black transition-opacity hover:opacity-85"
              >
                <FontAwesomeIcon icon={faGoogle} />
                Continue with Google
              </button>

              {state === "error" && <p className="m-0 text-sm font-medium text-red-900">{error}</p>}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="m-0 text-sm text-black/70">You are signed in as</p>
            <p className="m-0 font-semibold break-all text-black">{session?.user.email}</p>
            <button
              onClick={resetIdentity}
              className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
      <Link to="/" className="mt-6 text-sm text-white/50 transition-colors hover:text-white">
        ← Back to chat
      </Link>
    </div>
  );
}
