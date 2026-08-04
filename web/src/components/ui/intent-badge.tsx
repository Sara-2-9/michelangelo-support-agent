import { INTENT_LABELS } from "@/constants/intents";

/** Tailwind classes per intent — the visual language of the router. */
const INTENT_STYLES: Record<string, string> = {
  support_question: "text-accent bg-accent/10",
  bug_report: "text-bug bg-bug/10",
  troubleshooting: "text-warn bg-warn/10",
  off_topic: "text-muted bg-muted/10",
};

export default function IntentBadge({ intent }: { intent: string }) {
  const styles = INTENT_STYLES[intent] ?? INTENT_STYLES.off_topic;
  return (
    <span
      className={`mb-2 inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles}`}
    >
      {INTENT_LABELS[intent] ?? intent}
    </span>
  );
}
