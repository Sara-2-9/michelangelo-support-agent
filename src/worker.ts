/**
 * Phase 5.1 — Cloudflare Worker: the agent as an HTTP API.
 *
 * Endpoints:
 *   POST /api/chat      { message, conversationId?, history? }
 *                       → { intent, text, sources, grounded, conversationId, messageId }
 *                       Creates a new conversation (channel "web") when no
 *                       conversationId is provided; logs the exchange.
 *   POST /api/feedback  { messageId, feedback: "up" | "down" }
 *                       → { ok: true } — thumbs up/down on an answer.
 *   GET  /api/health    → { ok: true }
 *
 * Runtime differences vs local scripts: no filesystem, no process.env —
 * config arrives via the Worker `env` binding (wrangler secrets).
 * The orchestrator was designed for this: config is injected, never global.
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
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "michelangelo-support-agent" });
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

      const orchestrator = createOrchestrator({
        supabaseUrl: env.SUPABASE_URL,
        supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY,
        cfAccountId: env.CLOUDFLARE_ACCOUNT_ID,
        cfApiToken: env.CLOUDFLARE_API_TOKEN,
      });

      const conversationId = body.conversationId ?? (await orchestrator.logger.createConversation("web"));
      const result = await orchestrator.handle(body.message, {
        conversationId,
        history: body.history ?? [],
      });

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

      const orchestrator = createOrchestrator({
        supabaseUrl: env.SUPABASE_URL,
        supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY,
        cfAccountId: env.CLOUDFLARE_ACCOUNT_ID,
        cfApiToken: env.CLOUDFLARE_API_TOKEN,
      });
      await orchestrator.logger.setFeedback(body.messageId, body.feedback);
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  },
};
