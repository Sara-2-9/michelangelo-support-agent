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
  /** Sends a magic link that converts the anonymous account into a permanent one. */
  claimEmail: (email: string) => Promise<string | null>;
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
    // updateUser on an anonymous account keeps the same user id and sends
    // a verification link — history stays attached to the identity.
    const { error } = await supabase.auth.updateUser({ email });
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
    resetIdentity,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
