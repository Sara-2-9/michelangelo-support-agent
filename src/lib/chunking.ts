/**
 * Structure-aware chunking of the Michelangelo documentation — shared
 * single source of truth, runtime-agnostic (Node scripts AND the Worker).
 *
 * Strategy: each markdown page is split on its sections (## / ###).
 * Every chunk "inherits" its context: page title + section title are
 * PREPENDED to the text, so the chunk is self-contained even outside
 * its page (solves the "broken context" problem in retrieval).
 *
 * Every chunk carries a content_hash (SHA-256): the foundation of the
 * incremental sync — we re-embed only chunks whose hash has changed.
 * Uses Web Crypto (crypto.subtle), available in Node ≥ 20 and workerd.
 */

export interface Chunk {
  id: string; // short hash, stable key for Supabase upserts
  source_url: string; // used for answer citations
  page_title: string;
  section: string; // title of the containing section
  content: string; // final text to be embedded (context + body)
  content_hash: string; // SHA-256 of content → incremental sync
  char_count: number;
}

// Target length: above this threshold a section is split on paragraphs.
// ~2000 chars ≈ 500 tokens: enough context to answer,
// little enough noise for precise retrieval.
const MAX_CHUNK_CHARS = 2000;

// Tiny chunks (< MIN_CHUNK_CHARS) have no standalone meaning at retrieval
// time → they are merged into a neighbor chunk of the same page.
const MIN_CHUNK_CHARS = 150;

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Removes Mintlify boilerplate (index header, JSX components, trailing cards). */
export function cleanMarkdown(raw: string): string {
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
 */
function tokenizeByCodeFences(text: string): string[] {
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

async function mergeTinyChunks(chunks: Chunk[]): Promise<Chunk[]> {
  const merged: Chunk[] = [];
  for (const c of chunks) {
    if (c.char_count < MIN_CHUNK_CHARS && merged.length > 0 && merged[merged.length - 1].source_url === c.source_url) {
      const prev = merged[merged.length - 1];
      const content = prev.content + "\n\n" + c.content.replace(/^# .+\n\n/, "");
      const hash = await sha256(content);
      merged[merged.length - 1] = { ...prev, content, content_hash: hash, id: hash.slice(0, 16), char_count: content.length };
    } else {
      merged.push(c);
    }
  }
  return merged;
}

/** Chunks one documentation page given its raw markdown and source URL. */
export async function chunkPage(markdown: string, sourceUrl: string): Promise<Chunk[]> {
  const md = cleanMarkdown(markdown);

  // Page title = first H1 heading; fallback to the URL path.
  const h1 = md.match(/^# (.+)$/m);
  const pageTitle = h1 ? h1[1].trim() : sourceUrl.split("/").pop()?.replace(".md", "") ?? sourceUrl;

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
      const hash = await sha256(content);
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
  return mergeTinyChunks(chunks);
}
