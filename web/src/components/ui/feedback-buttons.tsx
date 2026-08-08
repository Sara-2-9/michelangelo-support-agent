/**
 * Thumbs feedback — restyle (mockup 9).
 *
 * Font Awesome thumbs-up / thumbs-down in light gray (#D9D9D9) inside
 * small bordered square buttons — always fully visible on the dark agent
 * bubble. Interaction is preserved: hover grows the button slightly,
 * click presses it down, the active vote gets a filled background.
 * Clicking the same thumb again toggles it off (handled in chat context).
 */

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faThumbsDown, faThumbsUp } from "@fortawesome/free-solid-svg-icons";
import { useChat } from "@/context/chat";
import type { Feedback } from "@/types/chat";

export default function FeedbackButtons({
  messageId,
  feedback,
}: {
  messageId: string;
  feedback?: Feedback;
}) {
  const { sendFeedback } = useChat();

  const button = (value: Feedback, icon: typeof faThumbsUp, label: string) => (
    <button
      onClick={() => sendFeedback(messageId, value)}
      aria-label={label}
      aria-pressed={feedback === value}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-border-ui text-btn-light transition-all duration-150 hover:scale-110 active:scale-95 ${
        feedback === value ? "bg-white/20" : "bg-transparent"
      }`}
    >
      <FontAwesomeIcon icon={icon} />
    </button>
  );

  return (
    <div className="flex gap-1.5">
      {button("up", faThumbsUp, "Helpful")}
      {button("down", faThumbsDown, "Not helpful")}
    </div>
  );
}
