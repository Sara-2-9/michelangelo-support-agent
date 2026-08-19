/**
 * Chat state — the single source of truth for the conversation.
 *
 * Pattern: one Provider owns the state and exposes actions; components
 * read it through `useChat()` and stay presentational.
 *
 * Phase 5.3: every exchange is authenticated (JWT → Worker). The sidebar
 * reads the user's conversations DIRECTLY from Supabase (anon key + RLS
 * policies — each user sees only their own rows). Selecting a past
 * conversation loads its messages and resumes it.
 *
 * Branch no-anon-history: ANONYMOUS visitors get NO history surface. The
 * Worker still persists their exchanges server-side (analytics/quality),
 * but the client never lists their conversations, never restores a
 * conversationId from localStorage and never stores one — a reload always
 * starts from a clean chat. The in-memory conversationId is still kept
 * for the LIVE session so follow-up messages share the same server-side
 * thread (memory context).
 */

import { createContext, use, useCallback, useEffect, useState, type PropsWithChildren } from "react";
import { deleteConversation as deleteConversationApi, postChat, postFeedback } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { STORAGE_KEY } from "@/constants/intents";
import { useAuth } from "@/context/auth";
import type { ChatMessage, ConversationSummary, Feedback, Source } from "@/types/chat";

interface ChatContextValue {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  conversationId: string | null;
  conversations: ConversationSummary[];
  send: (message: string) => Promise<void>;
  sendFeedback: (messageId: string, feedback: Feedback) => void;
  selectConversation: (id: string) => Promise<void>;
  newConversation: () => void;
  /** Deletes one conversation (Worker, ownership-checked) and updates state. */
  deleteConversation: (id: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat() {
  const value = use(ChatContext);
  if (!value) {
    throw new Error("useChat must be wrapped in a <ChatProvider />");
  }
  return value;
}

export function ChatProvider({ children }: PropsWithChildren) {
  const { session, userId, ready, isAnonymous } = useAuth();
  const token = session?.access_token ?? null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Anonymous visitors never restore a conversation pointer: a reload must
  // always land on a fresh, empty chat even though the Worker persisted
  // the previous exchange server-side.
  const [conversationId, setConversationId] = useState<string | null>(() =>
    isAnonymous ? null : localStorage.getItem(STORAGE_KEY)
  );

  /**
   * Sidebar data — direct read, RLS scopes it to the current user.
   * PostgREST resource embedding fetches each conversation TOGETHER WITH
   * its first user message (filtered + ordered + limited on the embedded
   * `messages` table) — one round trip, no DB migration needed.
   * Skipped entirely for anonymous visitors: they have no history UI.
   */
  const refreshConversations = useCallback(async () => {
    if (!userId || isAnonymous) return;
    const { data } = await supabase
      .from("conversations")
      .select("id, started_at, escalated, messages(content)")
      .eq("messages.role", "user")
      .order("started_at", { ascending: false })
      .order("created_at", { referencedTable: "messages", ascending: true })
      .limit(1, { referencedTable: "messages" })
      .limit(50);
    setConversations(
      (data ?? []).map((row) => ({
        id: row.id,
        started_at: row.started_at,
        escalated: row.escalated,
        preview: row.messages?.[0]?.content ?? null,
      }))
    );
  }, [userId]);

  useEffect(() => {
    if (ready && userId) refreshConversations();
  }, [ready, userId, refreshConversations]);

  /** Opens a past conversation: loads its messages and resumes it. */
  async function selectConversation(id: string) {
    setError(null);
    const { data, error: loadError } = await supabase
      .from("messages")
      .select("id, role, content, intent, sources, feedback, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setMessages(
      (data ?? []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        intent: m.intent ?? undefined,
        sources: (m.sources as Source[] | null) ?? undefined,
        messageId: String(m.id),
        feedback: (m.feedback as Feedback | null) ?? undefined,
        createdAt: m.created_at,
      }))
    );
    setConversationId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  async function send(message: string) {
    if (!message.trim() || loading || !token) return;

    setError(null);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: message, createdAt: new Date().toISOString() },
    ]);
    setLoading(true);

    /** Posts to the Worker and appends the assistant reply. */
    const deliver = async (convId: string | null) => {
      const data = await postChat(message, convId ?? undefined, token);

      if (!convId) {
        setConversationId(data.conversationId);
        // Only signed-in users get a durable pointer + sidebar refresh;
        // for anonymous visitors the conversationId stays in memory only.
        if (!isAnonymous) {
          localStorage.setItem(STORAGE_KEY, data.conversationId);
          refreshConversations(); // the new chat appears in the sidebar
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.text,
          intent: data.intent,
          sources: data.sources,
          messageId: data.messageId ?? undefined,
          createdAt: new Date().toISOString(),
        },
      ]);
    };

    try {
      await deliver(conversationId);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Something went wrong";
      // A conversationId stored under a PREVIOUS identity (e.g. after sign
      // out, which creates a fresh anonymous user) can never pass the
      // Worker's ownership check. Instead of surfacing "Not your
      // conversation", silently retry as a brand-new conversation — the
      // user's message simply goes through.
      const stale = conversationId && /not your conversation|conversation not found/i.test(errMsg);
      if (stale) {
        localStorage.removeItem(STORAGE_KEY);
        setConversationId(null);
        try {
          await deliver(null);
        } catch (retryErr) {
          setError(retryErr instanceof Error ? retryErr.message : "Something went wrong");
        }
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  }

  function sendFeedback(messageId: string, feedback: Feedback) {
    if (!token) return;
    // Optimistic UI: toggle locally first, then persist. Feedback is
    // best-effort — it must never block or break the chat.
    setMessages((prev) =>
      prev.map((m) =>
        m.messageId === messageId
          ? { ...m, feedback: m.feedback === feedback ? undefined : feedback }
          : m
      )
    );
    postFeedback(messageId, feedback, token).catch(() => {});
  }

  function newConversation() {
    localStorage.removeItem(STORAGE_KEY);
    setConversationId(null);
    setMessages([]);
    setError(null);
  }

  /**
   * Deletes one conversation server-side (JWT + ownership in the Worker),
   * then drops it from the sidebar. If it was the OPEN conversation, the
   * chat resets to the empty state (localStorage pointer removed too).
   * Throws on failure — the sidebar surfaces the error in its dialog.
   */
  async function deleteConversation(id: string) {
    if (!token) throw new Error("Not signed in");
    await deleteConversationApi(id, token);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (conversationId === id) newConversation();
  }

  const value: ChatContextValue = {
    messages,
    loading,
    error,
    conversationId,
    conversations,
    send,
    sendFeedback,
    selectConversation,
    newConversation,
    deleteConversation,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
