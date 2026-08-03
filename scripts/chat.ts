/**
 * Phase 2 — CLI chat with the support agent.
 *
 * Usage: npm run chat -- "la tua domanda qui"
 *
 * Sends the question to the Mastra agent, which will autonomously call
 * the searchDocs tool, then print the final answer (with citations).
 */

import { readFileSync } from "node:fs";
import { createSupportAgent } from "../src/agent.js";

for (const line of readFileSync(".env", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = process.env;

const question = process.argv[2];
if (!question) {
  console.error('Usage: npm run chat -- "your question here"');
  process.exit(1);
}

const agent = createSupportAgent({
  supabaseUrl: SUPABASE_URL!,
  supabaseKey: SUPABASE_SERVICE_ROLE_KEY!,
  cfAccountId: CLOUDFLARE_ACCOUNT_ID!,
  cfApiToken: CLOUDFLARE_API_TOKEN!,
});

console.log(`\n❓ ${question}\n`);
const result = await agent.answer(question);
console.log(result.text);
if (!result.grounded) {
  console.log("\n⚠️  (deterministic refusal — no relevant documentation found)");
}
