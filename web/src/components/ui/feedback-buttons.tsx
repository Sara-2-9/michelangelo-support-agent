/**
 * Thumbs feedback — restyle step 4 (Figma mockup 6/8).
 *
 * Font Awesome thumbs-up / thumbs-down in gold, inside small bordered
 * square buttons. The active choice stays fully opaque; clicking the same
 * thumb again toggles it off (handled in chat context).
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
      className={`flex h-8 w-8 items-center justify-center rounded-lg border text-warn transition-opacity ${
        feedback === value
          ? "border-warn/70 opacity-100"
          : "border-border-ui opacity-70 hover:opacity-100"
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
