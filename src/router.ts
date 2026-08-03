/**
 * Phase 3, step 1 — Intent router.
 *
 * Classifies each user message into one intent, so every intent can have
 * its own specialized handler (instead of one giant do-everything prompt
 * that is impossible to test).
 *
 * Uses the SMALL model (Llama 3.1 8B): classification is an easy task and
 * does not need the 70B. Model routing by task complexity = lower latency,
 * lower cost.
 */

import { Agent } from "@mastra/core/agent";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { MODEL_ROUTING } from "./lib/models.js";

export const Intent = z.enum(["support_question", "bug_report", "troubleshooting", "off_topic"]);
export type Intent = z.infer<typeof Intent>;

export function createRouter(cfAccountId: string, cfApiToken: string) {
  const workersAi = createOpenAICompatible({
    name: "workers-ai",
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/v1`,
    apiKey: cfApiToken,
  });

  const router = new Agent({
    id: "intent-router",
    name: "Intent Router",
    instructions: `You classify user messages for the Michelangelo support agent
(Michelangelo = iOS app for vibe-coding mobile apps).

Reply with EXACTLY ONE of these words, nothing else:

- support_question: question about how Michelangelo works, its features,
  limits, pricing, integrations, API. Also greetings and meta-questions
  about what you can do.
- bug_report: the user reports something broken or not working in
  Michelangelo (errors, crashes, generation failures, billing issues).
- troubleshooting: the user asks for help fixing a known operational
  problem (app stuck, streaming stalled, restore purchase, sync issues).
- off_topic: anything unrelated to Michelangelo (recipes, general coding
  help, other products, small talk not about Michelangelo).`,
    model: workersAi(MODEL_ROUTING),
  });

  /**
   * Classifies the message. Robust parsing: any unexpected output falls
   * back to support_question (the safest route: it retrieves docs and
   * refuses honestly if nothing matches).
   */
  async function classify(message: string): Promise<Intent> {
    const result = await router.generate(message);
    const word = result.text.trim().toLowerCase().replace(/[^a-z_]/g, "");
    const parsed = Intent.safeParse(word);
    return parsed.success ? parsed.data : "support_question";
  }

  return { classify };
}
