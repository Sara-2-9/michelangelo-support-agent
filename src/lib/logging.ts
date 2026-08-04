/**
 * Phase 3, step 4 — Conversation logging and history.
 *
 * Every exchange is persisted: observability (how is the agent doing?),
 * eval material (real user questions are the best golden dataset — Phase 4),
 * and product insight for the Michelangelo team.
 *
 * This module is the ONLY place that talks to the conversations/messages
 * tables. RLS note: accessed via service key from backend/scripts only.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Intent } from "../router.js";
import type { RetrievedChunk } from "./retrieval.js";

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export function createLogger(supabaseUrl: string, supabaseKey: string) {
  const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

  /** Opens a new conversation session. userId arrives with Auth (Phase 5). */
  async function createConversation(channel = "cli", userId?: string): Promise<string> {
    const { data, error } = await supabase
      .from("conversations")
      .insert({ channel, user_id: userId ?? null })
      .select("id")
      .single();
    if (error) throw new Error(`createConversation: ${error.message}`);
    return data.id as string;
  }

  /**
   * Persists one message. Returns the inserted row id (null on failure):
   * the UI needs it to attach thumbs up/down feedback to a specific answer.
   * Failure is non-blocking: logging must never break the user's answer.
   */
  async function logMessage(
    conversationId: string,
    role: "user" | "assistant",
    content: string,
    meta?: {
      intent?: Intent;
      grounded?: boolean;
      sources?: RetrievedChunk[];
      model?: string;
      latencyMs?: number;
    }
  ): Promise<string | null> {
    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role,
        content,
        intent: meta?.intent ?? null,
        grounded: meta?.grounded ?? null,
        sources: meta?.sources?.map((s) => ({
          source_url: s.source_url,
          page_title: s.page_title,
          similarity: s.similarity,
        })) ?? null,
        similarity_top: meta?.sources?.[0]?.similarity ?? null,
        model: meta?.model ?? null,
        latency_ms: meta?.latencyMs ?? null,
      })
      .select("id")
      .single();
    if (error) {
      console.error(`⚠️  logMessage failed (non-blocking): ${error.message}`);
      return null;
    }
    return data.id as string;
  }

  /** Records thumbs up/down on an assistant message (Phase 5.2 UI). */
  async function setFeedback(messageId: string, feedback: "up" | "down"): Promise<void> {
    const { error } = await supabase.from("messages").update({ feedback }).eq("id", messageId);
    if (error) console.error(`⚠️  setFeedback failed (non-blocking): ${error.message}`);
  }

  /**
   * Loads the last N messages of a conversation, oldest first —
   * the memory context for resuming a conversation.
   */
  async function loadHistory(conversationId: string, limit = 10): Promise<HistoryMessage[]> {
    const { data, error } = await supabase
      .from("messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`loadHistory: ${error.message}`);
    return (data ?? []).reverse().map((m) => ({ role: m.role, content: m.content }));
  }

  /**
   * Marks a conversation as escalated to a human operator, storing a
   * summary of what happened (the handoff document).
   */
  async function markEscalated(conversationId: string, summary: string): Promise<void> {
    const { error } = await supabase
      .from("conversations")
      .update({ escalated: true, summary, ended_at: new Date().toISOString() })
      .eq("id", conversationId);
    if (error) console.error(`⚠️  markEscalated failed (non-blocking): ${error.message}`);
  }

  return { createConversation, logMessage, loadHistory, markEscalated, setFeedback };
}
