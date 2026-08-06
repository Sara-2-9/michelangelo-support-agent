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
 */

import { createContext, use, useCallback, useEffect, useState, type PropsWithChildren } from "react";
import { postChat, postFeedback } from "@/lib/api";
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
  const { session, userId, ready } = useAuth();
  const token = session?.access_token ?? null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY)
  );

  /** Sidebar data — direct read, RLS scopes it to the current user. */
  const refreshConversations = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("conversations")
      .select("id, started_at, escalated")
      .order("started_at", { ascending: false })
      .limit(50);
    setConversations(data ?? []);
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

    const isNewConversation = !conversationId;
    setError(null);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: message, createdAt: new Date().toISOString() },
    ]);
    setLoading(true);

    try {
      const data = await postChat(message, conversationId ?? undefined, token);

      if (isNewConversation) {
        setConversationId(data.conversationId);
        localStorage.setItem(STORAGE_KEY, data.conversationId);
        refreshConversations(); // the new chat appears in the sidebar
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      // A stored conversationId from BEFORE auth existed (user_id NULL in
      // the DB) can never pass the ownership check — drop it and start fresh.
      if (conversationId && /conversation/i.test(message)) {
        localStorage.removeItem(STORAGE_KEY);
        setConversationId(null);
        setMessages([]);
      }
      setError(message);
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
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
