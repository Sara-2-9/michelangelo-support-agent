/**
 * Composer — restyle (mockup 9).
 *
 * The brand gradient lives HERE now: large rounded textarea with the
 * four-color gradient, dark placeholder, black typed text, light border.
 * Circular white send button with a dark arrow in its bottom-right
 * corner. Enter sends, Shift+Enter adds a new line.
 */

import { useState } from "react";
import { faArrowUp } from "@fortawesome/free-solid-svg-icons";
import { useChat } from "@/context/chat";
import IconButton from "@/components/ui/icon-button";

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
    // `peer`: lets the legal footer hide itself (peer-focus-within:hidden)
    // while the textarea is focused, so it never rides the iOS keyboard.
    <footer className="peer px-1 pt-4 pb-5">
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
        <IconButton
          onClick={handleSend}
          disabled={loading || !input.trim()}
          icon={faArrowUp}
          label="Send message"
          className="absolute right-3 bottom-4 bg-white text-icon-dark"
        />
      </div>
    </footer>
  );
}
