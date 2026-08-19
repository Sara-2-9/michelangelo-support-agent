/**
 * Auth state — Phase 5.3, revised on branch `no-anon-history`.
 *
 * Every visitor gets an ANONYMOUS Supabase session automatically on first
 * load (zero friction): its only job is SECURITY PLUMBING — /api/chat
 * requires a valid JWT, so the LLM endpoint is never wide open, and every
 * request carries a user_id for rate limiting and abuse tracing.
 *
 * Anonymous conversations ARE persisted server-side (tagged with the
 * anonymous user_id, for quality/analytics) but are NEVER shown to the
 * visitor and NEVER merged into a future account: sign-in is always a
 * plain OAuth/OTP login into a SEPARATE user id — there is no account
 * claiming and no identity linking, so the anonymous and permanent
 * identities can never be associated by any code path.
 *
 * The JWT is sent to the Worker as `Authorization: Bearer <token>`;
 * the Worker verifies it against Supabase Auth before any DB write.
 */

import { createContext, use, useEffect, useState, type PropsWithChildren } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { deleteAccount as apiDeleteAccount } from "@/lib/api";

interface AuthContextValue {
  /** Null until the initial session bootstrap completes. */
  session: Session | null;
  userId: string | null;
  ready: boolean;
  isAnonymous: boolean;
  /**
   * Sends an email magic link. A new email creates a fresh account;
   * an already-registered email logs into the existing one. Anonymous
   * history is NOT carried over — sign-in starts a separate identity.
   */
  signInWithEmail: (email: string) => Promise<string | null>;
  /**
   * Google sign-in: always a plain OAuth login (single account selection —
   * no linkIdentity, no merge with the anonymous identity). The flow
   * redirects the whole page to Google and back.
   */
  signInWithGoogle: () => Promise<string | null>;
  /** Signs out and starts a fresh anonymous session (new identity, new history). */
  resetIdentity: () => Promise<void>;
  /**
   * Deletes the account server-side (history included, by DB cascade),
   * then starts a fresh anonymous session. Returns an error message or null.
   */
  deleteAccount: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = use(AuthContext);
  if (!value) {
    throw new Error("useAuth must be wrapped in an <AuthProvider />");
  }
  return value;
}

// React StrictMode mounts effects twice in dev — the bootstrap must be
// idempotent, or we would create two anonymous users per visit.
let bootstrapStarted = false;

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setReady(true);
    });

    if (!bootstrapStarted) {
      bootstrapStarted = true;
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) return supabase.auth.signInAnonymously();
      });
    }

    return () => subscription.unsubscribe();
  }, []);

  async function signInWithEmail(email: string): Promise<string | null> {
    // emailRedirectTo: where the magic link lands after the click. Using the
    // CURRENT origin means localhost:5173 in dev and the workers.dev URL in
    // production — both must be allow-listed in Supabase → Authentication →
    // URL Configuration → Redirect URLs (the default Site URL localhost:3000
    // would otherwise send production users to a dead page).
    // Plain OTP login: new emails get a fresh account, registered emails
    // log into the existing one. No claiming of the anonymous identity.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    return error ? error.message : null;
  }

  async function signInWithGoogle(): Promise<string | null> {
    // Always a plain OAuth login — never linkIdentity. This is what makes
    // the Google account chooser appear AT MOST ONCE: there is no failed
    // link attempt that would bounce the user back to Google for a second
    // selection, and the anonymous identity is never merged into anything.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    return error ? error.message : null;
  }

  async function resetIdentity() {
    await supabase.auth.signOut();
    await supabase.auth.signInAnonymously();
  }

  async function deleteAccount(): Promise<string | null> {
    const token = session?.access_token;
    if (!token) return "No active session";
    try {
      await apiDeleteAccount(token);
    } catch (err) {
      return err instanceof Error ? err.message : "Delete failed";
    }
    // The deleted session's JWT is now invalid: drop it and start clean.
    await resetIdentity();
    return null;
  }

  const value: AuthContextValue = {
    session,
    userId: session?.user.id ?? null,
    ready,
    isAnonymous: session?.user.is_anonymous ?? true,
    signInWithEmail,
    signInWithGoogle,
    resetIdentity,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
