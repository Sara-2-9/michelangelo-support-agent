-- ============================================================
-- Michelangelo Support Agent — knowledge base schema
-- Applied via Supabase CLI migrations (supabase db push)
-- ============================================================

-- 1. pgvector extension: adds the "vector" type to Postgres
create extension if not exists vector;

-- 2. Documentation chunks table.
--    content_hash is the key of the incremental sync (Phase 1b):
--    we re-embed only chunks whose hash is not already present.
create table if not exists chunks (
  id            text primary key,        -- short hash, stable across re-runs
  content       text not null,           -- text with prepended context
  embedding     vector(1024),            -- bge-m3: 1024 dimensions
  source_url    text not null,           -- for citations (Phase 2)
  page_title    text not null,
  section       text not null,
  content_hash  text not null,           -- SHA-256 of content
  char_count    integer not null,
  updated_at    timestamptz not null default now()
);

-- 3. HNSW index: makes vector similarity search fast (O(log n))
--    cosine distance: standard for normalized text embeddings.
create index if not exists chunks_embedding_hnsw
  on chunks using hnsw (embedding vector_cosine_ops);

-- 4. Fast lookup for the incremental sync
create index if not exists chunks_content_hash_idx on chunks (content_hash);

-- 5. RPC function for semantic retrieval.
--    The backend calls it with the embedding of the user's question
--    and receives the k most similar chunks above a minimum threshold.
create or replace function match_chunks(
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
  similarity float
)
language sql stable
as $$
  select
    id, content, source_url, page_title, section,
    1 - (embedding <=> query_embedding) as similarity
  from chunks
  where 1 - (embedding <=> query_embedding) > min_similarity
  order by embedding <=> query_embedding
  limit match_count;
$$;
