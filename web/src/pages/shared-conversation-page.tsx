/**
 * SharedConversationPage — PUBLIC read-only view of a shared chat.
 *
 * Reached via /share/:token links created from the sidebar's ellipsis
 * menu. The token is random and unguessable: whoever has the link can
 * read, no account needed (the Worker's GET /api/share/:token is the only
 * public reader — RLS keeps the tables closed to anonymous clients).
 *
 * Rendering reuses MessageBubble: shared messages carry no messageId, so
 * feedback buttons and intent badges simply don't appear — the view is
 * read-only by construction.
 */

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchSharedConversation } from "@/lib/api";
import MessageBubble from "@/components/message-bubble";
import type { ChatMessage, SharedConversation } from "@/types/chat";

export default function SharedConversationPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedConversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetchSharedConversation(token)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the conversation"))
      .finally(() => setLoading(false));
  }, [token]);

  const messages: ChatMessage[] = (data?.messages ?? []).map((m) => ({
    role: m.role,
    content: m.content,
    sources: m.sources ?? undefined,
    createdAt: m.created_at,
  }));

  return (
    <div className="flex h-dvh flex-col pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
      <header className="mx-auto flex w-full max-w-205 items-center gap-3 px-4 py-4">
        <img src="/icon-96.png" alt="Michelangelo Support Agent" className="h-8 w-8 rounded-lg shadow" />
        <div className="min-w-0 flex-1">
          <h1 className="m-0 truncate text-sm font-semibold text-white">Shared conversation</h1>
          <p className="m-0 text-[11px] text-white/50">Read-only view · Michelangelo Support Agent</p>
        </div>
        <Link
          to="/"
          className="shrink-0 rounded-4xl bg-btn-light px-3.5 py-2 text-[13px] font-semibold text-icon-dark transition-opacity hover:opacity-85"
        >
          Try the agent
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-205 flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-4">
        {loading && <p className="py-10 text-center text-sm text-white/60">Loading…</p>}
        {error && <p className="py-10 text-center text-sm text-danger">⚠️ {error}</p>}
        {!loading && !error && messages.length === 0 && (
          <p className="py-10 text-center text-sm text-white/60">This conversation is empty.</p>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
      </main>

      <footer className="mx-auto w-full max-w-205 px-5 pb-3">
        <p className="m-0 text-center text-[11px] text-white/40">
          AI answers may be inaccurate — verify with the cited docs. Unofficial project, not
          affiliated with Michelangelo.
        </p>
      </footer>
    </div>
  );
}
