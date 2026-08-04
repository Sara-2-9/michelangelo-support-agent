/** Static values of the chat feature — no logic, just data. */

export const STORAGE_KEY = "msa_conversation_id";

/** Human-readable labels for the intents produced by the router. */
export const INTENT_LABELS: Record<string, string> = {
  support_question: "Support",
  bug_report: "Bug report",
  troubleshooting: "Troubleshooting",
  off_topic: "Off topic",
};
