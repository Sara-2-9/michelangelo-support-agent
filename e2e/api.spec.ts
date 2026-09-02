/**
 * Suite E — Worker API security. Pure HTTP, no browser page needed.
 *
 * Locks in the security model: every mutating route sits behind the JWT
 * gate (401 without a token), while the public share route lives BEFORE
 * the gate and answers 404 (never 401) for unknown tokens — a broken
 * share link must not look like an auth error.
 *
 * These tests never reach the LLM and never write to the database, so
 * they are cheap and safe against any environment.
 */

import { test, expect } from "@playwright/test";

const RANDOM_UUID = "00000000-0000-4000-8000-000000000000";

test("GET /api/health is up", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
});

test("POST /api/chat without a token is rejected with 401", async ({ request }) => {
  const res = await request.post("/api/chat", { data: { message: "hello" } });
  expect(res.status()).toBe(401);
});

test("POST /api/feedback without a token is rejected with 401", async ({ request }) => {
  const res = await request.post("/api/feedback", { data: { messageId: RANDOM_UUID, rating: 1 } });
  expect(res.status()).toBe(401);
});

test("DELETE /api/conversations/:id without a token is rejected with 401", async ({ request }) => {
  const res = await request.delete(`/api/conversations/${RANDOM_UUID}`);
  expect(res.status()).toBe(401);
});

test("POST /api/conversations/:id/share without a token is rejected with 401", async ({
  request,
}) => {
  const res = await request.post(`/api/conversations/${RANDOM_UUID}/share`);
  expect(res.status()).toBe(401);
});

test("DELETE /api/account without a token is rejected with 401", async ({ request }) => {
  const res = await request.delete("/api/account");
  expect(res.status()).toBe(401);
});

test("GET /api/share/:token is PUBLIC: unknown token answers 404, not 401", async ({ request }) => {
  const res = await request.get(`/api/share/${RANDOM_UUID}`);
  expect(res.status()).toBe(404);
});

test("malformed share token also answers 404, not 401", async ({ request }) => {
  const res = await request.get("/api/share/not-a-real-token");
  expect(res.status()).toBe(404);
});

// The auth gate runs BEFORE route matching, so without a token even an
// unknown route answers 401 (route existence is never leaked).
test("unknown API routes without a token are rejected with 401", async ({ request }) => {
  const res = await request.get("/api/does-not-exist");
  expect(res.status()).toBe(401);
});
