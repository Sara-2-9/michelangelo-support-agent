/**
 * Message list — chat history with DAY DIVIDERS (iMessage style):
 * whenever the calendar day of a message differs from the previous one,
 * a centered date label separates the two groups.
 */

import { useChat } from "@/context/chat";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import MessageBubble from "@/components/message-bubble";
import EmptyState from "@/components/empty-state";
import ThinkingIndicator from "@/components/ui/thinking-indicator";
import type { ChatMessage } from "@/types/chat";

function dayKey(iso?: string) {
  return iso ? new Date(iso).toDateString() : null;
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Splits the flat message list into day groups for the dividers. */
function groupByDay(messages: ChatMessage[]) {
  const groups: { key: string | null; label: string | null; items: ChatMessage[] }[] = [];
  for (const m of messages) {
    const key = dayKey(m.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(m);
    } else {
      groups.push({ key, label: key ? formatDay(m.createdAt!) : null, items: [m] });
    }
  }
  return groups;
}

export default function MessageList() {
  const { messages, loading, error } = useChat();
  const bottomRef = useAutoScroll<HTMLDivElement>([messages, loading]);

  return (
    <main className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-1 py-5">
      {messages.length === 0 && <EmptyState />}

      {groupByDay(messages).map((group, gi) => (
        <div key={group.key ?? gi} className="flex flex-col gap-3.5">
          {group.label && (
            <div className="flex items-center gap-3 py-1" role="separator">
              <span className="h-px flex-1 bg-white/25" />
              <span className="text-[11px] font-medium tracking-wide text-white/70">
                {group.label}
              </span>
              <span className="h-px flex-1 bg-white/25" />
            </div>
          )}
          {group.items.map((m, i) => (
            <MessageBubble key={`${group.key}-${i}`} message={m} />
          ))}
        </div>
      ))}

      {loading && (
        <div className="flex">
          <div className="rounded-2xl rounded-bl-none border border-border-ui bg-surface">
            <ThinkingIndicator />
          </div>
        </div>
      )}

      {error && <div className="px-2 py-1 text-[13px] text-danger">⚠️ {error}</div>}

      <div ref={bottomRef} />
    </main>
  );
}
