import { useChat } from "@/context/chat";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import MessageBubble from "@/components/message-bubble";
import EmptyState from "@/components/empty-state";
import ThinkingIndicator from "@/components/ui/thinking-indicator";

export default function MessageList() {
  const { messages, loading, error } = useChat();
  const bottomRef = useAutoScroll<HTMLDivElement>([messages, loading]);

  return (
    <main className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-1 py-5">
      {messages.length === 0 && <EmptyState />}

      {messages.map((m, i) => (
        <MessageBubble key={i} message={m} />
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
