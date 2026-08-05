/**
 * Step 1 — Chunking of the local documentation corpus → corpus/chunks.json.
 *
 * The chunking logic itself lives in src/lib/chunking.ts (single source of
 * truth, shared with the Worker's cron sync in Phase 1b). This script is
 * just file IO + stats for human inspection.
 *
 * NEVER embed before inspecting the chunks by eye.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { chunkPage, type Chunk } from "../src/lib/chunking.js";

const RAW_DIR = "corpus/raw";
const URLS_FILE = "corpus/urls.txt";
const OUT_FILE = "corpus/chunks.json";

/** Maps local filename → source URL (same order used at download time). */
function loadUrlMap(): Map<string, string> {
  const urls = readFileSync(URLS_FILE, "utf-8").trim().split("\n");
  const map = new Map<string, string>();
  for (const url of urls) {
    const name = url.replace("https://docs.michelangelo.land/", "").replaceAll("/", "__");
    map.set(name, url);
  }
  return map;
}

// --- main ---
const urlMap = loadUrlMap();
const allChunks: Chunk[] = [];

for (const filename of readdirSync(RAW_DIR).filter((f) => f.endsWith(".md"))) {
  const url = urlMap.get(filename) ?? `https://docs.michelangelo.land/${filename}`;
  const raw = readFileSync(path.join(RAW_DIR, filename), "utf-8");
  allChunks.push(...(await chunkPage(raw, url)));
}

writeFileSync(OUT_FILE, JSON.stringify(allChunks, null, 2));

// --- stats for human inspection ---
const lengths = allChunks.map((c) => c.char_count).sort((a, b) => a - b);
const avg = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
console.log(`\n✅ ${allChunks.length} chunks from ${urlMap.size} pages`);
console.log(`   length: min ${lengths[0]} | avg ${avg} | max ${lengths[lengths.length - 1]} chars`);
console.log(`\n   Top 5 largest chunks (candidates for reviewing MAX_CHUNK_CHARS):`);
for (const c of [...allChunks].sort((a, b) => b.char_count - a.char_count).slice(0, 5)) {
  console.log(`   ${c.char_count.toString().padStart(5)} | ${c.page_title} > ${c.section}`);
}
console.log(`\n   Saved to ${OUT_FILE}`);
