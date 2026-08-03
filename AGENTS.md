# AGENTS.md — Michelangelo Support Agent

This file is written for AI coding agents. It describes the project as it is today, assuming no prior knowledge.

## Project overview

AI support agent for users of [Michelangelo](https://michelangelo.land) (an iOS vibe-coding app that builds Expo/React Native apps from natural language). It answers support questions using **only the official documentation**, with source citations (RAG). Educational/portfolio project, not officially affiliated with Michelangelo.

**Current status**: Phase 0 (corpus) and Phase 1 (chunking + embeddings pipeline → Supabase) are complete. Later phases (Mastra agent, tool orchestration, evals, React UI, Cloudflare deployment) **do not exist in the code yet** — see the roadmap in `README.md`.

## Tech stack

- **TypeScript** (ESM, `"type": "module"`), executed with `tsx` — no build step
- **Supabase (Postgres + pgvector)** — vector store; `@supabase/supabase-js` client (only runtime dependency)
- **Cloudflare Workers AI** — embeddings via REST API, model `@cf/baai/bge-m3` (1024 dimensions, multilingual: Italian queries → English docs)
- Planned but not yet present: Mastra (agent orchestration), Cloudflare Workers/Pages/Cron (serving and deployment)

## Repository structure

```
corpus/
  raw/            42 .md pages from the official docs (one per line of urls.txt;
                  filename = URL path with "/" → "__")
  urls.txt        ordered URL → local file mapping (used by chunk.ts)
  llms.txt        machine-readable index of the source docs
  chunks.json     generated output of `npm run chunk` — gitignored, reproducible
scripts/
  chunk.ts        Step 1: structure-aware chunking → corpus/chunks.json
  embed.ts        Step 2: embeddings → incremental upsert to Supabase
supabase/
  schema.sql      DB schema, to be run ONCE in the Supabase SQL Editor
```

Note: the `README.md` mentions CLI-based migrations as the planned next step, but today the schema lives in `supabase/schema.sql` and is applied manually from the SQL Editor (not via `supabase db push`).

`src/` does not exist yet, although it is included in `tsconfig.json` — it is the designated location for future-phase code.

## Commands

```bash
npm install          # install dependencies
npm run chunk        # corpus/raw/*.md → corpus/chunks.json (+ stats)
npm run embed        # incremental embeddings → Supabase (requires .env)
```

No tests, linter, formatter or build step are configured. Validate code with `npx tsc --noEmit` (strict tsconfig).

## Setup and environment variables

Copy `.env.example` to `.env` and fill in: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`. `embed.ts` loads `.env` with a manual parser (no dotenv) and fails at startup if a variable is missing or still a placeholder.

## Conventions and design decisions to preserve

- **Language**: comments, documentation, log messages and commit messages are in **English**; keep it that way in new code.
- **Chunking** (`scripts/chunk.ts`):
  - split on `##`/`###` sections; every chunk is prepended with the context `# Page title > Section` (self-contained chunks for retrieval)
  - fenced code blocks are **atomic**: never split inside a fence
  - thresholds: `MAX_CHUNK_CHARS = 2000`, `MIN_CHUNK_CHARS = 150` (tiny chunks merged into a same-page neighbor)
  - every chunk carries a SHA-256 `content_hash`; `id` = short hash (16 chars), stable key for upserts
  - explicit in-code rule: **never embed before inspecting the chunks by eye** (the script prints stats for exactly this purpose)
- **Indexing** (`scripts/embed.ts`): idempotent and incremental — `content_hash` comparison, re-embeds only the delta, deletes chunks that disappeared from the docs. Batches: 50 texts per Workers AI call, 100 rows per upsert.
- **Database** (`supabase/schema.sql`): `chunks` table with `embedding vector(1024)`, HNSW cosine index, index on `content_hash`, RPC function `match_chunks(query_embedding, match_count, min_similarity)` for semantic retrieval. If you change the embedding model, update the vector dimension.

## Security

- **Never commit `.env`** (already in `.gitignore`); the Supabase service role key runs only in local scripts/backend, never in the browser.
- No auto-RLS: the browser never talks to Supabase directly; per-table RLS only when needed.
- Cloudflare API token with minimal permissions (Workers AI → Read).
