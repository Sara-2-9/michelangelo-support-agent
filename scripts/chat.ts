/**
 * Interactive CLI chat with the orchestrated support agent.
 *
 * Usage:
 *   npm run chat                          → new conversation
 *   npm run chat -- --resume <conv-uuid>  → resume a past conversation
 *
 * Every exchange is logged to Supabase (conversations/messages tables)
 * and the conversation has memory: follow-up questions see the history.
 * Type "exit" (or Ctrl+C) to quit.
 */

import { readFileSync } from "node:fs";
import * as readline from "node:readline";
import { createOrchestrator } from "../src/orchestrator.js";
import type { HistoryMessage } from "../src/lib/logging.js";

for (const line of readFileSync(".env", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = process.env;

const orchestrator = createOrchestrator({
  supabaseUrl: SUPABASE_URL!,
  supabaseKey: SUPABASE_SERVICE_ROLE_KEY!,
  cfAccountId: CLOUDFLARE_ACCOUNT_ID!,
  cfApiToken: CLOUDFLARE_API_TOKEN!,
});

// --- resume or start a conversation ---
const resumeIdx = process.argv.indexOf("--resume");
let conversationId: string;
const history: HistoryMessage[] = [];

if (resumeIdx !== -1 && process.argv[resumeIdx + 1]) {
  conversationId = process.argv[resumeIdx + 1];
  history.push(...(await orchestrator.logger.loadHistory(conversationId)));
  console.log(`\n📂 Resumed conversation ${conversationId} (${history.length} messages loaded)`);
} else {
  conversationId = await orchestrator.logger.createConversation("cli");
  console.log(`\n🆕 New conversation ${conversationId}`);
}
console.log('   Type "exit" to quit.\n');

// --- REPL loop ---
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let closed = false;
rl.on("close", () => (closed = true));

const ask = () =>
  rl.question("Tu: ", async (message) => {
    const text = message.trim();
    if (!text || text === "exit" || closed) {
      rl.close();
      return;
    }
    const result = await orchestrator.handle(text, { conversationId, history });
    history.push({ role: "user", content: text }, { role: "assistant", content: result.text });

    console.log(`\n🏷️  intent: ${result.intent}`);
    console.log(`Agent: ${result.text}\n`);
    if (!closed) ask();
  });

ask();
