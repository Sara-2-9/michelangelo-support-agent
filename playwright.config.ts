/**
 * Playwright E2E config — michelangelo-support-agent.
 *
 * Default target: the local dev server (`npm run dev`, Vite + Worker on
 * :5173), started automatically and reused if already running.
 * Point at any other environment with E2E_BASE_URL, e.g. the live site:
 *   E2E_BASE_URL=https://michelangelo-support-agent.moro-sara29.workers.dev npx playwright test
 *
 * Projects:
 *   desktop-chromium — smoke, cookie banner and API security suites
 *   mobile-webkit    — iPhone emulation (iOS Safari regressions live here)
 */
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const useLocalServer = !process.env.E2E_BASE_URL;

// E2E_ENV=staging → the dev server runs in Vite mode "staging", loading
// web/.env.staging (browser) and .dev.vars.staging (Worker): the STAGING
// Supabase project. Only then are the authenticated suites available —
// they need the seeded test user (npm run seed:test-user).
const staging = process.env.E2E_ENV === "staging";

export default defineConfig({
  testDir: "./e2e",
  // 60s per test: under full-suite parallel load the dev server (Vite +
  // workerd) cold-starts slowly and the anonymous sign-in competes with
  // the LLM-heavy suites. Suites with real LLM calls set their own
  // higher timeouts on top of this.
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html"]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Every test starts with the shared anonymous session already in
        // place (no per-test signup burst, no bootstrap-remount race).
        storageState: "e2e/.auth/anon.json",
      },
      testIgnore: [/mobile\.spec\.ts/, /authed\.(setup|spec)\.ts/, /conversations\.spec\.ts/],
      dependencies: ["anon-setup"],
    },
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 14"], storageState: "e2e/.auth/anon.json" },
      testMatch: /mobile\.spec\.ts/,
      dependencies: ["anon-setup"],
    },
    // Session setup (always on) + authenticated suites (staging only —
    // they need the seeded test user from `npm run seed:test-user`).
    { name: "anon-setup", testMatch: /anon\.setup\.ts/ },
    ...(staging
      ? [
          { name: "setup", testMatch: /authed\.setup\.ts/ },
          {
            name: "authed-chromium",
            use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
            dependencies: ["setup"],
            testMatch: [/(authed|conversations)\.spec\.ts/],
          },
        ]
      : []),
  ],
  webServer: useLocalServer
    ? {
        // CLOUDFLARE_ENV=staging: the @cloudflare/vite-plugin selects the
        // worker environment from CLOUDFLARE_ENV (NOT from Vite --mode),
        // which is what makes it load `.dev.vars.staging`. Vite's own
        // --mode staging loads `web/.env.staging` for the browser bundle.
        command: staging
          ? "CLOUDFLARE_ENV=staging npm run dev -- --mode staging"
          : "npm run dev",
        // /api/health proves BOTH the SPA server and the Worker are up.
        url: `${baseURL}/api/health`,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
