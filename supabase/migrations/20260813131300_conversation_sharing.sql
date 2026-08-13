-- ============================================================
-- Conversation sharing — public read-only links
-- share_token: random, unguessable, unique; NULL = not shared.
-- Public reads go through the Worker (service key, token lookup),
-- so RLS stays untouched: NO anonymous SELECT policy is added —
-- conversations/messages remain readable by their owner only.
-- ============================================================

alter table conversations
  add column share_token text unique;

-- Fast lookup by token for the public GET /api/share/:token endpoint
create index conversations_share_token_idx on conversations (share_token)
  where share_token is not null;
