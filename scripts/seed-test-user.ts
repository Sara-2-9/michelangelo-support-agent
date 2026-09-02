/**
 * Seed the E2E test user on the STAGING Supabase project.
 *
 * Idempotent: creates the user on first run (email_confirmed, no inbox
 * needed), keeps its password in sync on later runs, and verifies that a
 * real sign-in works. Credentials are written to e2e/.auth/test-user.json
 * (gitignored) for the Playwright authed.setup.
 *
 * Usage: npm run seed:test-user
 * Reads:  .dev.vars.staging (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// --- config from .dev.vars.staging (manual parsing: no extra dependencies) ---
let rawVars: string;
try {
  rawVars = readFileSync(".dev.vars.staging", "utf-8");
} catch {
  console.error(
    "❌ .dev.vars.staging not found — copy .dev.vars.staging.example and fill in " +
      "the STAGING project values first.",
  );
  process.exit(1);
}
for (const line of rawVars.split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
  if (m) process.env[m[1]] = m[2];
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  SUPABASE_URL.includes("<") ||
  SUPABASE_SERVICE_ROLE_KEY.includes("<")
) {
  console.error("❌ Missing variables or leftover placeholders in .dev.vars.staging");
  process.exit(1);
}

const EMAIL = "e2e.user@example.com";
const STATE_PATH = "e2e/.auth/test-user.json";

// Reuse the stored password if present (so reruns don't break a saved
// Playwright session), otherwise generate a fresh one.
let password: string;
try {
  password = JSON.parse(readFileSync(STATE_PATH, "utf-8")).password;
} catch {
  password = randomBytes(18).toString("hex");
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Find the user (staging has a handful of users: default page is enough).
const { data: list, error: listError } = await admin.auth.admin.listUsers();
if (listError) {
  console.error("❌ listUsers failed:", listError.message);
  process.exit(1);
}
const existing = list.users.find((u) => u.email === EMAIL);

if (!existing) {
  const { error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password,
    email_confirm: true, // no confirmation email — no inbox involved
  });
  if (error) {
    console.error("❌ createUser failed:", error.message);
    process.exit(1);
  }
  console.log(`✅ Created test user ${EMAIL}`);
} else {
  // Keep the password in sync with the stored one.
  const { error } = await admin.auth.admin.updateUserById(existing.id, { password });
  if (error) {
    console.error("❌ updateUserById failed:", error.message);
    process.exit(1);
  }
  console.log(`✅ Test user ${EMAIL} already exists — password synced`);
}

// Verify a REAL sign-in works with these credentials.
const anon = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { error: signInError } = await anon.auth.signInWithPassword({ email: EMAIL, password });
if (signInError) {
  console.error("❌ Verification sign-in failed:", signInError.message);
  process.exit(1);
}

mkdirSync("e2e/.auth", { recursive: true });
writeFileSync(STATE_PATH, JSON.stringify({ email: EMAIL, password }, null, 2));
console.log(`✅ Sign-in verified — credentials saved to ${STATE_PATH}`);
