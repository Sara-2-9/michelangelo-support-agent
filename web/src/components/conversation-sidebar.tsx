import { useChat } from "@/context/chat";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Conversation history. Account actions live on the /auth page now. */
export default function ConversationSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { conversations, conversationId, selectConversation, newConversation } = useChat();

  function openConversation(id: string) {
    selectConversation(id);
    onClose(); // on mobile, close the overlay after selecting
  }

  return (
    <>
      {/* Backdrop — all breakpoints: the sidebar is an overlay (mockup 7) */}
      {open && (
        <div className="fixed inset-0 z-20 bg-black/40" onClick={onClose} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-bg transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-border p-3">
          <button
            onClick={() => {
              newConversation();
              onClose();
            }}
            className="w-full rounded-lg border border-border px-3 py-2 text-[13px] font-medium hover:border-accent"
          >
            + New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 && (
            <p className="p-2 text-[13px] text-muted">No conversations yet.</p>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => openConversation(c.id)}
              className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                c.id === conversationId ? "bg-panel text-text" : "text-muted hover:bg-panel/60"
              }`}
            >
              <span>{formatDate(c.started_at)}</span>
              {c.escalated && <span className="text-[11px] text-warn">escalated</span>}
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}
