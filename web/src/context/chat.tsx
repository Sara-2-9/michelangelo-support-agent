/**
 * Chat state — the single source of truth for the conversation.
 *
 * Pattern: one Provider owns the state and exposes actions; components
 * read it through `useChat()` and stay presentational. Same convention
 * as the context/ folder in our other React projects.
 *
 * The conversationId is kept in localStorage: reloading the page resumes
 * the same conversation (its history is loaded server-side). Phase 5.3
 * will replace this with Supabase Auth + a full conversation history.
 */

import { createContext, use, useState, type PropsWithChildren } from "react";
import { postChat, postFeedback } from "@/lib/api";
import { STORAGE_KEY } from "@/constants/intents";
import type { ChatMessage, Feedback } from "@/types/chat";

interface ChatContextValue {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  conversationId: string | null;
  send: (message: string) => Promise<void>;
  sendFeedback: (messageId: string, feedback: Feedback) => void;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY)
  );

  async function send(message: string) {
    if (!message.trim() || loading) return;

    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setLoading(true);

    try {
      const data = await postChat(message, conversationId ?? undefined);

      if (!conversationId) {
        setConversationId(data.conversationId);
        localStorage.setItem(STORAGE_KEY, data.conversationId);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.text,
          intent: data.intent,
          sources: data.sources,
          messageId: data.messageId ?? undefined,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function sendFeedback(messageId: string, feedback: Feedback) {
    // Optimistic UI: toggle locally first, then persist. Feedback is
    // best-effort — it must never block or break the chat.
    setMessages((prev) =>
      prev.map((m) =>
        m.messageId === messageId
          ? { ...m, feedback: m.feedback === feedback ? undefined : feedback }
          : m
      )
    );
    postFeedback(messageId, feedback).catch(() => {});
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
    send,
    sendFeedback,
    newConversation,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
