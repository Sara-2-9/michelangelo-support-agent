/**
 * Shared retrieval module — the single place where "question → relevant
 * chunks" happens. Used by the agent's searchDocs tool, by CLI scripts,
 * and later by the Cloudflare Worker (Phase 5).
 *
 * Rule: anything that embeds a query or calls match_chunks lives HERE,
 * not scattered across files.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MODEL_EMBEDDING } from "./models.js";

export interface RetrievedChunk {
  id: string;
  content: string;
  source_url: string;
  page_title: string;
  section: string;
  similarity: number;
}

const EMBEDDING_MODEL = MODEL_EMBEDDING;

export interface RetrievalConfig {
  supabaseUrl: string;
  supabaseKey: string;
  cfAccountId: string;
  cfApiToken: string;
}

export function createRetriever(config: RetrievalConfig) {
  const supabase: SupabaseClient = createClient(config.supabaseUrl, config.supabaseKey);
  const cfAiUrl = `https://api.cloudflare.com/client/v4/accounts/${config.cfAccountId}/ai/run/${EMBEDDING_MODEL}`;

  async function embedQuery(text: string): Promise<number[]> {
    const res = await fetch(cfAiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.cfApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: [text] }),
    });
    if (!res.ok) throw new Error(`Workers AI ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { result: { data: number[][] } };
    return json.result.data[0];
  }

  /**
   * Retrieves the most similar chunks for a query.
   * minSimilarity is the anti-hallucination threshold measured on this index:
   * relevant queries score ~55-70%, out-of-scope ones ~33%.
   */
  async function retrieve(query: string, matchCount = 5, minSimilarity = 0.45): Promise<RetrievedChunk[]> {
    const embedding = await embedQuery(query);
    const { data, error } = await supabase.rpc("match_chunks", {
      query_embedding: embedding,
      match_count: matchCount,
      min_similarity: minSimilarity,
    });
    if (error) throw new Error(`Supabase match_chunks: ${error.message}`);
    return (data ?? []) as RetrievedChunk[];
  }

  return { retrieve };
}
