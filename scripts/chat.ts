/**
 * CLI chat with the orchestrated support agent.
 *
 * Usage: npm run chat -- "la tua domanda qui"
 *
 * Routes the message through the intent router, dispatches to the right
 * handler, and prints the answer (with the detected intent, so routing
 * quality can be eyeballed — until the Phase 4 eval harness measures it).
 */

import { readFileSync } from "node:fs";
import { createOrchestrator } from "../src/orchestrator.js";

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

const orchestrator = createOrchestrator({
  supabaseUrl: SUPABASE_URL!,
  supabaseKey: SUPABASE_SERVICE_ROLE_KEY!,
  cfAccountId: CLOUDFLARE_ACCOUNT_ID!,
  cfApiToken: CLOUDFLARE_API_TOKEN!,
});

console.log(`\n❓ ${question}\n`);
const result = await orchestrator.handle(question);
console.log(`🏷️  intent: ${result.intent}\n`);
console.log(result.text);
if (!result.grounded && result.intent === "support_question") {
  console.log("\n⚠️  (deterministic refusal — no relevant documentation found)");
}
