-- ============================================================
-- Enable Row Level Security on all tables (default-deny).
--
-- Why: these tables are exposed via the PostgREST Data API. With RLS
-- disabled, anyone holding the (public-by-design) anon key could read
-- and write every row. Enabling RLS with NO policies denies all access
-- for the anon/authenticated roles, while the service_role key used by
-- our backend/scripts BYPASSES RLS by design — nothing breaks today.
--
-- Phase 5 (Supabase Auth + UI) will add explicit policies:
--   conversations/messages → user_id = auth.uid()
--   chunks                 → read-only for everyone (public knowledge base)
-- ============================================================

alter table chunks enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

-- Sanity note: do NOT create policies here. No policies = deny all.
-- Policies arrive with Auth in Phase 5, per-table, written explicitly.
