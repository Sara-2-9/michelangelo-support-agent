/**
 * Phase 3, step 3 — Troubleshooting handler.
 *
 * For known operational problems, users need guided diagnosis, not a doc
 * quote: "have you tried X? then Y". Each flow is grounded in the official
 * docs (retrieved live, so it stays current), and the LLM turns it into a
 * step-by-step diagnostic conversation.
 *
 * Distinction from support_question: a support question is "how does X
 * work" → informative answer. Troubleshooting is "X is broken" →
 * diagnostic checklist ordered from cheapest to most expensive fix,
 * ending with escalation if nothing works.
 */

import { Agent } from "@mastra/core/agent";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { MODEL_GENERATION } from "../lib/models.js";
import type { RetrievedChunk } from "../lib/retrieval.js";

/**
 * Known operational issues from the docs. This map is PROMPT CONTEXT,
 * not a decision tree: it tells the LLM which diagnostic territory the
 * conversation is in. Retrieval provides the grounding facts.
 */
const KNOWN_FLOWS = `
Known troubleshooting areas in Michelangelo (from the docs):
- restore_purchase: after reinstalling or switching devices, the Imaginer
  subscription must be restored from the subscription screen; it is tied
  to the Apple ID.
- streaming_stall: generation has a streaming safety timeout that forces
  a reset if streaming stalls; prompt timeout is client-side.
- sandbox_errors: the app performs automatic fix retries on sandbox errors.
- github_integration: connection via Tools → GitHub → Settings → Add GitHub
  Account; one repository per project.
- deploy: no in-app "Build for App Store" button; deploy flow goes through
  the documented steps (EAS/own credentials).
`;

export function createTroubleshootingHandler(cfAccountId: string, cfApiToken: string) {
  const workersAi = createOpenAICompatible({
    name: "workers-ai",
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/v1`,
    apiKey: cfApiToken,
  });

  const agent = new Agent({
    id: "troubleshooting-guide",
    name: "Troubleshooting Guide",
    instructions: `You are the troubleshooting guide for Michelangelo (an iOS
vibe-coding app). The user has an operational problem.

${KNOWN_FLOWS}

You will receive DOCUMENTATION EXCERPTS with the user's problem.

HOW TO RESPOND:
1. Start with ONE sentence acknowledging the problem and naming the most
   likely cause based on the excerpts.
2. Give a NUMBERED diagnostic checklist, ordered from the quickest/cheapest
   check to the most involved one. Only steps grounded in the excerpts —
   never invent procedures that are not documented.
3. Ask the user to report back which step they are stuck on (this is a
   guided flow: one exchange at a time).
4. If the excerpts do not cover the problem, say so honestly and suggest
   the Discord community or sardo@michelangelo.land.
5. End with a "Sources" section (markdown links from the excerpts).
6. Answer in the SAME LANGUAGE the user writes in; default to English
   when the language is unclear.`,
    model: workersAi(MODEL_GENERATION),
  });

  async function guide(problem: string, chunks: RetrievedChunk[]): Promise<string> {
    const context = chunks
      .map((c, i) => `--- EXCERPT ${i + 1} ("${c.page_title} > ${c.section}")\nURL: ${c.source_url}\n\n${c.content}`)
      .join("\n\n");

    const result = await agent.generate(
      chunks.length > 0
        ? `DOCUMENTATION EXCERPTS:\n\n${context}\n\n---\nUSER PROBLEM: ${problem}`
        : `No documentation excerpts found.\n\nUSER PROBLEM: ${problem}`
    );
    return result.text;
  }

  return { guide };
}
