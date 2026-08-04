import { useChat } from "@/context/chat";

export default function ChatHeader() {
  const { newConversation } = useChat();

  return (
    <header className="flex items-center justify-between border-b border-border px-1 py-4">
      <div>
        <h1 className="m-0 text-lg font-semibold">Michelangelo Support</h1>
        <p className="mt-1 text-[13px] text-muted">
          Answers grounded in the official docs, with sources.
        </p>
      </div>
      <button
        onClick={newConversation}
        className="rounded-lg border border-border px-3.5 py-2 text-[13px] text-text transition-colors hover:border-accent"
      >
        New chat
      </button>
    </header>
  );
}
