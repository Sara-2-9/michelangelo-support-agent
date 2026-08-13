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
 *   DELETE /api/conversations/:id
 *                       → { ok: true } — deletes ONE of your conversations
 *                       (messages cascade via FK). 404/403 ownership pattern.
 *   POST /api/conversations/:id/share
 *                       → { shareToken } — creates/reuses the public read-only
 *                       link for one of your conversations.
 *   GET  /api/share/:token
 *                       → { started_at, messages[] } — PUBLIC (no auth): the
 *                       random token is the capability. Display fields only.
 *   DELETE /api/account → { ok: true } — deletes YOUR OWN account (JWT-identified);
 *                       cascades to conversations and messages (GDPR erasure).
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
  /** Static-assets binding (wrangler.toml [assets] binding): SPA fallback. */
  ASSETS: { fetch(request: Request): Promise<Response> };
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
    "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
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

    // Requests that match a static asset never reach this code (assets are
    // served first). Everything ELSE falls through to the Worker — including
    // SPA deep links like /privacy or /auth, which the not_found_handling
    // fallback does NOT serve on its own once a Worker script exists.
    // Delegate them back to the assets binding so the SPA router takes over.
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "michelangelo-support-agent" }, request);
    }

    const orchestrator = createOrchestrator({
      supabaseUrl: env.SUPABASE_URL,
      supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY,
      cfAccountId: env.CLOUDFLARE_ACCOUNT_ID,
      cfApiToken: env.CLOUDFLARE_API_TOKEN,
    });

    // PUBLIC share view — intentionally BEFORE the auth gate: the random,
    // unguessable token is the access capability (whoever has the link can
    // read). RLS is unaffected: reads go through the service key here.
    if (url.pathname.startsWith("/api/share/")) {
      const shareViewMatch = url.pathname.match(/^\/api\/share\/([0-9a-f-]{36})$/);
      if (shareViewMatch && request.method === "GET") {
        const shared = await orchestrator.logger.getSharedConversation(shareViewMatch[1]);
        if (!shared) return json({ error: "Shared conversation not found" }, request, 404);
        return json(shared, request);
      }
      // Malformed token or wrong method: a broken link is a 404, never a 401.
      return json({ error: "Shared conversation not found" }, request, 404);
    }

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

    // Single-conversation management (sidebar ellipsis menu):
    //   DELETE /api/conversations/:id        — delete one chat (messages cascade)
    //   POST   /api/conversations/:id/share  — create/reuse its public link
    // Same ownership pattern as /api/chat resume: 404 unknown, 403 foreign.
    const convMatch = url.pathname.match(/^\/api\/conversations\/([0-9a-f-]{36})(\/share)?$/);
    if (convMatch) {
      const conversationId = convMatch[1];
      const owner = await orchestrator.logger.getConversationOwner(conversationId);
      if (!owner) return json({ error: "Conversation not found" }, request, 404);
      if (owner !== userId) return json({ error: "Not your conversation" }, request, 403);

      if (!convMatch[2] && request.method === "DELETE") {
        await orchestrator.logger.deleteConversation(conversationId);
        return json({ ok: true }, request);
      }
      if (convMatch[2] === "/share" && request.method === "POST") {
        const shareToken = await orchestrator.logger.getOrCreateShareToken(conversationId);
        return json({ shareToken }, request);
      }
      return json({ error: "Not found" }, request, 404);
    }

    if (url.pathname === "/api/account" && request.method === "DELETE") {
      // Self-service GDPR erasure: the JWT identifies the caller, and only
      // THEIR OWN user id is ever passed to the admin API — an account can
      // only delete itself. The auth.users deletion cascades to
      // conversations and messages (FK on delete cascade).
      await orchestrator.logger.deleteUser(userId);
      return json({ ok: true }, request);
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
