/**
 * Composer — restyle step 4 (Figma mockups 1/4).
 *
 * Large rounded dark textarea (surface + border-ui) with a circular
 * arrow-up send button inside its bottom-right corner. Enter sends,
 * Shift+Enter adds a new line.
 */

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUp } from "@fortawesome/free-solid-svg-icons";
import { useChat } from "@/context/chat";

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
    <footer className="px-1 pt-4 pb-5">
      <div className="relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask a question…"
          rows={2}
          // 16px minimum on touch devices: iOS Safari auto-zooms on focus
          // when an input's font-size is smaller than 16px.
          className="w-full resize-none rounded-2xl border border-border-ui bg-surface px-4 py-3.5 pr-14 text-[16px] text-white placeholder:text-white/40 focus:border-white/50 focus:outline-none md:text-sm"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          aria-label="Send message"
          className="absolute right-3 bottom-3 flex h-9 w-9 items-center justify-center rounded-full border border-border-ui text-white transition-opacity hover:opacity-80 disabled:cursor-default disabled:opacity-30"
        >
          <FontAwesomeIcon icon={faArrowUp} />
        </button>
      </div>
    </footer>
  );
}
