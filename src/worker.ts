/**
 * Phase 5.1 → 5.3 — Cloudflare Worker: the agent as an authenticated HTTP API.
 *
 * Endpoints (all but /api/health require `Authorization: Bearer <Supabase JWT>`):
 *   POST /api/chat      { message, conversationId?, history? }
 *                       → { intent, text, sources, grounded, conversationId, messageId }
 *                       Creates a new conversation (channel "web", tagged with the
 *                       caller's user_id) when no conversationId is provided.
 *                       Resuming requires OWNING the conversation (IDOR check);
 *                       history is loaded server-side from the DB.
 *   POST /api/feedback  { messageId, feedback: "up" | "down" }
 *                       → { ok: true } — only on messages of your own conversations.
 *   GET  /api/health    → { ok: true }
 *
 * Security model (Phase 5.3): reads for the sidebar go DIRECTLY from the
 * browser to Supabase (anon key + RLS policies); everything here goes
 * through the service key but is gated by JWT verification + ownership.
 *
 * Runtime differences vs local scripts: no filesystem, no process.env —
 * config arrives via the Worker `env` binding (wrangler secrets).
 */

import { createOrchestrator } from "./orchestrator.js";
import type { HistoryMessage } from "./lib/logging.js";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
}

const CORS = {
  "Access-Control-Allow-Origin": "*", // Phase 5.4: restrict to the real UI origin
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

/** Extracts the Bearer token from the Authorization header. */
function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "michelangelo-support-agent" });
    }

    // Everything below requires authentication.
    const orchestrator = createOrchestrator({
      supabaseUrl: env.SUPABASE_URL,
      supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY,
      cfAccountId: env.CLOUDFLARE_ACCOUNT_ID,
      cfApiToken: env.CLOUDFLARE_API_TOKEN,
    });

    const token = bearerToken(request);
    const userId = token ? await orchestrator.logger.getUserIdFromToken(token) : null;
    if (!userId) {
      return json({ error: "Missing or invalid Authorization: Bearer <token>" }, 401);
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      let body: { message?: string; conversationId?: string; history?: HistoryMessage[] };
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
      if (!body.message || typeof body.message !== "string" || body.message.length > 4000) {
        return json({ error: "Field 'message' (string, max 4000 chars) is required" }, 400);
      }

      // Resuming? You must OWN the conversation (IDOR protection).
      let conversationId = body.conversationId;
      let history = body.history;
      if (conversationId) {
        const owner = await orchestrator.logger.getConversationOwner(conversationId);
        if (!owner) return json({ error: "Conversation not found" }, 404);
        if (owner !== userId) return json({ error: "Not your conversation" }, 403);
        // Memory: load recent turns from the DB unless the caller passed them.
        history = history ?? (await orchestrator.logger.loadHistory(conversationId));
      } else {
        conversationId = await orchestrator.logger.createConversation("web", userId);
        history = history ?? [];
      }

      const result = await orchestrator.handle(body.message, { conversationId, history });

      return json({
        intent: result.intent,
        text: result.text,
        grounded: result.grounded,
        sources: result.sources.map((s) => ({
          source_url: s.source_url,
          page_title: s.page_title,
          section: s.section,
        })),
        conversationId,
        messageId: result.messageId ?? null,
      });
    }

    if (url.pathname === "/api/feedback" && request.method === "POST") {
      let body: { messageId?: string; feedback?: string };
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
      if (!body.messageId || (body.feedback !== "up" && body.feedback !== "down")) {
        return json({ error: "Fields 'messageId' and 'feedback' (\"up\" | \"down\") are required" }, 400);
      }

      // Feedback only on messages of your own conversations.
      const owner = await orchestrator.logger.getMessageOwner(body.messageId);
      if (owner !== userId) return json({ error: "Not your message" }, 403);

      await orchestrator.logger.setFeedback(body.messageId, body.feedback);
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  },
};
