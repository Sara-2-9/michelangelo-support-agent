/**
 * Phase 1b — Automatic documentation sync.
 *
 * Runs inside the Worker on a Cron Trigger (see wrangler.toml [triggers]):
 *   1. fetches the docs index (llms.txt) and every .md page over HTTP
 *   2. chunks each page with the SAME logic as the local pipeline
 *      (src/lib/chunking.ts — single source of truth)
 *   3. diffs content_hash vs the chunks already indexed in Supabase
 *   4. embeds ONLY the delta (Workers AI bge-m3) and upserts it
 *   5. deletes chunks whose docs sections no longer exist
 *
 * Idempotent and incremental by design: an unchanged corpus costs zero
 * embedding calls. A page that fails to download is skipped and reported
 * (its existing chunks stay in the index) — one bad page must never
 * kill the whole sync.
 */

import { createClient } from "@supabase/supabase-js";
import { chunkPage, type Chunk } from "./chunking.js";
import { embedBatch } from "./embeddings.js";

const DOCS_INDEX_URL = "https://docs.michelangelo.land/llms.txt";
const FETCH_CONCURRENCY = 6;
const MAX_BATCH_TOKENS = 12_000; // estimated, wide margin below the 60k real limit
const MAX_TEXTS_PER_BATCH = 25;
const UPSERT_BATCH = 100;

export interface SyncConfig {
  supabaseUrl: string;
  supabaseKey: string;
  cfAccountId: string;
  cfApiToken: string;
}

export interface SyncStats {
  pagesFound: number;
  pagesFetched: number;
  pagesFailed: string[];
  chunksTotal: number;
  embedded: number;
  upToDate: number;
  removed: number;
  durationMs: number;
}

/** Extracts the .md page URLs from the llms.txt markdown index. */
export function parseDocsIndex(llmsTxt: string): string[] {
  const urls = new Set<string>();
  for (const m of llmsTxt.matchAll(/https:\/\/docs\.michelangelo\.land\/[^)\s]+\.md/g)) {
    urls.add(m[0]);
  }
  return [...urls];
}

/** Bounded-concurrency map: at most `size` fetches in flight. */
async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    })
  );
  return results;
}

export async function syncDocs(config: SyncConfig, log: (msg: string) => void = console.log): Promise<SyncStats> {
  const started = Date.now();
  const supabase = createClient(config.supabaseUrl, config.supabaseKey);

  // 1. Index → page URLs
  const indexRes = await fetch(DOCS_INDEX_URL);
  if (!indexRes.ok) throw new Error(`docs index ${indexRes.status}`);
  const pageUrls = parseDocsIndex(await indexRes.text());
  log(`📚 ${pageUrls.length} pages in the docs index`);

  // 2. Fetch pages (a failed page is skipped, never fatal)
  const pagesFailed: string[] = [];
  const pages = await mapPool(pageUrls, FETCH_CONCURRENCY, async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      return { url, markdown: await res.text() };
    } catch {
      pagesFailed.push(url);
      return { url, markdown: null };
    }
  });

  // 3. Chunk everything
  const chunks: Chunk[] = [];
  for (const p of pages) {
    if (p.markdown) chunks.push(...(await chunkPage(p.markdown, p.url)));
  }
  log(`📄 ${chunks.length} chunks from ${pages.length - pagesFailed.length} pages`);

  // 4. Delta detection vs the indexed chunks
  const { data: existing, error } = await supabase.from("chunks").select("id, content_hash");
  if (error) throw new Error(`Supabase: ${error.message}`);
  const indexed = new Map((existing ?? []).map((r) => [r.id, r.content_hash]));

  const toEmbed = chunks.filter((c) => indexed.get(c.id) !== c.content_hash);
  const staleIds = [...indexed.keys()].filter((id) => !chunks.some((c) => c.id === id));
  log(`🔎 to embed: ${toEmbed.length} | up to date: ${chunks.length - toEmbed.length} | stale: ${staleIds.length}`);

  // 5. Embed + upsert the delta (token-aware batching)
  let batch: Chunk[] = [];
  let batchTokens = 0;
  const flush = async () => {
    if (batch.length === 0) return;
    const vectors = await embedBatch(batch.map((c) => c.content), config.cfAccountId, config.cfApiToken, log);
    const rows = batch.map((c, j) => ({ ...c, embedding: vectors[j], updated_at: new Date().toISOString() }));
    for (let u = 0; u < rows.length; u += UPSERT_BATCH) {
      const { error: upErr } = await supabase.from("chunks").upsert(rows.slice(u, u + UPSERT_BATCH));
      if (upErr) throw new Error(`Upsert: ${upErr.message}`);
    }
    batch = [];
    batchTokens = 0;
  };
  for (const chunk of toEmbed) {
    if (batchTokens + chunk.char_count > MAX_BATCH_TOKENS || batch.length >= MAX_TEXTS_PER_BATCH) await flush();
    batch.push(chunk);
    batchTokens += chunk.char_count;
  }
  await flush();

  // 6. Remove chunks whose docs sections no longer exist
  if (staleIds.length > 0) {
    const { error: delErr } = await supabase.from("chunks").delete().in("id", staleIds);
    if (delErr) throw new Error(`Delete: ${delErr.message}`);
    log(`   🗑️  removed ${staleIds.length} stale chunks`);
  }

  const stats: SyncStats = {
    pagesFound: pageUrls.length,
    pagesFetched: pages.length - pagesFailed.length,
    pagesFailed,
    chunksTotal: chunks.length,
    embedded: toEmbed.length,
    upToDate: chunks.length - toEmbed.length,
    removed: staleIds.length,
    durationMs: Date.now() - started,
  };
  log(`✅ docs sync complete in ${(stats.durationMs / 1000).toFixed(1)}s: ${JSON.stringify(stats)}`);
  return stats;
}
