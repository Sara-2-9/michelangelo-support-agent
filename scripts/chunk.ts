/**
 * Step 1 — Structure-aware chunking della documentazione Michelangelo.
 *
 * Strategia: ogni pagina markdown viene spezzata sulle sezioni (## / ###).
 * Ogni chunk "eredita" il contesto: titolo pagina + titolo sezione vengono
 * PREPESI al testo, così il chunk è auto-contenuto anche fuori dalla pagina
 * (risolve il problema del "contesto spezzato" nel retrieval).
 *
 * Ogni chunk ha un content_hash (SHA-256): è la base del sync incrementale
 * della Fase 1b — ri-embedderemo solo i chunk il cui hash è cambiato.
 *
 * Output: corpus/chunks.json + statistiche per ispezione umana.
 * NON fare mai embedding prima di aver ispezionato i chunk a occhio.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const RAW_DIR = "corpus/raw";
const URLS_FILE = "corpus/urls.txt";
const OUT_FILE = "corpus/chunks.json";

// Lunghezza target: sopra questa soglia una sezione viene spezzata sui paragrafi.
// ~2000 caratteri ≈ 500 token: abbastanza contesto per rispondere,
// abbastanza poco rumore per un retrieval preciso.
const MAX_CHUNK_CHARS = 2000;

interface Chunk {
  id: string;            // hash corto, chiave stabile per upsert su Supabase
  source_url: string;    // serve per le citazioni nella risposta (Fase 2)
  page_title: string;
  section: string;       // titolo della sezione di appartenenza
  content: string;       // testo finale che verrà embeddato (contesto + corpo)
  content_hash: string;  // SHA-256 di content → sync incrementale
  char_count: number;
}

/** Mappa nome-file-locale → URL sorgente (stesso ordine usato in download). */
function loadUrlMap(): Map<string, string> {
  const urls = readFileSync(URLS_FILE, "utf-8").trim().split("\n");
  const map = new Map<string, string>();
  for (const url of urls) {
    const name = url.replace("https://docs.michelangelo.land/", "").replaceAll("/", "__");
    map.set(name, url);
  }
  return map;
}

/** Rimuove il boilerplate Mintlify (indice in testa, componenti JSX, card finali). */
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
    .replace(/```\n> ## Documentation Index[\s\S]*?```/g, "") // alcune pagine lo wrappano in code block
    .trim();
}

/**
 * Spezza il testo in segmenti rispettando i fence di codice (``` o ````):
 * i code block sono ATOMICI — mai spezzare dentro un fence.
 * Restituisce segmenti alternati: testo libero / code block.
 */
function tokenizeByCodeFences(text: string): string[] {
  // Cattura blocchi fenced con 3+ backtick, inclusi i fence di apertura/chiusura.
  const fence = /(`{3,}[\s\S]*?`{3,})/g;
  return text.split(fence).filter((s) => s.trim().length > 0);
}

/** Spezza il testo di una sezione se supera MAX_CHUNK_CHARS, senza mai toccare i code block. */
function splitLongText(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text];
  const segments = tokenizeByCodeFences(text);
  const parts: string[] = [];
  let current = "";
  for (const seg of segments) {
    // Un segmento più lungo della soglia da solo (es. spec OpenAPI) resta intero:
    // meglio un chunk grande ma coerente che uno spezzato a metà JSON.
    if ((current + "\n\n" + seg).length > MAX_CHUNK_CHARS && current.length > 0) {
      parts.push(current.trim());
      current = seg;
    } else {
      current = current ? current + "\n\n" + seg : seg;
    }
  }
  if (current.trim()) parts.push(current.trim());
  // Spezza ulteriormente solo i segmenti di testo libero ancora troppo lunghi.
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
 * Merge pass: i chunk minuscoli (< MIN_CHUNK_CHARS) non hanno significato autonomo
 * nel retrieval → vengono fusi nel chunk successivo della stessa pagina
 * (o nel precedente se sono l'ultimo).
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

  // Titolo pagina = primo heading H1; fallback sul nome file.
  const h1 = md.match(/^# (.+)$/m);
  const pageTitle = h1 ? h1[1].trim() : filename.replaceAll("__", " / ").replace(".md", "");

  // Spezza sulle sezioni ## e ###, mantenendo il testo introduttivo pre-sezione.
  const sections: { section: string; body: string }[] = [];
  const parts = md.split(/^(?=#{2,3} )/m);
  const intro = parts[0].replace(/^# .+$/m, "").trim();
  if (intro.length > 80) sections.push({ section: "(introduzione)", body: intro });

  for (const part of parts.slice(1)) {
    const lines = part.split("\n");
    const heading = lines[0].replace(/^#{2,3} /, "").trim();
    const body = lines.slice(1).join("\n").trim();
    if (body.length > 40) sections.push({ section: heading, body });
  }

  // Costruisce i chunk finali: contesto prepeso + split dei pezzi lunghi.
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

// --- statistiche per ispezione umana ---
const lengths = allChunks.map((c) => c.char_count).sort((a, b) => a - b);
const avg = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
console.log(`\n✅ ${allChunks.length} chunk da ${urlMap.size} pagine`);
console.log(`   lunghezza: min ${lengths[0]} | media ${avg} | max ${lengths[lengths.length - 1]} caratteri`);
console.log(`\n   I 5 chunk più grandi (candidati a rivedere MAX_CHUNK_CHARS):`);
for (const c of [...allChunks].sort((a, b) => b.char_count - a.char_count).slice(0, 5)) {
  console.log(`   ${c.char_count.toString().padStart(5)} | ${c.page_title} > ${c.section}`);
}
console.log(`\n   Salvati in ${OUT_FILE}`);
