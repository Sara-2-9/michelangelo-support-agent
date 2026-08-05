/**
 * Step 0 — Corpus download: fetches the docs index (llms.txt) and every
 * .md page into corpus/raw/, regenerating urls.txt and llms.txt.
 *
 * Makes the local snapshot reproducible: the same parseDocsIndex used by
 * the Worker cron sync (Phase 1b) drives this download, so the offline
 * pipeline (fetch → chunk → embed) and the live sync always agree on
 * what "the documentation" is.
 *
 * Filenames follow the original convention: URL path with "/" → "__".
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { parseDocsIndex } from "../src/lib/docs-sync.js";

const INDEX_URL = "https://docs.michelangelo.land/llms.txt";
const RAW_DIR = "corpus/raw";

const llmsTxt = await (await fetch(INDEX_URL)).text();
const urls = parseDocsIndex(llmsTxt);
console.log(`📚 ${urls.length} pages in the docs index`);

mkdirSync(RAW_DIR, { recursive: true });
let done = 0;
for (const url of urls) {
  const name = url.replace("https://docs.michelangelo.land/", "").replaceAll("/", "__");
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`   ⚠️  ${res.status} on ${url} — skipped`);
    continue;
  }
  writeFileSync(`${RAW_DIR}/${name}`, await res.text());
  if (++done % 10 === 0) console.log(`   ⬇️  ${done}/${urls.length}`);
}

writeFileSync("corpus/urls.txt", urls.join("\n") + "\n");
writeFileSync("corpus/llms.txt", llmsTxt);
console.log(`✅ ${done} pages saved to ${RAW_DIR}/ (+ urls.txt, llms.txt refreshed)`);
