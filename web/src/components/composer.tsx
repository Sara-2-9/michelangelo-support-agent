/**
 * Composer — restyle (mockup 9).
 *
 * The brand gradient lives HERE now: large rounded textarea with the
 * four-color gradient, dark placeholder, black typed text, light border.
 * Circular white send button with a dark arrow in its bottom-right
 * corner. Enter sends, Shift+Enter adds a new line.
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
          rows={4}
          // 16px minimum on touch devices: iOS Safari auto-zooms on focus
          // when an input's font-size is smaller than 16px.
          className="w-full resize-none rounded-2xl border border-border-ui bg-linear-to-br from-grad-blue via-grad-violet to-grad-pink px-4 py-3.5 pr-14 text-[16px] text-black placeholder:text-placeholder-dark focus:border-white/70 focus:outline-none md:text-sm"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          aria-label="Send message"
          className="absolute right-3 bottom-4 flex h-9 w-9 items-center justify-center rounded-full bg-white text-icon-dark shadow transition-opacity hover:opacity-85 disabled:cursor-default disabled:opacity-40"
        >
          <FontAwesomeIcon icon={faArrowUp} />
        </button>
      </div>
    </footer>
  );
}
