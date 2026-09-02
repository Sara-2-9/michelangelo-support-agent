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
  const { send, loading, canSend } = useChat();
  const [input, setInput] = useState("");

  function handleSend() {
    const message = input.trim();
    // !canSend: keep the draft instead of losing the message to a send()
    // that would no-op without a session token.
    if (!message || !canSend) return;
    setInput("");
    send(message);
  }

  return (
    // NOTE: the `peer` marker for the legal footer's `peer-focus-within:hidden`
    // lives on the parent <main> in App.tsx (peer variants need siblings) —
    // do not re-add `peer` here, it would silently not work.
    <footer className="animate-enter px-1 pt-4 pb-5 [animation-delay:240ms]">
      <div className="relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          // Disabled until the (anonymous) session exists: typing earlier
          // would lose the draft when ChatProvider remounts on bootstrap.
          disabled={!canSend}
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
          className="w-full resize-none rounded-2xl border border-border-ui bg-linear-to-br from-grad-blue via-grad-violet to-grad-pink px-4 py-3.5 pr-14 text-[16px] text-black placeholder:text-placeholder-dark focus:border-white/70 focus:outline-none disabled:opacity-60 md:text-sm"
        />
        <IconButton
          onClick={handleSend}
          // !canSend: no session token yet (anonymous sign-in still in
          // flight) — without this the message would be silently swallowed.
          disabled={loading || !canSend || !input.trim()}
          icon={faArrowUp}
          label="Send message"
          className="absolute right-3 bottom-4 bg-white text-icon-dark"
        />
      </div>
    </footer>
  );
}
