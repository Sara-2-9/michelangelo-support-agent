/**
 * Suite B — anonymous chat against the REAL pipeline (Worker → router →
 * retrieval → LLM). Staging only: these tests write real conversation
 * rows, so they must never run against production.
 *
 * Assertions are structural (badge, sources block, feedback buttons),
 * never on the LLM's exact wording — answers are non-deterministic.
 * The questions come from the eval golden dataset (well-retrieved topics).
 */

import { test, expect, type Page } from "@playwright/test";

test.skip(
  process.env.E2E_ENV !== "staging",
  "writes real rows to the database — staging only (E2E_ENV=staging)",
);

const ANSWER_TIMEOUT = 90_000;

const composer = (page: Page) => page.getByPlaceholder("Ask a question…");
/** Rendered only on persisted assistant messages — the best "answer arrived" signal. */
const helpfulButtons = (page: Page) => page.getByRole("button", { name: "Helpful", exact: true });

async function ask(page: Page, question: string) {
  const before = await helpfulButtons(page).count();
  // The textarea enables only once the session token exists — the
  // deterministic "app is ready" signal (typing earlier would lose the
  // draft to the ChatProvider bootstrap remount).
  await expect(composer(page)).toBeEnabled({ timeout: 15_000 });
  await composer(page).fill(question);
  await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
  await composer(page).press("Enter");
  await expect(helpfulButtons(page)).toHaveCount(before + 1, { timeout: ANSWER_TIMEOUT });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("cookie-consent", "accepted"));
});

test("a docs question gets a grounded answer with intent badge and sources", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");

  await ask(page, "How do I connect my GitHub account?");

  // Intent badge (dynamic label from messages.intent) on the assistant card.
  await expect(
    page.getByText(/^(Support|Bug report|Troubleshooting|Off topic)$/).first(),
  ).toBeVisible();

  // Structured sources rendered by the UI (the prompt no longer writes a
  // "Sources" section in the answer text — Phase 6).
  await expect(page.getByText("Sources:").first()).toBeVisible();
  expect(await page.locator('a[href^="http"]').count()).toBeGreaterThan(0);
});

test("a follow-up question uses the session memory", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");

  await ask(page, "What is the maximum prompt length?");
  // Pronoun-only follow-up: answerable only with conversation context.
  await ask(page, "And how many images can I attach to it?");

  expect(await helpfulButtons(page).count()).toBe(2);
});

test("anonymous visitors get NO history: reload starts a fresh chat", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");

  await ask(page, "How do I restore my subscription after reinstalling the app?");

  await page.reload();
  // Empty state again: centered composer, no messages replayed…
  await expect(composer(page)).toBeVisible();
  await expect(helpfulButtons(page)).toHaveCount(0);
  // …and no conversation id persisted for anonymous users (Phase 10).
  expect(await page.evaluate(() => localStorage.getItem("msa_conversation_id"))).toBeNull();
});

test("feedback buttons toggle a vote on an assistant answer", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");

  await ask(page, "How do I connect my GitHub account?");

  const helpful = helpfulButtons(page).first();
  await helpful.click();
  await expect(helpful).toHaveAttribute("aria-pressed", "true");
  // Clicking the same thumb again toggles it off.
  await helpful.click();
  await expect(helpful).toHaveAttribute("aria-pressed", "false");
});
