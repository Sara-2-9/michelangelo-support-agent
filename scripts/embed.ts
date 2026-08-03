/**
 * Step 2 — Indicizzazione: embeddings (Cloudflare Workers AI, bge-m3) → Supabase pgvector.
 *
 * Flusso:
 *   1. Legge corpus/chunks.json (output di npm run chunk)
 *   2. Per ogni chunk SENZA embedding aggiornato in Supabase (confronto su content_hash)
 *      calcola l'embedding via REST API di Workers AI
 *   3. Upsert in batch sulla tabella chunks
 *
 * È IDEMPOTENTE e INCREMENTALE: rilanciarlo dopo un sync della docs
 * ri-embedda solo il delta. È lo stesso script che il Cron Trigger (Fase 1b)
 * userà in produzione.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// --- config da .env (caricamento manuale: niente dipendenze extra) ---
for (const line of readFileSync(".env", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = process.env;
for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN })) {
  if (!v || v.includes("TUO_PROJECT_REF")) {
    console.error(`❌ Manca o è placeholder la variabile ${k} in .env`);
    process.exit(1);
  }
}

const MODEL = "@cf/baai/bge-m3"; // multilingua: query IT → docs EN funziona
const CF_AI_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${MODEL}`;
const BATCH_SIZE = 50; // max testi per chiamata Workers AI
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

/** Embedding di un batch di testi via Workers AI REST. */
async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch(CF_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: texts }),
  });
  if (!res.ok) throw new Error(`Workers AI ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { result: { data: number[][] } };
  return json.result.data;
}

async function main() {
  const chunks: Chunk[] = JSON.parse(readFileSync("corpus/chunks.json", "utf-8"));
  console.log(`📄 ${chunks.length} chunk nel file`);

  // Delta detection: quali content_hash sono già indicizzati?
  const { data: existing, error } = await supabase.from("chunks").select("id, content_hash");
  if (error) throw new Error(`Supabase: ${error.message}`);
  const indexed = new Map((existing ?? []).map((r) => [r.id, r.content_hash]));

  const toEmbed = chunks.filter((c) => indexed.get(c.id) !== c.content_hash);
  // Pulizia: chunk spariti dalla docs vanno rimossi dal DB.
  const staleIds = [...indexed.keys()].filter((id) => !chunks.some((c) => c.id === id));

  console.log(`🔎 da embeddare: ${toEmbed.length} | già aggiornati: ${chunks.length - toEmbed.length} | obsoleti da rimuovere: ${staleIds.length}`);
  if (toEmbed.length === 0 && staleIds.length === 0) {
    console.log("✅ Indice già aggiornato, niente da fare.");
    return;
  }

  // Embedding + upsert a batch
  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE);
    const vectors = await embedBatch(batch.map((c) => c.content));
    const rows = batch.map((c, j) => ({ ...c, embedding: vectors[j], updated_at: new Date().toISOString() }));

    for (let u = 0; u < rows.length; u += UPSERT_BATCH) {
      const { error: upErr } = await supabase.from("chunks").upsert(rows.slice(u, u + UPSERT_BATCH));
      if (upErr) throw new Error(`Upsert: ${upErr.message}`);
    }
    console.log(`   ✍️  ${Math.min(i + BATCH_SIZE, toEmbed.length)}/${toEmbed.length}`);
  }

  if (staleIds.length > 0) {
    const { error: delErr } = await supabase.from("chunks").delete().in("id", staleIds);
    if (delErr) throw new Error(`Delete: ${delErr.message}`);
    console.log(`   🗑️  rimossi ${staleIds.length} chunk obsoleti`);
  }

  console.log("✅ Indicizzazione completata.");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
