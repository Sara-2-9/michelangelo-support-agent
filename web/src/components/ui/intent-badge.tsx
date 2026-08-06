/**
 * Intent badge — restyle step 4 (Figma mockup 6/8).
 *
 * The label is DYNAMIC: it shows the `intent` column value of the message
 * (humanized via INTENT_LABELS, uppercase via CSS). Neutral light pill on
 * the dark assistant card, as per the mockups.
 */

import { INTENT_LABELS } from "@/constants/intents";

export default function IntentBadge({ intent }: { intent: string }) {
  return (
    <span className="mb-2 inline-block rounded-md bg-btn-light px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-surface">
      {INTENT_LABELS[intent] ?? intent}
    </span>
  );
}
