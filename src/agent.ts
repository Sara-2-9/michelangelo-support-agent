/**
 * Phase 2 — The Michelangelo support agent (Mastra).
 *
 * Architecture: DETERMINISTIC RAG (retrieve → generate), not agentic
 * tool-calling. Reason: Cloudflare Workers AI's OpenAI-compatible endpoint
 * does not accept serialized tool-call history (multi-turn tool calling),
 * and — more importantly — single-hop support Q&A is better served by a
 * predictable pipeline: always retrieve, then generate with citations.
 *
 * Agent orchestration with tools arrives in Phase 3, where multi-step
 * flows (guided troubleshooting, escalation) actually need it.
 *
 * LLM: Llama 3.3 70B on Cloudflare Workers AI, via its OpenAI-compatible
 * endpoint — Mastra talks to it exactly as if it were OpenAI.
 */

import { Agent } from "@mastra/core/agent";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createRetriever, type RetrievedChunk } from "./lib/retrieval.js";
import { MODEL_GENERATION } from "./lib/models.js";

export interface AgentConfig {
  supabaseUrl: string;
  supabaseKey: string;
  cfAccountId: string;
  cfApiToken: string;
}

export interface SupportAnswer {
  text: string;
  sources: RetrievedChunk[];
  /** false when retrieval found nothing relevant → deterministic refusal */
  grounded: boolean;
}

const FALLBACK_MESSAGE =
  "I could not find anything about this in the official Michelangelo documentation. " +
  "For questions the docs do not cover, the team is available on the Discord " +
  "community or by email at sardo@michelangelo.land.";

export function createSupportAgent(config: AgentConfig) {
  const retriever = createRetriever(config);

  // Cloudflare Workers AI exposes an OpenAI-compatible endpoint per account.
  const workersAi = createOpenAICompatible({
    name: "workers-ai",
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${config.cfAccountId}/ai/v1`,
    apiKey: config.cfApiToken,
  });

  const agent = new Agent({
    id: "michelangelo-support",
    name: "Michelangelo Support Agent",
    instructions: `You are the support agent for Michelangelo (michelangelo.land),
an iOS app for vibe-coding native Expo/React Native apps from natural language.

RULES — follow them strictly:
1. You will receive DOCUMENTATION EXCERPTS with the user's question.
   Answer ONLY from those excerpts. Never invent features, limits, prices,
   or behaviors that are not written there.
2. If the excerpts do not actually answer the question, say honestly that
   the documentation does not cover it and suggest the Discord community
   or sardo@michelangelo.land.
3. ALWAYS cite sources: end your answer with a "Sources" section listing
   the documentation pages used, as markdown links. Use the URLs provided
   with each excerpt.
4. Answer in the SAME LANGUAGE the user writes in (usually Italian or English).
5. Be concise and practical: this is support, not marketing. Use short
   paragraphs or bullet points. If the excerpts describe steps, list them
   in order.`,
    model: workersAi(MODEL_GENERATION),
  });

  /**
   * The deterministic RAG pipeline:
   *   1. retrieve relevant chunks (threshold = anti-hallucination guardrail)
   *   2. nothing relevant → honest refusal WITHOUT calling the LLM
   *      (a deterministic guardrail cannot hallucinate)
   *   3. otherwise → generate with the excerpts as context
   */
  async function answer(question: string): Promise<SupportAnswer> {
    const chunks = await retriever.retrieve(question, 5, 0.45);

    if (chunks.length === 0) {
      return { text: FALLBACK_MESSAGE, sources: [], grounded: false };
    }

    const context = chunks
      .map(
        (c, i) =>
          `--- EXCERPT ${i + 1} (from "${c.page_title} > ${c.section}", relevance ${(c.similarity * 100).toFixed(0)}%)\n` +
          `URL: ${c.source_url}\n\n${c.content}`
      )
      .join("\n\n");

    const prompt =
      `DOCUMENTATION EXCERPTS:\n\n${context}\n\n` +
      `---\nUSER QUESTION: ${question}\n\n` +
      `Answer following your rules. Remember the "Sources" section.`;

    const result = await agent.generate(prompt);
    return { text: result.text, sources: chunks, grounded: true };
  }

  return { agent, answer };
}
