/**
 * Cookie banner — tested in isolation WITHOUT pre-consent.
 *
 * First visit on any page shows the consent dialog; choosing Accept or
 * Reject persists to localStorage and the banner never comes back.
 */

import { test, expect } from "@playwright/test";

const banner = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog", { name: "Cookie consent" });

test("first visit shows the banner, Accept dismisses it permanently", async ({ page }) => {
  await page.goto("/");

  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toContainText("strictly necessary storage");
  // The privacy link inside the banner works too.
  await expect(banner(page).getByRole("link", { name: "Privacy Policy" })).toBeVisible();

  await banner(page).getByRole("button", { name: "Accept" }).click();
  await expect(banner(page)).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("cookie-consent"))).toBe("accepted");

  await page.reload();
  await expect(banner(page)).toBeHidden();
});

test("Reject is an equally valid choice and persists", async ({ page }) => {
  await page.goto("/");

  await banner(page).getByRole("button", { name: "Reject" }).click();
  await expect(banner(page)).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("cookie-consent"))).toBe("rejected");
});
