/**
 * API layer — the ONLY place that knows about HTTP, endpoints and the
 * response shape of our Worker. Components and context call these
 * functions; if the API changes, only this file does.
 *
 * All endpoints require the user's Supabase JWT (Phase 5.3): the Worker
 * verifies it and enforces ownership server-side.
 */

import type { ChatResponse, Feedback, SharedConversation } from "@/types/chat";

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

/**
 * Deletes ONE of the caller's conversations (messages cascade server-side).
 * The Worker verifies JWT + ownership (404 unknown, 403 foreign).
 */
export async function deleteConversation(conversationId: string, token: string): Promise<void> {
  const res = await fetch(`/api/conversations/${conversationId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
}

/**
 * Creates (or reuses) the public read-only link of one of the caller's
 * conversations and returns the ABSOLUTE share URL ready for the clipboard.
 */
export async function shareConversation(conversationId: string, token: string): Promise<string> {
  const res = await fetch(`/api/conversations/${conversationId}/share`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  const { shareToken } = (await res.json()) as { shareToken: string };
  return `${window.location.origin}/share/${shareToken}`;
}

/**
 * PUBLIC (no auth): loads a shared conversation by its token for the
 * read-only /share/:token page. The token is the access capability.
 */
export async function fetchSharedConversation(shareToken: string): Promise<SharedConversation> {
  const res = await fetch(`/api/share/${shareToken}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}
