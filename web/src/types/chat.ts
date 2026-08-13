/** Shared types for the chat feature — single source of truth. */

export interface Source {
  source_url: string;
  page_title: string;
  section?: string | null;
}

/** One message as rendered in the UI (assistant messages carry metadata). */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  intent?: string;
  sources?: Source[];
  /** Server-side row id (assistant only) — needed to attach feedback. */
  messageId?: string;
  feedback?: "up" | "down";
  /** ISO timestamp — shown in the bubble corner (restyle step 4). */
  createdAt?: string;
}

/** Response contract of POST /api/chat (see src/worker.ts). */
export interface ChatResponse {
  intent: string;
  text: string;
  grounded: boolean;
  sources: Source[];
  conversationId: string;
  messageId: string | null;
}

export type Feedback = "up" | "down";

/** One row of the sidebar list (subset of the conversations table). */
export interface ConversationSummary {
  id: string;
  started_at: string;
  escalated: boolean;
  /** Beginning of the first user message — shown in the sidebar (mockup 7). */
  preview: string | null;
}

/** Response contract of the PUBLIC GET /api/share/:token (read-only view). */
export interface SharedConversation {
  started_at: string;
  messages: {
    role: "user" | "assistant";
    content: string;
    sources: Source[] | null;
    created_at: string;
  }[];
}
