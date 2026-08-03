/**
 * Phase 3 — Orchestrated support agent.
 *
 * Entry point that routes every message through the intent router and
 * dispatches to the right handler:
 *   support_question → deterministic RAG with citations (Phase 2)
 *   bug_report       → structured issue draft (Phase 3 step 2)
 *   troubleshooting  → guided diagnostic checklist (Phase 3 step 3)
 *   off_topic        → polite refusal
 */

import { createSupportAgent, type AgentConfig, type SupportAnswer } from "./agent.js";
import { createRouter, type Intent } from "./router.js";
import { createBugReportHandler } from "./handlers/bug-report.js";
import { createTroubleshootingHandler } from "./handlers/troubleshooting.js";
import { createRetriever } from "./lib/retrieval.js";

export interface OrchestratedAnswer extends SupportAnswer {
  intent: Intent;
}

export function createOrchestrator(config: AgentConfig) {
  const support = createSupportAgent(config);
  const router = createRouter(config.cfAccountId, config.cfApiToken);
  const bugReport = createBugReportHandler(config.cfAccountId, config.cfApiToken);
  const troubleshooting = createTroubleshootingHandler(config.cfAccountId, config.cfApiToken);
  const retriever = createRetriever(config);

  async function handle(message: string): Promise<OrchestratedAnswer> {
    const intent = await router.classify(message);

    switch (intent) {
      case "support_question":
        return { intent, ...(await support.answer(message)) };

      case "bug_report": {
        const text = await bugReport.draft(message);
        return { intent, grounded: true, sources: [], text };
      }

      case "troubleshooting": {
        // Guided flows also ground on retrieved docs — but with a lower
        // threshold: a diagnostic checklist is useful even from loosely
        // related excerpts, and the handler covers the empty case honestly.
        const chunks = await retriever.retrieve(message, 5, 0.3);
        const text = await troubleshooting.guide(message, chunks);
        return { intent, grounded: chunks.length > 0, sources: chunks, text };
      }

      case "off_topic":
        return {
          intent,
          grounded: false,
          sources: [],
          text: "I'm the Michelangelo support assistant: I can only help with questions about the app, its features, integrations, and API. Is there anything about Michelangelo you'd like to know?",
        };
    }
  }

  return { handle };
}
