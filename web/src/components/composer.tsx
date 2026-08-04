import { useState } from "react";
import { useChat } from "@/context/chat";

/** Input box + send button. Enter sends, Shift+Enter adds a new line. */
export default function Composer() {
  const { send, loading } = useChat();
  const [input, setInput] = useState("");

  function handleSend() {
    const message = input.trim();
    if (!message) return;
    setInput("");
    send(message);
  }

  return (
    <footer className="flex gap-2.5 border-t border-border px-1 pt-3.5 pb-4">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="Ask a question… (Enter to send, Shift+Enter for a new line)"
        rows={2}
        className="flex-1 resize-none rounded-xl border border-border bg-panel px-3 py-2.5 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <button
        onClick={handleSend}
        disabled={loading || !input.trim()}
        className="rounded-xl bg-accent px-5 text-sm font-semibold text-[#0b0e14] disabled:cursor-default disabled:opacity-40"
      >
        Send
      </button>
    </footer>
  );
}
