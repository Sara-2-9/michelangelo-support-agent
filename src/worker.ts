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
import { syncDocs } from "./lib/docs-sync.js";
import type { HistoryMessage } from "./lib/logging.js";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
}

/**
 * CORS: the UI is served SAME-ORIGIN (static assets + Worker in one deploy),
 * so browsers do not even preflight those requests. For any cross-origin
 * caller we only ever allow THIS Worker's own origin — derived from the
 * request URL, so it works on *.workers.dev now and on a custom domain
 * later, with zero config.
 */
function corsHeaders(request: Request) {
  return {
    "Access-Control-Allow-Origin": new URL(request.url).origin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data: unknown, request: Request, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) },
  });
}

/** Extracts the Bearer token from the Authorization header. */
function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Top-level guard: a thrown error (network hiccup, Supabase/Workers AI
    // unreachable, …) must become a JSON 500 + a log line — never the raw
    // platform error page ("error code: 10xx") the user cannot act on.
    try {
      return await handleRequest(request, env);
    } catch (err) {
      console.error("Unhandled error:", err);
      return json({ error: "Internal error — please try again" }, request, 500);
    }
  },

  /**
   * Phase 1b — Cron Trigger (schedule in wrangler.toml [triggers]):
   * re-indexes the documentation over HTTP, embedding only the delta.
   * Stats are logged → inspectable with `wrangler tail` or the dashboard.
   */
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil: (p: Promise<unknown>) => void }): Promise<void> {
    ctx.waitUntil(
      syncDocs({
        supabaseUrl: env.SUPABASE_URL,
        supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY,
        cfAccountId: env.CLOUDFLARE_ACCOUNT_ID,
        cfApiToken: env.CLOUDFLARE_API_TOKEN,
      }).catch((err) => console.error("Docs sync FAILED:", err))
    );
  },
};

async function handleRequest(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(request) });

    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "michelangelo-support-agent" }, request);
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
      return json({ error: "Missing or invalid Authorization: Bearer <token>" }, request, 401);
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      let body: { message?: string; conversationId?: string; history?: HistoryMessage[] };
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, request, 400);
      }
      if (!body.message || typeof body.message !== "string" || body.message.length > 4000) {
        return json({ error: "Field 'message' (string, max 4000 chars) is required" }, request, 400);
      }

      // Resuming? You must OWN the conversation (IDOR protection).
      let conversationId = body.conversationId;
      let history = body.history;
      if (conversationId) {
        const owner = await orchestrator.logger.getConversationOwner(conversationId);
        if (!owner) return json({ error: "Conversation not found" }, request, 404);
        if (owner !== userId) return json({ error: "Not your conversation" }, request, 403);
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
      }, request);
    }

    if (url.pathname === "/api/feedback" && request.method === "POST") {
      let body: { messageId?: string; feedback?: string };
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, request, 400);
      }
      if (!body.messageId || (body.feedback !== "up" && body.feedback !== "down")) {
        return json({ error: "Fields 'messageId' and 'feedback' (\"up\" | \"down\") are required" }, request, 400);
      }

      // Feedback only on messages of your own conversations.
      const owner = await orchestrator.logger.getMessageOwner(body.messageId);
      if (owner !== userId) return json({ error: "Not your message" }, request, 403);

      await orchestrator.logger.setFeedback(body.messageId, body.feedback);
      return json({ ok: true }, request);
    }

    return json({ error: "Not found" }, request, 404);
}
