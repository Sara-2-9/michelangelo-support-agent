import type { ChatMessage } from "@/types/chat";
import IntentBadge from "@/components/ui/intent-badge";
import FeedbackButtons from "@/components/ui/feedback-buttons";

/** One chat bubble: user (right, accent) or assistant (left, with metadata). */
export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl border px-3.5 py-3 text-sm leading-relaxed break-words whitespace-pre-wrap ${
          isUser ? "border-user-border bg-user" : "border-border bg-panel"
        }`}
      >
        {message.intent && <IntentBadge intent={message.intent} />}

        <div>{message.content}</div>

        {message.sources && message.sources.length > 0 && (
          <div className="mt-2.5 flex flex-col gap-1 border-t border-border pt-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Sources
            </span>
            {message.sources.map((s, i) => (
              <a
                key={i}
                href={s.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] text-accent hover:underline"
              >
                {s.page_title}
              </a>
            ))}
          </div>
        )}

        {!isUser && message.messageId && (
          <FeedbackButtons messageId={message.messageId} feedback={message.feedback} />
        )}
      </div>
    </div>
  );
}
