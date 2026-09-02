/**
 * Authenticated suite (staging mode only) — runs with the saved session
 * of the seeded test user (see authed.setup.ts). Phase 10 behaviors:
 * registered users get history surfaces, anonymous visitors don't.
 */

import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const { email } = JSON.parse(readFileSync("e2e/.auth/test-user.json", "utf-8")) as {
  email: string;
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("cookie-consent", "accepted"));
});

test("account panel shows the signed-in email and account actions", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete Account" })).toBeVisible();
});

test("sidebar shows conversation history UI, not the anonymous sign-in card", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Open conversation history" }).click();
  await expect(page.getByText("Sign in to keep your chats")).toBeHidden();
  await expect(page.getByRole("button", { name: "New chat" })).toBeVisible();
});
