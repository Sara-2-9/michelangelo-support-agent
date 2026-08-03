/**
 * Memory smoke test — two turns where the second ONLY makes sense
 * with conversation history ("and in what format?" refers to the
 * images from turn 1). Verifies that history is actually used.
 *
 * Usage: npm run test:memory
 */

import { readFileSync } from "node:fs";
import { createOrchestrator } from "../src/orchestrator.js";
import type { HistoryMessage } from "../src/lib/logging.js";

for (const line of readFileSync(".env", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const orchestrator = createOrchestrator({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  cfAccountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  cfApiToken: process.env.CLOUDFLARE_API_TOKEN!,
});

const conversationId = await orchestrator.logger.createConversation("cli");
const history: HistoryMessage[] = [];

const turns = [
  "quante immagini posso allegare a un prompt?",
  "e in che formato vengono salvate?",
];

for (const q of turns) {
  const r = await orchestrator.handle(q, { conversationId, history });
  history.push({ role: "user", content: q }, { role: "assistant", content: r.text });
  console.log(`\nQ: ${q}`);
  console.log(`[${r.intent}] ${r.text.slice(0, 300).replaceAll("\n", " ")}`);
}

console.log(`\nconversation: ${conversationId}`);
