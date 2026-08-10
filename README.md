# Michelangelo Support Agent

**Live: https://michelangelo-support-agent.moro-sara29.workers.dev**

AI support agent for users of [Michelangelo](https://michelangelo.land) — the iOS vibe-coding app that turns natural language into native Expo/React Native apps.

It answers support questions 24/7 using **only the official documentation**, with precise source citations, and refuses honestly what the docs do not cover. Deployed publicly on Cloudflare Workers (React SPA + API in a single deploy), with Supabase Auth (anonymous sign-in, email magic link, Google OAuth) and RLS-protected per-user history.

## Why this project

Michelangelo currently offers support via Discord and email. This agent:

- instantly answers recurring questions (onboarding, limits, integrations, billing, troubleshooting)
- always cites the documentation page its answer is drawn from
- refuses out-of-scope questions with a deterministic guardrail (no LLM call, no hallucination risk)
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
┌─ Deterministic RAG agent (Mastra) ───────────────────────┐
│  question → embed → pgvector (similarity threshold 0.45) │
│    → nothing relevant → honest refusal (NO LLM call)     │
│    → relevant chunks  → Llama 3.3 70B (Workers AI)       │
│      → answer in the user's language + Sources           │
└──────────────────────────────────────────────────────────┘
                           ▼
┌─ Online serving (Cloudflare, LIVE) ──────────────────────┐
│  React SPA (chat UI, /auth page) as Workers Static       │
│  Assets + Worker API in ONE deploy                       │
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
| Token-aware + adaptive batching | bge-m3 accepts 60k tokens/request; the local estimate is calibrated on the real tokenizer (dense YAML counts ~3x prose), with recursive batch splitting as a safety net |
| Deterministic RAG over agentic tool calling | Workers AI's OpenAI-compatible endpoint rejects serialized tool-call history; more importantly, single-hop support Q&A is more predictable, cheaper (1 LLM call), and easier to evaluate this way |
| Similarity threshold 0.45 + LLM-free refusal | Measured on this index: relevant queries score ~55-70%, out-of-scope ~33%. A deterministic guardrail cannot hallucinate |
| Offline indexing / online serving | Cloudflare Workers have no filesystem or CPU budget for indexing: a necessary separation, and best practice anyway |
| Service key server-side only, no auto-RLS | The browser never talks to Supabase directly; per-table RLS when needed |

## Stack

- **TypeScript** end-to-end
- **Mastra** — agent framework (deterministic RAG now; workflow orchestration in Phase 3)
- **Cloudflare Workers AI** — embeddings (`bge-m3`) + LLM (`llama-3.3-70b-instruct-fp8-fast`) via OpenAI-compatible endpoint
- **Supabase (pgvector)** — vector store + SQL + Auth (anonymous sign-in + magic link)
- **React 19 + Vite + Tailwind CSS v4** — chat UI; React Router (`/` chat, `/auth` sign-in), Font Awesome icons, react-markdown + Tailwind Typography for rich answers
- Corpus: 43 pages of the official docs (machine-readable `/llms.txt` index)

## Project status (roadmap)

- [x] **Phase 0** — Documentation corpus (42 pages, incl. the new public API)
- [x] **Phase 1** — Structure-aware chunking (221 chunks) + embeddings pipeline → Supabase (retrieval verified: cross-lingual IT→EN, healthy similarity gradient)
- [x] **Phase 1b** — Automatic docs sync: Cron Trigger in the Worker (daily 05:37 UTC) fetches the docs index + pages over HTTP, hash-diffs vs the indexed chunks, embeds only the delta and removes stale sections. First live test caught a real change (new MCP server page: 42→43 pages, 11 chunks re-embedded, 4 removed)
- [x] **Phase 2** — Deterministic RAG agent with citations and anti-hallucination guardrail (Mastra + Llama 70B)
- [x] **Phase 3** — Orchestration: intent router (few-shot, 5/5 routes), bug-report drafts, guided troubleshooting, conversation memory + logging (conversations/messages tables), escalation with auto-generated operator summary
- [x] **Phase 4** — Eval harness: golden dataset (25 cases) + hybrid metrics (rule-based + LLM judge). First run 92% → 100% after label/judge calibration; dataset growth is ongoing
- [x] **Phase 5.1** — Cloudflare Worker API (`src/worker.ts`): `GET /api/health`, `POST /api/chat` (validated, creates/resumes conversations, returns answer + intent + sources). Verified locally with `wrangler dev`
- [x] **Phase 5.2** — React chat UI (Vite SPA in `web/`) served as Workers Static Assets via `@cloudflare/vite-plugin`: one `npm run dev` runs UI (HMR) + Worker (workerd) together; thumbs up/down feedback persisted to `messages.feedback`; conversation resumed via localStorage
- [x] **Phase 5.3** — Supabase Auth: automatic anonymous sign-in, conversation history sidebar (direct browser reads scoped by RLS policies), magic-link account claim preserving history, JWT verification + ownership checks in the Worker (IDOR-safe), writes stay behind the service key only
- [x] **Phase 5.4** — Public deploy on Cloudflare Workers: OAuth login, 4 secrets via `wrangler secret put`, CORS locked to the Worker's own origin, SPA + API live in one deploy. Live at https://michelangelo-support-agent.moro-sara29.workers.dev
- [x] **Phase 6** — Figma-driven UI restyle + UX hardening: design-token palette (dark surface, gradient composer, chat-tail bubbles), React Router (`/` + `/auth` magic-link page), Font Awesome icons, markdown answers (react-markdown + Tailwind Typography), day dividers, dynamic intent badge, sidebar entries showing each conversation's first user message (PostgREST resource embedding, one round trip), thumbs feedback, avatar popover with Sign out. Mobile hardening: `viewport-fit=cover` + safe-area insets, `h-dvh`, 16px inputs (no iOS auto-zoom), iOS 26 Safari chrome tint via solid `background-color` (theme-color is ignored by Liquid Glass). Auth fix: already-registered emails fall back from anonymous-claim to OTP login. Stale `conversationId` after identity change is retried transparently as a new conversation. Model prompts no longer write a "Sources" section — the UI renders structured sources only; source URLs are normalized to the public web pages (`.md` stripped at retrieval). Eval re-verified at 100% (25/25) after the prompt change.
- [x] **Phase 7** — Multi-method sign-in: users choose **email magic link** or **Google OAuth** on `/auth`. Google uses `linkIdentity` to upgrade anonymous accounts (history preserved); OAuth callback errors handled at bootstrap (`email_exists` / `identity_already_exists` → automatic plain Google login into the existing account). Magic links redirect to the current origin (`emailRedirectTo`), allow-listed in Supabase. Custom SMTP via **Resend** for production-grade magic links (built-in service is dev-only). Identity changes (sign out / login) remount the chat subtree via `key={userId}` — no state leaks across identities. Requires Supabase "Allow manual linking" + Google Cloud OAuth client.
- [x] **Phase 8** — Legal & account management: `/privacy` + `/terms` pages (GDPR privacy policy tailored to the real stack — Supabase, Cloudflare Workers AI, Resend, Google OAuth — and ToS with an AI-answers accuracy disclaimer + non-affiliation notice; content in `web/src/constants/legal.ts`, one shared renderer). **Self-service account deletion**: `DELETE /api/account` (JWT-verified, self-only) → `auth.admin.deleteUser` cascades to the whole conversation history; confirmation dialog in the UI. Cookie-consent banner (strictly-necessary storage only, choice persisted). Right slide-over **account panel** with Google avatar (from `user_metadata`), Sign out / Delete Account with confirmation, legal block. Reusable `Button` (variant/icon/iconPosition/spin) and `IconButton` primitives. Centered-composer empty state with bottom legal footer (auto-hides on textarea focus, never rides the iOS keyboard); footer disappears after the first message. App icon as favicon/apple-touch-icon/sidebar brand. Anonymous users see their conversation list but resuming one redirects to `/auth`.

## Setup

```bash
npm install
cp .env.example .env           # backend secrets (Supabase service key + Cloudflare)
cp web/.env.example web/.env   # browser config (Supabase URL + publishable key — public by design)

npm run fetch:corpus              # refresh the local corpus snapshot from live docs
npm run chunk                     # corpus/raw/*.md → corpus/chunks.json
npm run embed                     # embeddings → Supabase (incremental)
npm run query -- "your question"  # retrieval-only smoke test
npm run chat                      # interactive agent chat (memory + logging)
npm run chat -- --resume <uuid>   # resume a logged conversation
npm run test:memory               # multi-turn memory smoke test

npm run dev                       # full app: React UI + Worker, one server (:5173)
npm run build                     # production build → web/dist (client + worker)
npm run deploy                    # wrangler deploy (Phase 5.4)
```

DB schema: `supabase/migrations/` — applied via Supabase CLI (`supabase login` → `supabase link --project-ref <ref>` → `supabase db push`).

Auth: requires in Supabase → Authentication → Sign In / Up: "Anonymous Sign-Ins" enabled, "Allow manual linking" enabled (Google identity linking), and the Google provider configured with a Google Cloud OAuth client (redirect URI = the Supabase callback URL shown in the dashboard). In Authentication → URL Configuration: Site URL = the production origin, Redirect URLs allow-listing the production origin and `http://localhost:5173/**`. The browser uses the publishable key — safe to expose because RLS policies scope every read to the owner; all writes go through the Worker (service key + JWT verification).

Sign-in methods on `/auth`: **email magic link** (first time → claims the anonymous account preserving history; already-registered email → OTP login into the existing account) or **Google OAuth** (anonymous → `linkIdentity` preserving history; Google identity already linked → automatic plain login). Magic-link emails are sent through a **custom SMTP provider (Resend)** configured in Authentication → SMTP Settings — Supabase's built-in email service is dev-only (~2-4 emails/hour).

## Disclaimer

Educational/portfolio project, not officially affiliated with Michelangelo. The knowledge base is derived entirely from the public documentation.
