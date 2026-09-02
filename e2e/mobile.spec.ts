/**
 * Mobile suite — runs ONLY in the mobile-webkit project (iPhone 14,
 * WebKit). Guards the iOS-specific regressions collected during the
 * restyle phases: the 16px input font-size rule (below it iOS Safari
 * auto-zooms on focus), the dvh layout, and no horizontal overflow.
 */

import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("cookie-consent", "accepted"));
});

test("composer input uses at least 16px font (no iOS focus zoom)", async ({ page }) => {
  await page.goto("/");

  const textarea = page.getByPlaceholder("Ask a question…");
  await expect(textarea).toBeVisible();
  const fontSize = await textarea.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(16);
});

test("mobile layout: no horizontal overflow, composer usable", async ({ page }) => {
  await page.goto("/");

  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalScroll).toBe(false);

  const textarea = page.getByPlaceholder("Ask a question…");
  // Generous under full-suite parallel load (the WebKit worker competes
  // with the LLM-heavy Chromium tests on the same dev server).
  await expect(textarea).toBeEnabled({ timeout: 30_000 });
  await textarea.fill("What is Michelangelo?");
  await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled({ timeout: 15_000 });
});

test("deep link /terms renders on mobile too", async ({ page }) => {
  const response = await page.goto("/terms");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
});
