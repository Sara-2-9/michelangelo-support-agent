-- ============================================================
-- Conversations logging — observability, eval material, product insights
-- One row per chat session + one row per message exchange.
-- FK to auth.users is nullable today (CLI/testing); Supabase Auth
-- anonymous sign-in will populate it in Phase 5.
-- ============================================================

-- 1. Conversations: one per chat session (resumable while ended_at is NULL)
create table conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete cascade,
  channel     text not null default 'cli',        -- cli | web | widget
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,                        -- NULL = open, resumable
  escalated   boolean not null default false,     -- key metric: escalation rate
  summary     text                                -- operator handoff / UI preview
);

-- 2. Messages: one per exchange turn
create table messages (
  id                bigint generated always as identity primary key,
  conversation_id   uuid not null references conversations (id) on delete cascade,
  role              text not null check (role in ('user', 'assistant')),
  content           text not null,
  intent            text,                         -- assistant only: router's route
  grounded          boolean,                      -- answer grounded in docs?
  sources           jsonb,                        -- [{source_url, page_title, similarity}]
  similarity_top    real,                         -- best chunk similarity (retrieval health)
  model             text,                         -- generation model used
  latency_ms        integer,                      -- per-intent performance
  feedback          text check (feedback in ('up', 'down')),  -- Phase 5 UI thumbs
  created_at        timestamptz not null default now()
);

-- 3. Indexes for the real query patterns
--    - load a conversation's messages in order (UI + memory context)
create index messages_conversation_idx on messages (conversation_id, created_at);
--    - per-intent metrics (router accuracy, latency by route)
create index messages_intent_idx on messages (intent) where role = 'assistant';
--    - "user's conversations" sidebar (Phase 5 UI)
create index conversations_user_idx on conversations (user_id, started_at desc);

-- NOTE: RLS stays OFF for now (backend-only access via service key).
-- Phase 5 (Supabase Auth): enable per-table RLS with user_id = auth.uid().
