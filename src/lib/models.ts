/**
 * Central model registry — the ONLY place where model IDs live.
 *
 * Serverless models have a short lifecycle (llama-3.1-8b was deprecated
 * by Cloudflare on 2026-05-30 mid-development). When a model is retired,
 * you change ONE line here instead of hunting through the codebase.
 * Check status: https://developers.cloudflare.com/workers-ai/models/
 */

/** Generation — the agent's brain (answers with citations). */
export const MODEL_GENERATION = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/** Classification/routing — cheap and fast, easy task. */
export const MODEL_ROUTING = "@cf/meta/llama-3.2-3b-instruct";

/** Embeddings — multilingual, must match the chunks table vector(1024). */
export const MODEL_EMBEDDING = "@cf/baai/bge-m3";
