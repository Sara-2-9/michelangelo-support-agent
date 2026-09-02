/**
 * Shared E2E env loader — reads the STAGING browser env (web/.env.staging).
 * Manual parsing, no extra dependencies (project convention).
 */

import { readFileSync } from "node:fs";

export function loadStagingWebEnv(): {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
} {
  const env = readEnvFile("web/.env.staging", "web/env.staging.example");
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    throw new Error("web/.env.staging is missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
  }
  return { VITE_SUPABASE_URL: env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY };
}

/**
 * Browser env of the ACTIVE mode: web/.env.staging when E2E_ENV=staging,
 * web/.env otherwise. Used by the universal anonymous-session setup.
 */
export function loadWebEnv(): {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
} {
  if (process.env.E2E_ENV === "staging") return loadStagingWebEnv();
  const env = readEnvFile("web/.env", "web/.env.example");
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    throw new Error("web/.env is missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
  }
  return { VITE_SUPABASE_URL: env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY };
}

/** Worker-side staging env (.dev.vars.staging) — for Admin API calls in tests. */
export function loadStagingWorkerEnv(): {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
} {
  const env = readEnvFile(".dev.vars.staging", ".dev.vars.staging.example");
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(".dev.vars.staging is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  return { SUPABASE_URL: env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY };
}

function readEnvFile(path: string, template: string): Record<string, string> {
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    throw new Error(
      `${path} not found — copy ${template}, fill in the STAGING project values, ` +
        "then run `npm run seed:test-user`.",
    );
  }
  const env: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  if (Object.values(env).some((v) => v.includes("<"))) {
    throw new Error(`${path} still has placeholder values.`);
  }
  return env;
}
