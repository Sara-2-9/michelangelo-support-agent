/**
 * Suite A — smoke & layout. Fast, always-on gate.
 *
 * Covers the surfaces that broke in the past or define the product:
 * the empty-state layout (centered composer + legal footer), the legal
 * pages and their direct-URL deep links (Phase 5.4/8 ASSETS delegation
 * regression — full protection comes from running this against a
 * production-like target, see playwright.config.ts E2E_BASE_URL), and
 * the /auth entry points.
 */

import { test, expect, type Page } from "@playwright/test";

const composer = (page: Page) => page.getByPlaceholder("Ask a question…");
const legalNav = (page: Page) => page.getByRole("navigation", { name: "Legal" });

test.beforeEach(async ({ page }) => {
  // The cookie banner is tested on its own in cookie-banner.spec.ts;
  // everywhere else we pre-consent before any app script runs.
  await page.addInitScript(() => localStorage.setItem("cookie-consent", "accepted"));
});

test("home: centered composer and legal footer on the empty state", async ({ page }) => {
  await page.goto("/");

  await expect(composer(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();

  // Legal footer pinned at the bottom of the empty state.
  await expect(page.getByText("not affiliated with Michelangelo")).toBeVisible();
  await expect(legalNav(page).getByRole("link", { name: "Privacy" })).toBeVisible();
  await expect(legalNav(page).getByRole("link", { name: "Terms" })).toBeVisible();
});

test("composer focus hides the legal footer (iOS keyboard rule)", async ({ page }) => {
  await page.goto("/");

  await expect(legalNav(page)).toBeVisible();
  await composer(page).click();
  // peer-focus-within:hidden — the footer must never ride the keyboard.
  await expect(legalNav(page)).toBeHidden();
  await page.keyboard.press("Escape");
  await composer(page).blur();
  await expect(legalNav(page)).toBeVisible();
});

test("footer Privacy link navigates in-app and Back returns", async ({ page }) => {
  await page.goto("/");

  await legalNav(page).getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();

  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(composer(page)).toBeVisible();
});

// Deep links = full page loads on a non-root URL. Against the production
// build these exercise the Worker's explicit delegation to env.ASSETS
// (without it, /privacy would answer with the API 401 JSON).
for (const [path, heading] of [
  ["/privacy", "Privacy Policy"],
  ["/terms", "Terms of Service"],
] as const) {
  test(`deep link ${path} renders the legal page directly`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByText("Last updated:")).toBeVisible();
  });
}

test("/auth offers both email magic link and Google sign-in", async ({ page }) => {
  await page.goto("/auth");

  await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
});
