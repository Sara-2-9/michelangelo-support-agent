/**
 * Step 1 — Structure-aware chunking of the Michelangelo documentation.
 *
 * Strategy: each markdown page is split on its sections (## / ###).
 * Every chunk "inherits" its context: page title + section title are
 * PREPENDED to the text, so the chunk is self-contained even outside
 * its page (solves the "broken context" problem in retrieval).
 *
 * Every chunk carries a content_hash (SHA-256): it is the foundation of
 * the incremental sync in Phase 1b — we re-embed only chunks whose hash
 * has changed.
 *
 * Output: corpus/chunks.json + stats for human inspection.
 * NEVER embed before inspecting the chunks by eye.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const RAW_DIR = "corpus/raw";
const URLS_FILE = "corpus/urls.txt";
const OUT_FILE = "corpus/chunks.json";

// Target length: above this threshold a section is split on paragraphs.
// ~2000 chars ≈ 500 tokens: enough context to answer,
// little enough noise for precise retrieval.
const MAX_CHUNK_CHARS = 2000;

interface Chunk {
  id: string;            // short hash, stable key for Supabase upserts
  source_url: string;    // used for answer citations (Phase 2)
  page_title: string;
  section: string;       // title of the containing section
  content: string;       // final text to be embedded (context + body)
  content_hash: string;  // SHA-256 of content → incremental sync
  char_count: number;
}

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

/** Removes Mintlify boilerplate (index header, JSX components, trailing cards). */
function cleanMarkdown(raw: string): string {
  return raw
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (t.startsWith("> ## Documentation Index")) return false;
      if (t.startsWith("> Fetch the complete documentation index")) return false;
      if (t.startsWith("> Use this file to discover")) return false;
      if (t.startsWith("<CardGroup") || t.startsWith("<Card ") || t.startsWith("</CardGroup")) return false;
      return true;
    })
    .join("\n")
    .replace(/```\n> ## Documentation Index[\s\S]*?```/g, "") // some pages wrap it in a code block
    .trim();
}

/**
 * Splits text into segments while respecting code fences (``` or ````):
 * code blocks are ATOMIC — never split inside a fence.
 * Returns alternating segments: free text / code block.
 */
function tokenizeByCodeFences(text: string): string[] {
  // Matches fenced blocks with 3+ backticks, including opening/closing fences.
  const fence = /(`{3,}[\s\S]*?`{3,})/g;
  return text.split(fence).filter((s) => s.trim().length > 0);
}

/** Splits a section's text when above MAX_CHUNK_CHARS, never touching code blocks. */
function splitLongText(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text];
  const segments = tokenizeByCodeFences(text);
  const parts: string[] = [];
  let current = "";
  for (const seg of segments) {
    // A segment that is longer than the threshold on its own (e.g. an OpenAPI
    // spec) stays whole: a large but coherent chunk beats a half-split JSON.
    if ((current + "\n\n" + seg).length > MAX_CHUNK_CHARS && current.length > 0) {
      parts.push(current.trim());
      current = seg;
    } else {
      current = current ? current + "\n\n" + seg : seg;
    }
  }
  if (current.trim()) parts.push(current.trim());
  // Further split only free-text segments that are still too long.
  return parts.flatMap((p) => {
    if (p.length <= MAX_CHUNK_CHARS || tokenizeByCodeFences(p).length > 1) return [p];
    return p.split(/\n\n+/).reduce<string[]>((acc, para) => {
      const last = acc[acc.length - 1];
      if (last && (last + "\n\n" + para).length <= MAX_CHUNK_CHARS) acc[acc.length - 1] = last + "\n\n" + para;
      else acc.push(para);
      return acc;
    }, []);
  });
}

/**
 * Merge pass: tiny chunks (< MIN_CHUNK_CHARS) have no standalone meaning
 * at retrieval time → they are merged into the next chunk of the same page
 * (or the previous one if they are last).
 */
const MIN_CHUNK_CHARS = 150;
function mergeTinyChunks(chunks: Chunk[]): Chunk[] {
  const merged: Chunk[] = [];
  for (const c of chunks) {
    if (c.char_count < MIN_CHUNK_CHARS && merged.length > 0 && merged[merged.length - 1].source_url === c.source_url) {
      const prev = merged[merged.length - 1];
      const content = prev.content + "\n\n" + c.content.replace(/^# .+\n\n/, "");
      const hash = createHash("sha256").update(content).digest("hex");
      merged[merged.length - 1] = { ...prev, content, content_hash: hash, id: hash.slice(0, 16), char_count: content.length };
    } else {
      merged.push(c);
    }
  }
  return merged;
}

function chunkPage(filename: string, sourceUrl: string): Chunk[] {
  const raw = readFileSync(path.join(RAW_DIR, filename), "utf-8");
  const md = cleanMarkdown(raw);

  // Page title = first H1 heading; fallback to the filename.
  const h1 = md.match(/^# (.+)$/m);
  const pageTitle = h1 ? h1[1].trim() : filename.replaceAll("__", " / ").replace(".md", "");

  // Split on ## and ### sections, keeping the pre-section intro text.
  const sections: { section: string; body: string }[] = [];
  const parts = md.split(/^(?=#{2,3} )/m);
  const intro = parts[0].replace(/^# .+$/m, "").trim();
  if (intro.length > 80) sections.push({ section: "(intro)", body: intro });

  for (const part of parts.slice(1)) {
    const lines = part.split("\n");
    const heading = lines[0].replace(/^#{2,3} /, "").trim();
    const body = lines.slice(1).join("\n").trim();
    if (body.length > 40) sections.push({ section: heading, body });
  }

  // Build the final chunks: prepended context + splitting of long pieces.
  const chunks: Chunk[] = [];
  for (const s of sections) {
    for (const piece of splitLongText(s.body)) {
      const content = `# ${pageTitle} > ${s.section}\n\n${piece}`;
      const hash = createHash("sha256").update(content).digest("hex");
      chunks.push({
        id: hash.slice(0, 16),
        source_url: sourceUrl,
        page_title: pageTitle,
        section: s.section,
        content,
        content_hash: hash,
        char_count: content.length,
      });
    }
  }
  return chunks;
}

// --- main ---
const urlMap = loadUrlMap();
const allChunks: Chunk[] = [];

for (const filename of readdirSync(RAW_DIR).filter((f) => f.endsWith(".md"))) {
  const url = urlMap.get(filename) ?? `https://docs.michelangelo.land/${filename}`;
  allChunks.push(...mergeTinyChunks(chunkPage(filename, url)));
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
