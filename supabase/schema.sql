-- ============================================================
-- Michelangelo Support Agent — schema knowledge base
-- Da eseguire UNA VOLTA in Supabase → SQL Editor → New query → Run
-- ============================================================

-- 1. Estensione pgvector: aggiunge il tipo "vector" a Postgres
create extension if not exists vector;

-- 2. Tabella dei chunk della documentazione.
--    content_hash è la chiave del sync incrementale (Fase 1b):
--    ri-embedderemo solo i chunk il cui hash non è già presente.
create table if not exists chunks (
  id            text primary key,        -- hash corto, stabile tra re-run
  content       text not null,           -- testo con contesto prepeso
  embedding     vector(1024),            -- bge-m3: 1024 dimensioni
  source_url    text not null,           -- per le citazioni (Fase 2)
  page_title    text not null,
  section       text not null,
  content_hash  text not null,           -- SHA-256 di content
  char_count    integer not null,
  updated_at    timestamptz not null default now()
);

-- 3. Indice HNSW: rende la ricerca per similarità vettoriale veloce (O(log n))
--    cosine distance: standard per gli embedding di testo normalizzati.
create index if not exists chunks_embedding_hnsw
  on chunks using hnsw (embedding vector_cosine_ops);

-- 4. Lookup veloce per il sync incrementale
create index if not exists chunks_content_hash_idx on chunks (content_hash);

-- 5. Funzione RPC per il retrieval semantico.
--    Il backend la chiama con l'embedding della domanda utente
--    e riceve i k chunk più simili sopra una soglia minima.
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
