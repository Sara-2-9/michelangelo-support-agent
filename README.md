# Michelangelo Support Agent

AI support agent for users of [Michelangelo](https://michelangelo.land) — the iOS vibe-coding app that turns natural language into native Expo/React Native apps.

It answers support questions 24/7 using **only the official documentation**, with precise source citations. Designed for public deployment on Cloudflare.

## Why this project

Michelangelo currently offers support via Discord and email. This agent:

- instantly answers recurring questions (onboarding, limits, integrations, billing, troubleshooting)
- always cites the documentation page its answer is drawn from
- escalates to a human operator when it cannot answer, with a structured summary
- keeps itself up to date when the documentation changes (incremental sync)

## Architecture

```
┌─ Offline indexing (Node scripts) ────────────────────────┐
│  docs.michelangelo.land (MDX via llms.txt)               │
│    → structure-aware chunking (atomic code blocks,       │
│      tiny-chunk merging, SHA-256 content_hash)           │
│    → embeddings (Cloudflare Workers AI, bge-m3,          │
│      multilingual: IT queries → EN docs)                 │
│    → Supabase pgvector (delta-only upserts)              │
└──────────────────────────────────────────────────────────┘
                           ▼
┌─ Online serving (Cloudflare, coming soon) ───────────────┐
│  Pages: chat UI (React)                                  │
│  Worker: Mastra agent → pgvector retrieval → LLM         │
│  Cron Trigger: automatic documentation sync              │
└──────────────────────────────────────────────────────────┘
```

### Key design decisions

| Decision | Rationale |
|---|---|
| Structure-aware chunking on MDX headings | Every chunk inherits its context (page > section): no "broken context" at retrieval time |
| Atomic code blocks | Never split inside a fence: half a YAML/JSON block is useless |
| `content_hash` per chunk | Incremental sync: re-embed only what changed, not the whole corpus |
| Multilingual `bge-m3` | Users ask in Italian, docs are in English: the embedding model is chosen on the query×document language pair |
| Offline indexing / online serving | Cloudflare Workers have no filesystem or CPU budget for indexing: a necessary separation, and best practice anyway |
| Service key server-side only, no auto-RLS | The browser never talks to Supabase directly; per-table RLS when needed |

## Stack

- **TypeScript** end-to-end
- **Mastra** — agent orchestration, tool calling, evals (Phases 2-4)
- **Supabase (pgvector)** — vector store + SQL
- **Cloudflare Workers AI** — embeddings; **Workers + Pages + Cron** — deployment
- Corpus: 42 pages of the official docs (machine-readable `/llms.txt` index)

## Project status (roadmap)

- [x] **Phase 0** — Documentation corpus (42 pages, incl. the new public API)
- [x] **Phase 1** — Structure-aware chunking (221 chunks) + embeddings pipeline → Supabase
- [ ] **Phase 1b** — Automatic docs sync (Cron Trigger + hash-based diff)
- [ ] **Phase 2** — RAG agent with citations (Mastra)
- [ ] **Phase 3** — Tool orchestration: guided troubleshooting, structured bug reports, escalation
- [ ] **Phase 4** — Eval harness with golden dataset and metrics
- [ ] **Phase 5** — React UI + public Cloudflare deployment

## Setup

```bash
npm install
cp .env.example .env   # fill in Supabase + Cloudflare credentials

npm run chunk          # corpus/raw/*.md → corpus/chunks.json
npm run embed          # embeddings → Supabase (incremental)
```

DB schema: `supabase/migrations/` — applied via Supabase CLI (`supabase login` → `supabase link --project-ref <ref>` → `supabase db push`).

## Disclaimer

Educational/portfolio project, not officially affiliated with Michelangelo. The knowledge base is derived entirely from the public documentation.
