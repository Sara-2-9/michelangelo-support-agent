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
