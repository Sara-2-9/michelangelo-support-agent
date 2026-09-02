/**
 * Anonymous-session setup — creates ONE anonymous Supabase session and
 * saves it to e2e/.auth/anon.json, reused by the desktop/mobile projects
 * as their storage state.
 *
 * Why: without this, every test context bootstraps its own anonymous
 * sign-in. Under full-suite parallelism that is a burst of signups
 * against Supabase Auth (rate-limit risk — it actually hit the production
 * hourly cap during development) and a bootstrap-remount race per test.
 * One shared session makes the suites fast and deterministic — and
 * mirrors a real returning visitor. Works in both modes: the session
 * comes from the env of the active mode (loadWebEnv).
 */

import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadWebEnv } from "./env";

const STATE_PATH = "e2e/.auth/anon.json";

setup("create a shared anonymous session", async ({ page, context }) => {
  const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = loadWebEnv();

  const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.session) {
    throw new Error(`Anonymous sign-in failed: ${error?.message ?? "no session"}`);
  }

  const ref = new URL(VITE_SUPABASE_URL).hostname.split(".")[0];
  await page.goto("/");
  await page.evaluate(
    ([key, session]) => localStorage.setItem(key, JSON.stringify(session)),
    [`sb-${ref}-auth-token`, data.session] as const,
  );
  await page.reload();
  // The composer unlocks once the token is picked up.
  await expect(page.getByPlaceholder("Ask a question…")).toBeEnabled({ timeout: 15_000 });

  await context.storageState({ path: STATE_PATH });
});
