/**
 * API layer — the ONLY place that knows about HTTP, endpoints and the
 * response shape of our Worker. Components and context call these
 * functions; if the API changes, only this file does.
 *
 * All endpoints require the user's Supabase JWT (Phase 5.3): the Worker
 * verifies it and enforces ownership server-side.
 */

import type { ChatResponse, Feedback } from "@/types/chat";

function authHeaders(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export async function postChat(
  message: string,
  conversationId: string | undefined,
  token: string
): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ message, conversationId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

/** Best-effort by design: callers never await the result to block the UI. */
export async function postFeedback(messageId: string, feedback: Feedback, token: string): Promise<void> {
  await fetch("/api/feedback", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ messageId, feedback }),
  });
}

/**
 * Deletes the caller's own account (and, by DB cascade, the whole
 * conversation history). The Worker derives the user id from the JWT —
 * only self-deletion is possible.
 */
export async function deleteAccount(token: string): Promise<void> {
  const res = await fetch("/api/account", {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
}
