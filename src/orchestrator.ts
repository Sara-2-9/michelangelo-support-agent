/**
 * Phase 3 — Orchestrated support agent.
 *
 * Entry point that routes every message through the intent router and
 * dispatches to the right handler. Handlers for bug_report and
 * troubleshooting are stubs for now — they arrive in the next steps.
 */

import { createSupportAgent, type AgentConfig, type SupportAnswer } from "./agent.js";
import { createRouter, type Intent } from "./router.js";

export interface OrchestratedAnswer extends SupportAnswer {
  intent: Intent;
}

export function createOrchestrator(config: AgentConfig) {
  const support = createSupportAgent(config);
  const router = createRouter(config.cfAccountId, config.cfApiToken);

  async function handle(message: string): Promise<OrchestratedAnswer> {
    const intent = await router.classify(message);

    switch (intent) {
      case "support_question":
        return { intent, ...(await support.answer(message)) };

      case "bug_report":
        // Step 2 of Phase 3: guided structured collection → issue draft.
        return {
          intent,
          grounded: true,
          sources: [],
          text: "Vedo che vuoi segnalare un problema. La raccolta guidata dei bug report è in arrivo nel prossimo step del progetto — per ora descrivimi pure cosa è successo e ti aiuto con la documentazione se possibile.",
        };

      case "troubleshooting":
        // Step 3 of Phase 3: guided flows for known operational issues.
        return {
          intent,
          grounded: true,
          sources: [],
          text: "Capito, hai un problema operativo. I flussi di troubleshooting guidato sono in arrivo nel prossimo step — intanto posso cercare nella documentazione se vuoi.",
        };

      case "off_topic":
        return {
          intent,
          grounded: false,
          sources: [],
          text: "Sono l'assistente di supporto di Michelangelo: posso aiutarti solo con domande sull'app, le sue funzionalità, integrazioni e API. C'è qualcosa su Michelangelo che vorresti sapere?",
        };
    }
  }

  return { handle };
}
