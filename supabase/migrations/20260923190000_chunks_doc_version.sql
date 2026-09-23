-- ============================================================
-- Doc versioning for chunks (docs restructure 2026-09: v1 legacy + v2 current)
--
-- The docs URL carries the product version:
--   https://docs.michelangelo.land/v1/... → 'v1' (legacy)
--   https://docs.michelangelo.land/v2/... → 'v2' (current)
--   https://docs.michelangelo.land/api-reference/... → NULL (version-neutral)
--
-- Retrieval must PREFER current (v2 / neutral) chunks over legacy (v1)
-- ones, while keeping v1 reachable when the user asks about it or when
-- no current chunk matches.
-- ============================================================

-- 1. New column (nullable: NULL = version-neutral page, e.g. api-reference)
alter table chunks add column if not exists doc_version text;

-- 2. Backfill existing rows from the source URL
update chunks
set doc_version = substring(source_url from 'docs\.michelangelo\.land/(v[12])/')
where doc_version is null
  and source_url ~ 'docs\.michelangelo\.land/v[12]/';

-- 3. Retrieval: return the version and order current docs first.
--    Within each version group, pure vector similarity still decides.
--    DROP first: CREATE OR REPLACE cannot change a function's return type
--    (we are adding the doc_version output column).
drop function if exists match_chunks(vector(1024), int, float);

create function match_chunks(
  query_embedding vector(1024),
  match_count int default 5,
  min_similarity float default 0.3
)
returns table (
  id text,
  content text,
  source_url text,
  page_title text,
  section text,
  doc_version text,
  similarity float
)
language sql stable
as $$
  select
    id, content, source_url, page_title, section, doc_version,
    1 - (embedding <=> query_embedding) as similarity
  from chunks
  where 1 - (embedding <=> query_embedding) > min_similarity
  order by
    case when doc_version = 'v1' then 1 else 0 end,  -- legacy v1 last
    embedding <=> query_embedding
  limit match_count;
$$;
