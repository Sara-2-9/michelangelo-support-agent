/**
 * Phase 3 — Orchestrated support agent.
 *
 * Entry point that routes every message through the intent router and
 * dispatches to the right handler:
 *   support_question → deterministic RAG with citations (Phase 2)
 *   bug_report       → structured issue draft (Phase 3 step 2)
 *   troubleshooting  → guided diagnostic checklist (Phase 3 step 3)
 *   off_topic        → polite refusal
 *
 * Step 4 adds: conversation logging (every exchange persisted with intent,
 * sources, latency, model) and conversation memory (history-aware answers).
 */

import { createSupportAgent, type AgentConfig, type SupportAnswer } from "./agent.js";
import { createRouter, type Intent } from "./router.js";
import { createBugReportHandler } from "./handlers/bug-report.js";
import { createTroubleshootingHandler } from "./handlers/troubleshooting.js";
import { createRetriever } from "./lib/retrieval.js";
import { createLogger, type HistoryMessage } from "./lib/logging.js";
import { MODEL_GENERATION } from "./lib/models.js";

export interface OrchestratedAnswer extends SupportAnswer {
  intent: Intent;
  /** Id of the persisted assistant message (null when not logged) — the UI
   * uses it to attach thumbs up/down feedback (Phase 5.2). */
  messageId?: string | null;
}

export interface HandleOptions {
  /** When set, the exchange is persisted to the conversations/messages tables. */
  conversationId?: string;
  /** Recent conversation turns — the memory context. */
  history?: HistoryMessage[];
}

export function createOrchestrator(config: AgentConfig) {
  const support = createSupportAgent(config);
  const router = createRouter(config.cfAccountId, config.cfApiToken);
  const bugReport = createBugReportHandler(config.cfAccountId, config.cfApiToken);
  const troubleshooting = createTroubleshootingHandler(config.cfAccountId, config.cfApiToken);
  const retriever = createRetriever(config);
  const logger = createLogger(config.supabaseUrl, config.supabaseKey);

  /**
   * Escalation: when the agent cannot answer grounded, the conversation is
   * handed to a human with an auto-generated summary (cheap model — this is
   * a simple summarization task).
   */
  async function escalate(conversationId: string, history: HistoryMessage[], lastMessage: string): Promise<void> {
    const transcript = [...history, { role: "user" as const, content: lastMessage }]
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");
    const summaryResult = await router.rawGenerate(
      `Summarize this support conversation in 3 bullet points for a human operator: what the user needed, what the agent could not solve, what to do next.\n\n${transcript}`
    );
    await logger.markEscalated(conversationId, summaryResult);
  }

  async function handle(message: string, options: HandleOptions = {}): Promise<OrchestratedAnswer> {
    const started = Date.now();
    const intent = await router.classify(message);
    const history = options.history ?? [];

    let result: OrchestratedAnswer;
    switch (intent) {
      case "support_question":
        result = { intent, ...(await support.answer(message, history)) };
        break;

      case "bug_report":
        result = { intent, grounded: true, sources: [], text: await bugReport.draft(message) };
        break;

      case "troubleshooting": {
        // Guided flows also ground on retrieved docs — but with a lower
        // threshold: a diagnostic checklist is useful even from loosely
        // related excerpts, and the handler covers the empty case honestly.
        const chunks = await retriever.retrieve(message, 5, 0.3);
        const text = await troubleshooting.guide(message, chunks);
        result = { intent, grounded: chunks.length > 0, sources: chunks, text };
        break;
      }

      case "off_topic":
        result = {
          intent,
          grounded: false,
          sources: [],
          text: "I'm the Michelangelo support assistant: I can only help with questions about the app, its features, integrations, and API. Is there anything about Michelangelo you'd like to know?",
        };
        break;
    }

    // Persist the exchange (non-blocking failure: logging must never
    // break the user's answer).
    if (options.conversationId) {
      await logger.logMessage(options.conversationId, "user", message);
      result.messageId = await logger.logMessage(options.conversationId, "assistant", result.text, {
        intent,
        grounded: result.grounded,
        sources: result.sources,
        model: MODEL_GENERATION,
        latencyMs: Date.now() - started,
      });

      // Escalation: the agent could not answer a real support need →
      // hand the conversation to a human with an auto-generated summary.
      // (off_topic refusals are NOT escalations: nothing to solve.)
      if (!result.grounded && intent !== "off_topic") {
        await escalate(options.conversationId, history, message);
      }
    }

    return result;
  }

  return { handle, logger };
}
