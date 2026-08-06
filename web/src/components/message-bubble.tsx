/**
 * One chat bubble — restyle step 4 (Figma mockups 5/6/8).
 *
 * User: dark-blue bubble (bubble-user) on the right.
 * Assistant: dark card (surface + border-ui) on the left with a dynamic
 * intent badge on top, sources as blue links, thumbs feedback and the
 * timestamp in the bottom-right corner of the bubble.
 */

import type { ChatMessage } from "@/types/chat";
import IntentBadge from "@/components/ui/intent-badge";
import FeedbackButtons from "@/components/ui/feedback-buttons";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed break-words whitespace-pre-wrap ${
          isUser
            ? "rounded-br-none bg-bubble-user text-white"
            : "rounded-bl-none border border-border-ui bg-surface text-white"
        }`}
      >
        {message.intent && <IntentBadge intent={message.intent} />}

        <div>{message.content}</div>

        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 flex flex-col gap-1">
            <span className="text-[13px] text-white">Sources:</span>
            {message.sources.map((s, i) => (
              <a
                key={i}
                href={s.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] font-medium text-[#4d9fff] hover:underline"
              >
                {s.page_title}
              </a>
            ))}
          </div>
        )}

        <div className="mt-2 flex items-end justify-between gap-3">
          {!isUser && message.messageId ? (
            <FeedbackButtons messageId={message.messageId} feedback={message.feedback} />
          ) : (
            <span />
          )}
          {message.createdAt && (
            <span className="text-[11px] text-white/45">{formatTime(message.createdAt)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
