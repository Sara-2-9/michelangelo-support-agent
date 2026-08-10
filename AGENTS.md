# AGENTS.md — Michelangelo Support Agent

This file is written for AI coding agents. It describes the project as it is today, assuming no prior knowledge.

## Project overview

AI support agent for users of [Michelangelo](https://michelangelo.land) (an iOS vibe-coding app that builds Expo/React Native apps from natural language). It answers support questions using **only the official documentation**, with source citations (RAG), and refuses what the docs do not cover. Educational/portfolio project, not officially affiliated with Michelangelo.

## Current status and next step

**Completed**: Phase 0 (corpus), Phase 1 (chunking + embeddings → Supabase), Phase 2 (deterministic RAG agent), Phase 3 (orchestration: router, bug-report, troubleshooting, memory, logging, escalation), Phase 4 (eval harness: 25-case golden dataset, hybrid rule-based + LLM-judge metrics, 100% pass after calibration). Security: RLS default-deny on all tables. Phase 5.1 (Cloudflare Worker API): `src/worker.ts` exposes `GET /api/health` and `POST /api/chat` (message validation ≤4000 chars, creates a conversation with channel "web" when no `conversationId` is passed, returns answer + intent + sources). CORS is `*` for now — restrict to the real origin at deploy time (marked in code). Phase 5.2 (React UI): Vite SPA in `web/` served as Workers Static Assets through `@cloudflare/vite-plugin` — one `npm run dev` runs UI + Worker together. Phase 5.3 (Supabase Auth): automatic anonymous sign-in (must be enabled in the Supabase dashboard), conversation sidebar, magic-link account claim (same user id, history preserved). Security model: browser reads go DIRECT to Supabase (publishable key + RLS SELECT policies: `conversations_select_own`, `messages_select_own`, `chunks_select_all`); ALL writes go through the Worker, which requires `Authorization: Bearer <JWT>`, verifies it via `auth.getUser()`, and enforces ownership (403 on foreign conversations/messages, 401 without token). E2E verified: 401/403/RLS isolation/public chunks/write-block all pass. Phase 5.4 (public deploy): LIVE at https://michelangelo-support-agent.moro-sara29.workers.dev — SPA + API in one deploy, CORS locked to the Worker's own origin (derived from the request URL, no config). Production verified: cold/warm chat, memory, 401 without token.

**Deploy learnings (Phase 5.4)**: (1) The Workers-AI-only API token CANNOT deploy — use `wrangler login` OAuth (scopes include workers:write). (2) Wrangler AUTO-LOADS the project `.env`, so `CLOUDFLARE_API_TOKEN` there shadows the OAuth login: run wrangler from a neutral cwd with `-c <abs config path>` (OAuth), or unset the var. (3) `vite build` emits a self-contained `web/dist/michelangelo_support_agent/wrangler.json` — `npm run deploy` = build + deploy that config. (4) Transient "error code: 1042" right after first deploy (edge propagation); top-level try/catch in the Worker now converts any crash into a JSON 500 + console.error visible via `wrangler tail`.

**Phase 6 (UI restyle, branch `restyle`, merged via PR)**: Figma-driven restyle completed — design tokens in `web/src/index.css` `@theme` (dark `#262626` surface, 4-color brand gradient used in the composer + user popover, light borders), React Router (`/` chat + `/auth` magic-link page), Font Awesome icons, react-markdown + Tailwind Typography for assistant answers, day dividers in the message list, dynamic intent badge from `messages.intent`, avatar popover (email + Sign out), sidebar entries showing the FIRST user message of each conversation via PostgREST resource embedding (`select("…, messages(content)")` + `.eq("messages.role","user")` + `referencedTable` order/limit — one round trip, no migration). Prompt change: agents no longer write a "Sources" section — the UI renders structured sources; retrieval normalizes source URLs to the public web pages (strips `.md`). Eval re-run after the prompt change: 100% (25/25). Merged to `main` with a GitHub PR using "Create a merge commit" (full branch history preserved — no squash, no rebase) and deployed.

**Phase 7 (multi-method sign-in, LIVE)**: `/auth` offers email magic link OR Google OAuth. Magic links pass `emailRedirectTo: window.location.origin` (allow-listed origins in Supabase → URL Configuration; Site URL = production origin — the default localhost:3000 breaks prod). Google: anonymous users → `linkIdentity` (requires "Allow manual linking" in Supabase; history preserved, same user id); already-registered identities → automatic plain `signInWithOAuth` fallback. Magic-link emails go through custom SMTP (Resend) — unrelated to Google OAuth, needed only for the email flow. Identity changes remount the chat subtree: `ChatProvider key={userId}` in `App.tsx` + render-phase `localStorage` cleanup, so messages/composer/draft never leak across sign out/login.

**Restyle/mobile learnings**: (1) iOS 26 Safari (Liquid Glass) IGNORES `theme-color` and background-image gradients — it tints its top/bottom chrome from the body's solid `background-color`; the "fixed strip near the edge" trick for per-bar colors is unreliable across 26.x (WebKit bugs). (2) iOS Safari auto-zooms on focus when input font-size < 16px — keep inputs ≥16px on mobile, never `user-scalable=no`. (3) Use `h-dvh`, never `h-screen`, for mobile full-height layouts; `viewport-fit=cover` + `env(safe-area-inset-*)` padding for notch/home-indicator. (4) After deleting design tokens, grep for their utility classes — TypeScript cannot catch missing Tailwind classes (a removed `muted` token made the thinking dots invisible). (5) Supabase anonymous-claim (`updateUser({email})`) works only once per email — an already-registered email must fall back to `signInWithOtp({ shouldCreateUser: false })`, or the user gets "already been registered" after sign-out. (6) A `conversationId` left in localStorage from a previous identity fails the Worker ownership check (403) — the client retries transparently as a new conversation instead of surfacing the error.

**Auth/OAuth learnings (Phase 7)**: (1) OAuth callback errors arrive IN THE URL after the redirect round-trip — a try/catch at the call site never sees them; handle them at app bootstrap by parsing `?error_code=`. (2) `linkIdentity` fails server-side with `email_exists` (Google email already owns an account) or `identity_already_exists` (Google identity linked by a previous login) — both mean "plain OAuth login into the existing account". (3) `linkIdentity` requires Supabase "Allow manual linking" ("Manual linking is disabled" otherwise). (4) `key={userId}` remount is the robust way to reset client state on identity change — better than manually clearing each piece of state. (5) Supabase's built-in email is dev-only (~2-4 emails/hour, "email rate limit exceeded") — production magic links need custom SMTP; Google OAuth needs no SMTP at all.

**Phase 8 (legal & account management)**: `/privacy` + `/terms` routes rendering markdown from `web/src/constants/legal.ts` (single source of truth) through one shared `LegalPage` — GDPR privacy policy tailored to the real sub-processors (Supabase, Cloudflare Workers AI, Resend, Google) and ToS with AI-accuracy disclaimer + non-affiliation notice. **Self-service account deletion**: `DELETE /api/account` in the Worker (JWT-verified, self-only) → `supabase.auth.admin.deleteUser` — the `auth.users` FK cascade wipes conversations+messages; UI confirmation dialog ("Are you sure?") before the call. Cookie-consent banner (`cookie-banner.tsx`, choice in localStorage; only strictly-necessary storage exists — no tracking cookies). Account panel = right slide-over (mirrors the sidebar overlay pattern) with Google avatar from `user_metadata.avatar_url|picture` (also replaces the header user icon when present), Sign out / Delete Account, legal links. Reusable primitives: `ui/button.tsx` (variant dark/light/surface/danger, icon, iconPosition, iconSpin) and `ui/icon-button.tsx` (round icon-only, required aria label). Empty-state layout: composer CENTERED with legal footer pinned at the bottom (`peer-focus-within:hidden` — never rides the iOS keyboard); after the first message the standard layout returns and the footer disappears. App icon: `web/public/` (favicon 64, apple-touch 180, header/sidebar 96/512). Anonymous users see the conversation list but clicking one redirects to `/auth`. Legal pages use `navigate(-1)` "Back" (falls back to "/" on direct visits). **FontAwesome gotcha**: `bars-sort` is a PRO icon — the free lookalike is `faBarsStaggered`.

**Next step**: the project is feature-complete and LIVE: https://michelangelo-support-agent.moro-sara29.workers.dev — Phase 1b docs auto-sync runs daily at 05:37 UTC via Cron Trigger. Optional follow-ups discussed: CI via GitHub Actions (typecheck + eval on PRs), code-splitting the JS bundle (>500 kB warning), publishing the Google OAuth consent screen (currently "Testing" — only test users can sign in with Google; the public `/privacy` URL unblocked by Phase 8 is a prerequisite).

**Phase 1b notes**: chunking/embeddings logic lives in `src/lib/chunking.ts` + `src/lib/embeddings.ts` (shared by local scripts AND the Worker — single source of truth; Web Crypto hashing, identical output to node:crypto). `src/lib/docs-sync.ts` fetches `/llms.txt` + pages over HTTP, diffs content_hash, embeds only the delta, deletes stale chunks; `parseDocsIndex` is reused by `scripts/fetch-corpus.ts` (reproducible local snapshot). First live test caught a real docs change (new MCP server page: 42→43 pages). Local cron test: `wrangler dev --test-scheduled` + `curl "localhost:8787/__scheduled?cron=37+5+*+*+*"` (needs `assets.directory` in root wrangler.toml).

**Eval discipline**: `npm run eval` before any prompt/threshold/model change. A 100% pass rate means "the current dataset is covered" — grow the dataset with harder cases, don't celebrate. Eval runs do NOT write to the conversations/messages tables (no conversationId passed).

## Tech stack

- **TypeScript** (ESM, `"type": "module"`), executed with `tsx` — no build step
- **Mastra** (`@mastra/core`) — agent framework; deterministic RAG pipeline today, workflows planned
- **Cloudflare Workers AI** — embeddings `@cf/baai/bge-m3` (1024-dim, multilingual) and LLM `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, both via REST; the LLM is called through the account's **OpenAI-compatible endpoint** (`/ai/v1`) with `@ai-sdk/openai-compatible`
- **Supabase (Postgres + pgvector)** — vector store; `@supabase/supabase-js`
- Planned but not yet present: Mastra workflows, Cloudflare Cron Triggers

## Repository structure

```
corpus/
  raw/            42 .md pages from the official docs (one per line of urls.txt;
                  filename = URL path with "/" → "__")
  urls.txt        ordered URL → local file mapping (used by chunk.ts)
  llms.txt        machine-readable index of the source docs
  chunks.json     generated output of `npm run chunk` — gitignored, reproducible
scripts/
  fetch-corpus.ts Step 0: downloads live docs → corpus/raw/ + urls.txt + llms.txt
  chunk.ts        Step 1: local corpus → corpus/chunks.json (uses src/lib/chunking)
  embed.ts        Step 2: embeddings → incremental upsert to Supabase
  test-query.ts   retrieval-only smoke test (npm run query -- "...")
  chat.ts         interactive REPL with memory + logging (npm run chat)
  test-memory.ts  multi-turn memory smoke test (npm run test:memory)
  patch-unicorn-magic.mjs  postinstall patch: fixes esbuild resolving unicorn-magic
                  without npm-run-path exports when bundling for workerd
src/
  worker.ts       Cloudflare Worker API: GET /api/health, POST /api/chat,
                  POST /api/feedback, DELETE /api/account (self-service
                  GDPR erasure — auth user deletion cascades to history)
  orchestrator.ts entry point: intent routing → handler dispatch + logging
  router.ts       intent classification (few-shot, small model)
  agent.ts        support_question handler: deterministic RAG (answer())
  handlers/
    bug-report.ts       raw report → structured issue draft
    troubleshooting.ts  guided diagnostic checklists
  lib/
    retrieval.ts  shared "question → chunks" module (embed + match_chunks)
    logging.ts    conversations/messages persistence + history loading
    models.ts     central model registry — the ONLY place model IDs live
    chunking.ts   structure-aware chunking (shared: local scripts + Worker sync)
    embeddings.ts Workers AI bge-m3 batch embedding with adaptive splitting
    docs-sync.ts  Phase 1b: HTTP docs fetch → hash diff → delta embed + stale cleanup
supabase/
  config.toml     Supabase CLI local config (created by `supabase init`)
  migrations/     versioned DB schema — apply with `supabase db push`
web/              React SPA (Phase 5.2, restyled in Phase 6) — Vite root, own tsconfig, Tailwind CSS v4
  index.html      viewport-fit=cover + theme-color (older iOS only; iOS 26 samples body bg)
  public/         app icon set: favicon.png (64), apple-touch-icon.png (180),
                  icon-96.png (header), icon-512.png (sidebar brand)
  src/
    App.tsx            composition only (Providers + Routes: / chat, /auth, /privacy, /terms; ChatProvider key={userId} remounts on identity change; Shell swaps centered-composer empty layout ↔ standard chat)
    index.css          Tailwind v4 entry: @import + @plugin typography + @theme design tokens
    types/chat.ts      shared types (ChatMessage, Source, ChatResponse, ConversationSummary)
    constants/         static data (intent labels, storage keys, legal.ts = Privacy Policy + ToS markdown — single source of truth for /privacy and /terms)
    lib/api.ts         the ONLY file that knows HTTP/endpoints (adds Bearer JWT)
    lib/supabase.ts    browser client — DIRECT reads only, scoped by RLS
    context/auth.tsx   AuthProvider + useAuth() — anonymous session, email claim w/ OTP login fallback, Google OAuth (linkIdentity + URL-error fallback), deleteAccount (Worker → admin.deleteUser → fresh anonymous session)
    context/chat.tsx   ChatProvider + useChat() — conversation state, sidebar data (embedded preview), stale-id retry
    hooks/             reusable logic (use-auto-scroll)
    pages/             route pages (auth-page: magic-link + Google; legal-page: shared renderer for /privacy and /terms, dynamic history Back)
    components/        feature components (chat-header, message-list, conversation-sidebar, user-menu = right slide-over account panel w/ avatar + delete flow, composer, cookie-banner, app-footer, …)
    components/ui/     primitives (button = variant/icon/iconPosition/spin, icon-button = round icon-only, intent-badge, feedback-buttons, markdown, thinking-indicator)
  .env.example      VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (publishable — public by design)
vite.config.ts    Vite root=web + tailwindcss() + cloudflare({ configPath: <repo-root wrangler.toml> }) + alias @/→web/src
wrangler.toml     Worker config; [assets] not_found_handling = "single-page-application"
```

## Commands

```bash
npm install                       # install dependencies
npm run chunk                     # corpus/raw/*.md → corpus/chunks.json (+ stats)
npm run embed                     # incremental embeddings → Supabase (requires .env)
npm run query -- "question"       # retrieval only, with similarity scores
npm run chat                      # interactive chat (memory + DB logging)
npm run chat -- --resume <uuid>   # resume a logged conversation
npm run test:memory               # multi-turn memory smoke test
npx wrangler dev                  # local Worker API only on :8787 (reads .dev.vars)
npm run dev                       # full app: React UI + Worker in one server (:5173)
npm run build                     # production build → web/dist (client + worker bundle)
npm run typecheck                 # type check BOTH backend (root tsconfig) and web/
```

No tests, linter, formatter or build step are configured (the eval harness of Phase 4 will change this).

## Setup and environment variables

Copy `.env.example` to `.env` and fill in: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`. Scripts load `.env` with a manual parser (no dotenv) and fail at startup if a variable is missing or still a placeholder.

## Conventions and design decisions to preserve

- **Language**: code comments, docs, log messages and commit messages are in **English**. All prompts/instructions for AI models are in English too (better model performance, predictable behavior); user language affects only the OUTPUT — answers mirror the user's language, defaulting to English.
- **Model registry** (`src/lib/models.ts`): the ONLY place model IDs live. Serverless models get deprecated without warning (llama-3.1-8b died mid-development) — check status at https://developers.cloudflare.com/workers-ai/models/. Model routing by task complexity: 3B for classification/summaries, 70B for answers.
- **Intent routing** (`src/router.ts`): few-shot examples + explicit disambiguation rule (REPORT → bug_report vs FIX → troubleshooting). Intent boundaries are measured, not guessed — borderline cases go to the Phase 4 golden dataset.
- **Logging & memory**: every exchange is persisted (`conversations`/`messages` tables) with intent, sources, similarity, latency, model. History (last 10 messages) is passed as context for follow-up questions. Conversations are resumable (`ended_at` NULL) — the Phase 5 UI reads these same tables. user_id is nullable until Supabase Auth (Phase 5), then per-table RLS with `user_id = auth.uid()`.
- **Escalation**: ungrounded answers on real support intents mark the conversation `escalated=true` with an auto-generated operator summary (small model). off_topic refusals never escalate.
- **Architecture: deterministic RAG, not agentic tool calling.** Two reasons: (1) Workers AI's OpenAI-compatible endpoint rejects serialized tool-call history (assistant `content: null` + `tool_calls`), so multi-turn tool calling fails with a 400; (2) single-hop support Q&A is more predictable, cheaper and easier to evaluate with retrieve→generate. Agent orchestration will live in explicit Mastra workflows (Phase 3), not in a free tool-calling loop.
- **Anti-hallucination guardrail**: retrieval threshold `minSimilarity = 0.45` (measured: relevant ~55-70%, out-of-scope ~33%). When retrieval returns nothing, `answer()` returns a fixed honest refusal WITHOUT calling the LLM.
- **Chunking** (`scripts/chunk.ts`):
  - split on `##`/`###` sections; every chunk is prepended with `# Page title > Section`
  - fenced code blocks are **atomic**: never split inside a fence
  - thresholds: `MAX_CHUNK_CHARS = 2000`, `MIN_CHUNK_CHARS = 150` (tiny chunks merged into a same-page neighbor)
  - every chunk carries a SHA-256 `content_hash`; `id` = short hash (16 chars), stable key for upserts
  - explicit in-code rule: **never embed before inspecting the chunks by eye**
- **Indexing** (`scripts/embed.ts`): idempotent and incremental — `content_hash` comparison, re-embeds only the delta, deletes chunks gone from the docs. Token-aware batching with conservative estimate (1 char/token: the real bge-m3 tokenizer counts ~3x more on dense YAML), 25-text cap per request, and adaptive recursive splitting on provider context overflow.
- **Database** (`supabase/migrations/`): `chunks` table with `embedding vector(1024)`, HNSW cosine index, index on `content_hash`, RPC `match_chunks(query_embedding, match_count, min_similarity)`. Never edit the SQL of an already-applied migration — add a new one. If you change the embedding model, update the vector dimension in a new migration.
- **Shared retrieval** lives ONLY in `src/lib/retrieval.ts` — do not duplicate embed/RPC logic elsewhere.

## Security

- **Never commit `.env`** (already in `.gitignore`); the Supabase service role key runs only in local scripts/backend, never in the browser.
- **RLS is ENABLED on all tables** — Phase 5.3 added SELECT-only policies: `conversations_select_own` / `messages_select_own` (`auth.uid() = user_id`, messages via parent conversation), `chunks_select_all` (public knowledge base). No INSERT/UPDATE/DELETE policies exist: all writes go through the Worker (service key) after JWT verification + ownership checks. Rule: RLS on at table creation, policies added only when access is needed.
- Cloudflare API token with minimal permissions (Workers AI → Read).
