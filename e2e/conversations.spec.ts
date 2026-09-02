/**
 * Suite D — conversations for the signed-in test user (authed-chromium,
 * staging only): sidebar preview via the PostgREST embedded query,
 * persistence across reloads, public share links, deletion.
 *
 * Every question carries a unique `[e2e <timestamp>]` marker: conversation
 * previews repeat across runs, and unique markers keep selectors strict
 * without needing mid-run cleanups (parallel workers share the test user).
 */

import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadStagingWorkerEnv } from "./env";

// Serial + cleanup: the 3 tests share the seeded user's conversation
// list. Serial keeps them in ONE worker, so the afterAll purge cannot
// delete another test's row mid-flight.
test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  // Purge the seeded user's conversations so the sidebar never grows into
  // a scrollable list across runs (messages cascade via FK).
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = loadStagingWorkerEnv();
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  // Paginate: staging accumulates anonymous users from every run, so the
  // test user may fall beyond page 1 (same bug class as seed-test-user).
  for (let page = 1; ; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const user = data?.users.find((u) => u.email === "e2e.user@example.com");
    if (user) {
      await admin.from("conversations").delete().eq("user_id", user.id);
      break;
    }
    if (!data || data.users.length < 1000) break;
  }
});

const ANSWER_TIMEOUT = 90_000;

const composer = (page: Page) => page.getByPlaceholder("Ask a question…");
const unique = (q: string) => `${q} [e2e ${Date.now()} ${Math.random().toString(36).slice(2, 7)}]`;

async function askAndWait(page: Page, question: string) {
  // Enabled only once the session token exists (see chat.spec.ts).
  await expect(composer(page)).toBeEnabled({ timeout: 15_000 });
  await composer(page).fill(question);
  await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
  await composer(page).press("Enter");
  await expect(page.getByRole("button", { name: "Helpful", exact: true })).toBeVisible({
    timeout: ANSWER_TIMEOUT,
  });
}

/** The sidebar row whose preview starts with this question. */
function row(page: Page, question: string) {
  return page.locator("div.group", {
    has: page.getByRole("button", { name: previewRe(question) }),
  });
}

/** Preview buttons may visually truncate; match by regex substring. */
function previewRe(question: string) {
  return new RegExp(question.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

/**
 * Opens a row's ellipsis menu. The menu closes on list scroll (by design),
 * so we pre-scroll the row into view and let any scroll settle BEFORE
 * opening — otherwise Playwright's scroll-into-view on the ellipsis would
 * instantly close the menu it just opened.
 */
async function openRowMenu(page: Page, question: string) {
  const r = row(page, question);
  await r.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await r.getByRole("button", { name: "Conversation options" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("cookie-consent", "accepted"));
});

test("new conversation appears in the sidebar and survives a reload", async ({ page }) => {
  test.setTimeout(180_000);
  const question = unique("How do I connect my GitHub account?");
  await page.goto("/");

  await askAndWait(page, question);

  // Sidebar preview = beginning of the FIRST user message (one PostgREST
  // round trip with resource embedding).
  await page.getByRole("button", { name: "Open conversation history" }).click();
  await expect(row(page, question)).toBeVisible();

  // Registered users keep their history across reloads (unlike anonymous).
  await page.reload();
  await page.getByRole("button", { name: "Open conversation history" }).click();
  await row(page, question).getByRole("button", { name: previewRe(question) }).click();
  await expect(page.getByText(question)).toBeVisible();
  await expect(page.getByRole("button", { name: "Helpful", exact: true })).toBeVisible();
});

test("share creates a public read-only link viewable without an account", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(180_000);
  const question = unique("What is the maximum prompt length?");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");

  await askAndWait(page, question);

  await page.getByRole("button", { name: "Open conversation history" }).click();
  await openRowMenu(page, question);
  const shareItem = page.getByRole("menuitem", { name: "Share" });
  await expect(shareItem).toBeVisible();
  await shareItem.click();
  await expect(page.getByRole("menuitem", { name: "Link copied!" })).toBeVisible();

  const shareUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(shareUrl).toMatch(/\/share\/[0-9a-f-]{36}$/);

  // A visitor with NO session at all can read the shared conversation.
  const anonContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  const anonPage = await anonContext.newPage();
  await anonPage.goto(shareUrl);
  await expect(anonPage.getByRole("heading", { name: "Shared conversation" })).toBeVisible();
  await expect(anonPage.getByText("Read-only view")).toBeVisible();
  await expect(anonPage.getByText(question)).toBeVisible();
  // Shared messages carry no messageId → feedback buttons never render.
  await expect(anonPage.getByRole("button", { name: "Helpful", exact: true })).toHaveCount(0);
  await anonContext.close();
});

test("delete removes the conversation after a confirmation dialog", async ({ page }) => {
  test.setTimeout(180_000);
  const question = unique("How many images can I attach to a prompt?");
  await page.goto("/");

  await askAndWait(page, question);

  await page.getByRole("button", { name: "Open conversation history" }).click();
  await expect(row(page, question)).toBeVisible();

  await openRowMenu(page, question);
  const deleteItem = page.getByRole("menuitem", { name: "Delete" });
  await expect(deleteItem).toBeVisible();
  await deleteItem.click();

  // Irreversible action → explicit second step.
  const dialog = page.getByRole("alertdialog", { name: "Delete chat" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete" }).click();

  // The row is gone and the open chat (it was the deleted one) resets to
  // the centered-composer empty state.
  await expect(row(page, question)).toBeHidden();
  await expect(composer(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Helpful", exact: true })).toHaveCount(0);
});
