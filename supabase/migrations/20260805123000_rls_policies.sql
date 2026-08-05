-- ============================================================
-- Phase 5.3 — Final RLS policies.
--
-- Posture so far (20260804105603_enable_rls.sql): RLS ENABLED on all
-- tables with ZERO policies = default-deny; only the service key
-- (backend/Worker) could read or write anything.
--
-- Now the browser reads DIRECTLY from Supabase (anon key + user JWT)
-- for the conversation sidebar, so we open exactly what is needed:
--   conversations → SELECT only your own rows
--   messages      → SELECT only messages of your own conversations
--   chunks        → SELECT for everyone (public knowledge base)
--
-- Nothing else is opened: all writes still go through the Worker
-- (service key). This is why exposing the anon key to the browser
-- is safe BY DESIGN — RLS is the authorization layer.
-- ============================================================

-- 1. conversations: each user reads only their own conversations
create policy "conversations_select_own"
  on public.conversations for select
  using (auth.uid() = user_id);

-- 2. messages: readable only when the parent conversation is yours
create policy "messages_select_own"
  on public.messages for select
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.user_id = auth.uid()
  ));

-- 3. chunks: the knowledge base is public, read-only for all
create policy "chunks_select_all"
  on public.chunks for select
  using (true);
