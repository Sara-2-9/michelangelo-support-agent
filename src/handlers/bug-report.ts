/**
 * Phase 3, step 2 — Bug report handler.
 *
 * Translates a raw user report ("it crashes, help") into a structured
 * issue draft the Michelangelo team could actually act on, explicitly
 * listing the information the user should still provide.
 *
 * Single-turn for now: conversation memory (Phase 3, step 4) will let it
 * collect missing details across follow-up messages.
 */

import { Agent } from "@mastra/core/agent";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { MODEL_GENERATION } from "../lib/models.js";

export function createBugReportHandler(cfAccountId: string, cfApiToken: string) {
  const workersAi = createOpenAICompatible({
    name: "workers-ai",
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/v1`,
    apiKey: cfApiToken,
  });

  const agent = new Agent({
    id: "bug-report-drafter",
    name: "Bug Report Drafter",
    instructions: `You help users of Michelangelo (an iOS vibe-coding app) turn
their problem reports into well-structured bug reports.

Given the user's raw report, produce a GitHub-issue-style draft with:

1. **Title**: one line, specific (not "app broken").
2. **Summary**: 2-3 sentences describing the problem.
3. **Steps to reproduce**: numbered list, based only on what the user said.
4. **Expected vs actual behavior**: two short bullet points.
5. **Environment**: device, iOS version, app version — fill in what the
   user mentioned, mark the rest as "⚠️ to specify".
6. **Missing information**: a final section listing questions the user
   should answer to make the report actionable (e.g. error messages,
   screenshots, whether it is reproducible every time).

RULES:
- Do NOT invent details the user did not provide: mark them as missing.
- Answer in the SAME LANGUAGE the user writes in.
- Be warm but efficient: the user is frustrated, get to the point.
- End with one line explaining they can send this draft to
  sardo@michelangelo.land or share it in the Discord community.`,
    model: workersAi(MODEL_GENERATION),
  });

  async function draft(report: string): Promise<string> {
    const result = await agent.generate(
      `Turn this raw user report into a structured bug report draft:\n\n"${report}"`
    );
    return result.text;
  }

  return { draft };
}
