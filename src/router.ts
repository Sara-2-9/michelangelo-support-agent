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
- bug_report: the user REPORTS a defect to notify the team (statements,
  complaints, "it's broken"). The goal is reporting, not fixing.
- troubleshooting: the user asks for HELP FIXING an operational problem
  right now ("what can I do?", "how do I solve?", "it's stuck, help").
  The goal is getting unblocked, not reporting.
- off_topic: anything unrelated to Michelangelo (recipes, general coding
  help, other products, small talk not about Michelangelo).

DISAMBIGUATION RULE: when something is not working, ask yourself whether
the user wants to REPORT it (→ bug_report) or FIX it (→ troubleshooting).
Phrases like "how do I fix", "what can I do", "help me solve" indicate
troubleshooting even if a defect is mentioned.

NOTE: users may write in any language (mostly English, some Italian).
Classify by meaning, not by language.

EXAMPLES:
- "how does app sharing work?" → support_question
- "how much is the Imaginer subscription?" → support_question
- "the app crashes when I deploy, I'm reporting this bug" → bug_report
- "I found an error during generation, here's what happened" → bug_report
- "generation gets stuck halfway, what can I do?" → troubleshooting
- "purchase restore doesn't work after reinstalling, help" → troubleshooting
- "tell me a joke" → off_topic
- "how do I use React?" → off_topic`,
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
