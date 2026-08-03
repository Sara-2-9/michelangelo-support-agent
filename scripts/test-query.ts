/**
 * Step 3 — Semantic query smoke test.
 *
 * Usage: npm run query -- "la tua domanda qui"
 *
 * Embeds the question with the SAME model used at indexing time (bge-m3)
 * and calls the match_chunks RPC on Supabase to retrieve the most similar
 * chunks. Prints similarity scores and sources for human inspection.
 *
 * This is the retrieval half of RAG, tested in isolation: if the right
 * chunks come back here, the generation step (Phase 2) has good material
 * to work with. Always test retrieval alone before wiring an LLM on top.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = process.env;

const question = process.argv[2];
if (!question) {
  console.error('Usage: npm run query -- "your question here"');
  process.exit(1);
}

const MODEL = "@cf/baai/bge-m3";
const CF_AI_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${MODEL}`;
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

const res = await fetch(CF_AI_URL, {
  method: "POST",
  headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ text: [question] }),
});
if (!res.ok) throw new Error(`Workers AI ${res.status}: ${await res.text()}`);
const { result } = (await res.json()) as { result: { data: number[][] } };

const { data, error } = await supabase.rpc("match_chunks", {
  query_embedding: result.data[0],
  match_count: 5,
  min_similarity: 0.2,
});
if (error) throw new Error(`Supabase: ${error.message}`);

console.log(`\n❓ ${question}\n`);
for (const [i, r] of (data ?? []).entries()) {
  console.log(`${i + 1}. [${(r.similarity * 100).toFixed(1)}%] ${r.page_title} > ${r.section}`);
  console.log(`   ${r.source_url}`);
  console.log(`   ${r.content.slice(0, 180).replaceAll("\n", " ")}...\n`);
}
