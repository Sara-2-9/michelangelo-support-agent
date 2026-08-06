/**
 * /auth — email sign-in page (restyle step 2, Figma mockup 2).
 *
 * Anonymous visitors enter their email to receive a magic link. Behind the
 * scenes `claimEmail` handles both cases: first time → the link claims the
 * anonymous account (history preserved); email already registered → the
 * link logs into the existing account.
 *
 * Visual: black page, centered gradient card, dark input, black button —
 * as per the mockup. Signed-in users see their email + Sign out instead.
 */

import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/auth";

export default function AuthPage() {
  const { ready, isAnonymous, session, claimEmail, resetIdentity } = useAuth();
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
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
              {state === "error" && <p className="m-0 text-sm font-medium text-red-900">{error}</p>}
            </form>
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
