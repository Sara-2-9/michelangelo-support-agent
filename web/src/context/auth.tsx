/**
 * Auth state — Phase 5.3.
 *
 * Every visitor gets an ANONYMOUS Supabase session automatically on first
 * load (zero friction): the JWT identifies them across reloads, so the
 * conversation history survives. Optionally the user can "claim" the
 * account with an email magic link, turning the anonymous identity into a
 * permanent one WITHOUT losing history (same user id).
 *
 * The JWT is sent to the Worker as `Authorization: Bearer <token>`;
 * the Worker verifies it against Supabase Auth before any DB write.
 */

import { createContext, use, useEffect, useState, type PropsWithChildren } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthContextValue {
  /** Null until the initial session bootstrap completes. */
  session: Session | null;
  userId: string | null;
  ready: boolean;
  isAnonymous: boolean;
  /**
   * Sends a magic link for the given email. If the current anonymous account
   * has no email yet, the link CLAIMS it (same user id, history preserved).
   * If the email already belongs to a past account, the link LOGS INTO it.
   */
  claimEmail: (email: string) => Promise<string | null>;
  /**
   * Google sign-in. For anonymous users it LINKS the Google identity to the
   * current account (same user id, history preserved); if that Google
   * account is already registered, falls back to a plain OAuth login.
   * The flow redirects the whole page to Google and back.
   */
  signInWithGoogle: () => Promise<string | null>;
  /** Signs out and starts a fresh anonymous session (new identity, new history). */
  resetIdentity: () => Promise<void>;
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
    // OAuth callback errors come back IN THE URL (after the Google redirect
    // round-trip), so a client-side try/catch can never see them. Both
    // error codes mean "this Google identity already belongs to an
    // existing account" (email_exists: email match on first linking;
    // identity_already_exists: the Google identity got linked to that
    // account by a previous successful login). The right move is a plain
    // Google LOGIN into that account — exactly like the email flow's OTP
    // fallback. Clean the URL first so a refresh does not retrigger.
    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get("error_code");
    if (errorCode === "email_exists" || errorCode === "identity_already_exists") {
      window.history.replaceState(null, "", window.location.pathname);
      supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      return;
    }

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

  async function claimEmail(email: string): Promise<string | null> {
    // emailRedirectTo: where the magic link lands after the click. Using the
    // CURRENT origin means localhost:5173 in dev and the workers.dev URL in
    // production — both must be allow-listed in Supabase → Authentication →
    // URL Configuration → Redirect URLs (the default Site URL localhost:3000
    // would otherwise send production users to a dead page).
    const emailRedirectTo = window.location.origin;
    // updateUser on an anonymous account keeps the same user id and sends
    // a verification link — history stays attached to the identity.
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo });
    if (!error) return null;
    // The email already belongs to a previously claimed account (e.g. the
    // user signed out and got a fresh anonymous identity): fall back to a
    // magic-link LOGIN into that existing account instead of claiming again.
    if (error.message.toLowerCase().includes("already been registered")) {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo },
      });
      return otpError ? otpError.message : null;
    }
    return error.message;
  }

  async function signInWithGoogle(): Promise<string | null> {
    const redirectTo = window.location.origin;
    if (session?.user.is_anonymous) {
      // linkIdentity upgrades the ANONYMOUS account: same user id, so the
      // conversation history survives. If Google was used before (identity
      // belongs to an older account), fall back to a plain OAuth login.
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo },
      });
      if (!error) return null;
      if (!error.message.toLowerCase().includes("already linked")) {
        return error.message;
      }
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    return error ? error.message : null;
  }

  async function resetIdentity() {
    await supabase.auth.signOut();
    await supabase.auth.signInAnonymously();
  }

  const value: AuthContextValue = {
    session,
    userId: session?.user.id ?? null,
    ready,
    isAnonymous: session?.user.is_anonymous ?? true,
    claimEmail,
    signInWithGoogle,
    resetIdentity,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
