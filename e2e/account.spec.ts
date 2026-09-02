/**
 * Suite F — self-service account deletion (GDPR erasure). Staging only.
 *
 * Each run creates a THROWAWAY user via the Admin API, signs it in through
 * the UI session mechanism, deletes the account from the account panel,
 * and then verifies server-side that the auth user is actually gone (the
 * FK cascade wipes its conversations/messages). If the UI flow fails
 * mid-test, afterEach still removes the user so staging stays clean.
 *
 * Runs in the desktop-chromium project (no saved session — it builds its
 * own throwaway one), never with the seeded user's storage state.
 */

import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadStagingWorkerEnv } from "./env";

test.skip(
  process.env.E2E_ENV !== "staging",
  "creates and deletes a real user — staging only (E2E_ENV=staging)",
);

let admin: SupabaseClient;
let disposableUserId: string | null = null;

test.beforeEach(async ({ page }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = loadStagingWorkerEnv();
  admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = `e2e-disposable-${Date.now()}@example.com`;
  const password = randomBytes(18).toString("hex");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Disposable user creation failed: ${error.message}`);
  disposableUserId = data.user.id;

  // Sign in via the API, then inject the session like the app's client
  // would store it (same mechanism as authed.setup.ts).
  const { data: signIn, error: signInError } = await admin.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw new Error(`Disposable sign-in failed: ${signInError.message}`);

  const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
  await page.addInitScript(() => localStorage.setItem("cookie-consent", "accepted"));
  await page.goto("/");
  await page.evaluate(
    ([key, session]) => localStorage.setItem(key, JSON.stringify(session)),
    [`sb-${ref}-auth-token`, signIn.session] as const,
  );
  await page.reload();
  test.info().annotations.push({ type: "disposable-user", description: email });
});

test.afterEach(async () => {
  // If the UI flow failed before deleting, don't litter staging.
  if (disposableUserId) {
    await admin.auth.admin.deleteUser(disposableUserId).catch(() => {});
    disposableUserId = null;
  }
});

test("Delete Account removes the user and returns to a fresh anonymous session", async ({
  page,
}) => {
  // Generous: the beforeEach (createUser + sign-in + reload) shares the
  // budget and runs while LLM-heavy suites hammer the same dev server.
  test.setTimeout(120_000);
  const userId = disposableUserId!;

  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByText(/e2e-disposable-/)).toBeVisible();

  await page.getByRole("button", { name: "Delete Account" }).click();

  // Irreversible → confirmation dialog first.
  const dialog = page.getByRole("alertdialog", { name: "Delete Account" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete Account" }).click();

  // The app lands on a FRESH anonymous session: empty state, and the
  // sidebar offers sign-in again instead of history.
  await expect(page.getByPlaceholder("Ask a question…")).toBeVisible();
  await page.getByRole("button", { name: "Open conversation history" }).click();
  await expect(page.getByText("Sign in to keep your chats")).toBeVisible();

  // Server-side proof: the auth user no longer exists.
  const { data, error } = await admin.auth.admin.getUserById(userId);
  expect(error ?? data.user).toBeTruthy(); // getUserById errors on missing users
  expect(data.user).toBeNull();
  disposableUserId = null; // already deleted by the app — skip afterEach cleanup
});
