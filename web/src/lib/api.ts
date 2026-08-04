/**
 * API layer — the ONLY place that knows about HTTP, endpoints and the
 * response shape of our Worker. Components and context call these
 * functions; if the API changes, only this file does.
 */

import type { ChatResponse, Feedback } from "@/types/chat";

export async function postChat(message: string, conversationId?: string): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversationId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

/** Best-effort by design: callers never await the result to block the UI. */
export async function postFeedback(messageId: string, feedback: Feedback): Promise<void> {
  await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId, feedback }),
  });
}
