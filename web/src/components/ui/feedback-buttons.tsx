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

  const button = (value: Feedback, emoji: string, label: string) => (
    <button
      onClick={() => sendFeedback(messageId, value)}
      aria-label={label}
      className={`rounded-md border px-2 py-0.5 text-[13px] transition-opacity ${
        feedback === value
          ? "border-accent bg-accent/15 opacity-100"
          : "border-border opacity-70 hover:opacity-100"
      }`}
    >
      {emoji}
    </button>
  );

  return (
    <div className="mt-2 flex gap-1.5">
      {button("up", "👍", "Helpful")}
      {button("down", "👎", "Not helpful")}
    </div>
  );
}
