/**
 * Step 2 — Indexing: embeddings (Cloudflare Workers AI, bge-m3) → Supabase pgvector.
 *
 * Flow:
 *   1. Reads corpus/chunks.json (output of `npm run chunk`)
 *   2. For every chunk WITHOUT an up-to-date embedding in Supabase
 *      (content_hash comparison), computes the embedding via the
 *      Workers AI REST API
 *   3. Batch-upserts into the chunks table
 *
 * It is IDEMPOTENT and INCREMENTAL: re-running it after a docs sync
 * re-embeds only the delta. This is the same script the Cron Trigger
 * (Phase 1b) will use in production.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// --- config from .env (manual loading: no extra dependencies) ---
for (const line of readFileSync(".env", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = process.env;
for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN })) {
  if (!v || v.includes("TUO_PROJECT_REF")) {
    console.error(`❌ Variable ${k} is missing or still a placeholder in .env`);
    process.exit(1);
  }
}

const MODEL = "@cf/baai/bge-m3"; // multilingual: IT queries → EN docs works
const CF_AI_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${MODEL}`;
const UPSERT_BATCH = 100;

interface Chunk {
  id: string;
  source_url: string;
  page_title: string;
  section: string;
  content: string;
  content_hash: string;
  char_count: number;
}

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

/**
 * Embeds a batch of texts via the Workers AI REST API.
 *
 * Adaptive batch splitting: if the provider answers "context overflow"
 * (the local token estimate can be way off vs the real tokenizer —
 * dense YAML/markdown tokenizes much worse than prose), the batch is
 * halved and retried recursively instead of trusting the estimate.
 */
async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch(CF_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: texts }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (body.includes("Max context reached") && texts.length > 1) {
      const mid = Math.ceil(texts.length / 2);
      console.log(`   ⚠️  context overflow with ${texts.length} texts → splitting batch in two`);
      const left = await embedBatch(texts.slice(0, mid));
      const right = await embedBatch(texts.slice(mid));
      return [...left, ...right];
    }
    throw new Error(`Workers AI ${res.status}: ${body}`);
  }
  const json = (await res.json()) as { result: { data: number[][] } };
  return json.result.data;
}

async function main() {
  const chunks: Chunk[] = JSON.parse(readFileSync("corpus/chunks.json", "utf-8"));
  console.log(`📄 ${chunks.length} chunks in file`);

  // Delta detection: which content_hashes are already indexed?
  const { data: existing, error } = await supabase.from("chunks").select("id, content_hash");
  if (error) throw new Error(`Supabase: ${error.message}`);
  const indexed = new Map((existing ?? []).map((r) => [r.id, r.content_hash]));

  const toEmbed = chunks.filter((c) => indexed.get(c.id) !== c.content_hash);
  // Cleanup: chunks that disappeared from the docs are removed from the DB.
  const staleIds = [...indexed.keys()].filter((id) => !chunks.some((c) => c.id === id));

  console.log(`🔎 to embed: ${toEmbed.length} | already up to date: ${chunks.length - toEmbed.length} | stale to remove: ${staleIds.length}`);
  if (toEmbed.length === 0 && staleIds.length === 0) {
    console.log("✅ Index already up to date, nothing to do.");
    return;
  }

  // Embedding + batched upsert.
  // Token-aware batching: bge-m3 accepts max 60k tokens PER REQUEST (not per
  // text). Local estimate: ~1 char/token for dense technical text (YAML/
  // markdown tokenizes far worse than prose — measured ~3x worse than the
  // classic 3 chars/token rule of thumb). A hard cap on texts per batch
  // plus adaptive splitting in embedBatch covers any residual misestimate.
  const MAX_BATCH_TOKENS = 12_000; // estimated tokens, wide margin below 60k real
  const MAX_TEXTS_PER_BATCH = 25;
  const estimateTokens = (s: string) => s.length;

  let batch: Chunk[] = [];
  let batchTokens = 0;
  let done = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    const vectors = await embedBatch(batch.map((c) => c.content));
    const rows = batch.map((c, j) => ({ ...c, embedding: vectors[j], updated_at: new Date().toISOString() }));
    for (let u = 0; u < rows.length; u += UPSERT_BATCH) {
      const { error: upErr } = await supabase.from("chunks").upsert(rows.slice(u, u + UPSERT_BATCH));
      if (upErr) throw new Error(`Upsert: ${upErr.message}`);
    }
    done += batch.length;
    console.log(`   ✍️  ${done}/${toEmbed.length}`);
    batch = [];
    batchTokens = 0;
  };

  for (const chunk of toEmbed) {
    const tokens = estimateTokens(chunk.content);
    if (batchTokens + tokens > MAX_BATCH_TOKENS || batch.length >= MAX_TEXTS_PER_BATCH) await flush();
    batch.push(chunk);
    batchTokens += tokens;
  }
  await flush();

  if (staleIds.length > 0) {
    const { error: delErr } = await supabase.from("chunks").delete().in("id", staleIds);
    if (delErr) throw new Error(`Delete: ${delErr.message}`);
    console.log(`   🗑️  removed ${staleIds.length} stale chunks`);
  }

  console.log("✅ Indexing complete.");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
