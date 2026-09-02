/**
 * Auth setup (staging mode only) — signs in ONCE as the seeded test user
 * and saves the session to e2e/.auth/user.json, reused by every test in
 * the authed-chromium project (they start already signed in).
 *
 * The sign-in happens through the Supabase API, then the session is
 * injected into the browser's localStorage under the same key the app's
 * supabase-js client uses (sb-<project-ref>-auth-token). The UI login
 * flows themselves are covered by dedicated tests — this is just the
 * fast lane for the authenticated suites.
 */

import { test as setup, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadStagingWebEnv } from "./env";

const STATE_PATH = "e2e/.auth/user.json";

setup("authenticate as the seeded E2E test user", async ({ page, context }) => {
  const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = loadStagingWebEnv();

  let credentials: { email: string; password: string };
  try {
    credentials = JSON.parse(readFileSync("e2e/.auth/test-user.json", "utf-8"));
  } catch {
    throw new Error("e2e/.auth/test-user.json not found — run `npm run seed:test-user` first.");
  }

  const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  if (error) throw new Error(`Test user sign-in failed: ${error.message}`);

  // supabase-js v2 default storage key: sb-<project-ref>-auth-token
  const ref = new URL(VITE_SUPABASE_URL).hostname.split(".")[0];
  await page.goto("/");
  await page.evaluate(
    ([key, session]) => localStorage.setItem(key, JSON.stringify(session)),
    [`sb-${ref}-auth-token`, data.session] as const,
  );
  await page.reload();

  // Prove the session took: the account panel shows the test user's email.
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByText(credentials.email)).toBeVisible();
  await page.keyboard.press("Escape");

  await context.storageState({ path: STATE_PATH });
});
