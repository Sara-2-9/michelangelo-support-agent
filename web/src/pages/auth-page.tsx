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
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { faCircleNotch } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "@/context/auth";
import Button from "@/components/ui/button";

export default function AuthPage() {
  const { ready, isAnonymous, session, claimEmail, signInWithGoogle, resetIdentity } = useAuth();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [googleLoading, setGoogleLoading] = useState(false);
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
    if (googleLoading) return;
    // Immediate feedback: the OAuth redirect can take a moment to start,
    // and on error the page never left — the spinner must stop.
    setGoogleLoading(true);
    const err = await signInWithGoogle();
    // On success the page is already redirecting to Google — an error is
    // the only outcome worth rendering here.
    if (err) {
      setGoogleLoading(false);
      setState("error");
      setError(err);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm rounded-3xl bg-linear-to-br from-grad-blue via-grad-lilac to-grad-pink p-8 shadow-2xl">
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
                <Button type="submit" variant="dark" disabled={state === "sending" || googleLoading}>
                  {state === "sending" ? "Sending…" : "Email me a sign-in link"}
                </Button>
              </form>

              <div className="flex items-center gap-3" role="separator">
                <span className="h-px flex-1 bg-black/20" />
                <span className="text-[12px] font-medium text-black/60">or</span>
                <span className="h-px flex-1 bg-black/20" />
              </div>

              <Button
                onClick={handleGoogle}
                variant="light"
                icon={googleLoading ? faCircleNotch : faGoogle}
                iconSpin={googleLoading}
                disabled={googleLoading || state === "sending"}
              >
                {googleLoading ? "Redirecting to Google…" : "Continue with Google"}
              </Button>

              {state === "error" && <p className="m-0 text-sm font-medium text-red-900">{error}</p>}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="m-0 text-sm text-black/70">You are signed in as</p>
            <p className="m-0 font-semibold break-all text-black">{session?.user.email}</p>
            <Button onClick={resetIdentity} variant="dark">
              Sign out
            </Button>
          </div>
        )}
      </div>
      <Link to="/" className="mt-6 text-sm text-white/50 transition-colors hover:text-white">
        ← Back to chat
      </Link>
      <nav className="mt-3 flex gap-4 text-xs text-white/40">
        <Link to="/privacy" className="transition-colors hover:text-white">
          Privacy Policy
        </Link>
        <Link to="/terms" className="transition-colors hover:text-white">
          Terms of Service
        </Link>
      </nav>
    </div>
  );
}
