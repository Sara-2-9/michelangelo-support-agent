/**
 * Phase 4 — Eval harness.
 *
 * Runs the golden dataset (evals/dataset.json) against the REAL agent and
 * measures what matters:
 *
 *   - intent accuracy:     did the router pick the expected route?
 *   - retrieval hit-rate:  did the expected source page land in top-5?
 *   - rule checks:         does the answer include the expected facts?
 *   - refusal correctness: grounded/ungrounded as expected?
 *   - judge pass-rate:     for semantic cases, an LLM judge grades the
 *                          answer against a ground-truth statement
 *
 * Hybrid evaluation: deterministic rules where facts are punctual (free,
 * reproducible), LLM judge only where semantic judgment is needed.
 *
 * Usage: npm run eval
 * Output: console report + evals/report-<timestamp>.json
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { createOrchestrator } from "../src/orchestrator.js";
import { MODEL_GENERATION } from "../src/lib/models.js";
import type { Intent } from "../src/router.js";

for (const line of readFileSync(".env", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = process.env;

interface EvalCase {
  id: string;
  question: string;
  expected_intent: Intent | Intent[];
  expected_source_contains?: string;
  answer_must_include?: string[];
  expect_grounded?: boolean;
  judge_ground_truth?: string;
  notes?: string;
}

interface CaseResult {
  id: string;
  pass: boolean;
  failures: string[];
  intent: string;
  grounded: boolean;
  latency_ms: number;
  answer_preview: string;
}

const dataset = JSON.parse(readFileSync("evals/dataset.json", "utf-8")) as { cases: EvalCase[] };

const orchestrator = createOrchestrator({
  supabaseUrl: SUPABASE_URL!,
  supabaseKey: SUPABASE_SERVICE_ROLE_KEY!,
  cfAccountId: CLOUDFLARE_ACCOUNT_ID!,
  cfApiToken: CLOUDFLARE_API_TOKEN!,
});

const workersAi = createOpenAICompatible({
  name: "workers-ai",
  baseURL: `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
  apiKey: CLOUDFLARE_API_TOKEN!,
});

/** LLM judge: grades semantic correctness against a ground truth. */
async function judge(question: string, answer: string, groundTruth: string): Promise<boolean> {
  const { text } = await generateText({
    model: workersAi(MODEL_GENERATION),
    prompt: `You are grading a support agent's answer against a ground truth.

GROUND TRUTH: ${groundTruth}

USER QUESTION: ${question}

AGENT'S ANSWER: ${answer}

GRADING RUBRIC:
- PASS if the answer is consistent with the ESSENTIAL claim of the ground
  truth and does not invent facts that contradict it. Partial coverage is
  acceptable as long as what IS said is correct and honest about limits
  (e.g. saying "the docs do not cover X" is good behavior, not a failure).
- FAIL only if the answer contradicts the ground truth, invents features/
  facts, or misses the essential point entirely.

Reply with exactly one word: PASS or FAIL.`,
  });
  return text.trim().toUpperCase().startsWith("PASS");
}

async function evalCase(c: EvalCase): Promise<CaseResult> {
  const started = Date.now();
  const result = await orchestrator.handle(c.question); // no conversationId: evals don't pollute logs
  const failures: string[] = [];

  // 1. Intent
  const expected = Array.isArray(c.expected_intent) ? c.expected_intent : [c.expected_intent];
  if (!expected.includes(result.intent)) {
    failures.push(`intent: expected ${expected.join("/")}, got ${result.intent}`);
  }

  // 2. Retrieval hit-rate (source page in top-5)
  if (c.expected_source_contains) {
    const hit = result.sources.some((s) => s.source_url.includes(c.expected_source_contains!));
    if (!hit) failures.push(`retrieval: expected source containing "${c.expected_source_contains}" not in top-5`);
  }

  // 3. Rule-based fact checks (case-insensitive)
  const answerLower = result.text.toLowerCase();
  for (const token of c.answer_must_include ?? []) {
    if (!answerLower.includes(token.toLowerCase())) failures.push(`rule: answer missing "${token}"`);
  }

  // 4. Refusal correctness
  if (c.expect_grounded !== undefined && result.grounded !== c.expect_grounded) {
    failures.push(`grounded: expected ${c.expect_grounded}, got ${result.grounded}`);
  }

  // 5. LLM judge (semantic cases only)
  if (c.judge_ground_truth) {
    const verdict = await judge(c.question, result.text, c.judge_ground_truth);
    if (!verdict) failures.push("judge: answer does not convey the ground truth");
  }

  return {
    id: c.id,
    pass: failures.length === 0,
    failures,
    intent: result.intent,
    grounded: result.grounded,
    latency_ms: Date.now() - started,
    answer_preview: result.text.slice(0, 200),
  };
}

// --- run sequentially: free tier + rate limits ---
const results: CaseResult[] = [];
for (const c of dataset.cases) {
  const r = await evalCase(c);
  results.push(r);
  console.log(`${r.pass ? "✅" : "❌"} ${r.id} (${(r.latency_ms / 1000).toFixed(1)}s)${r.failures.length ? " — " + r.failures.join("; ") : ""}`);
}

// --- aggregate metrics ---
const byCategory = (prefix: string) => results.filter((r) => r.id.startsWith(prefix));
const passRate = (rs: CaseResult[]) => (rs.length ? Math.round((rs.filter((r) => r.pass).length / rs.length) * 100) : 0);
const avgLatency = Math.round(results.reduce((a, r) => a + r.latency_ms, 0) / results.length);

console.log(`\n═══════════════════════════════════`);
console.log(`OVERALL: ${passRate(results)}% (${results.filter((r) => r.pass).length}/${results.length})`);
for (const [label, prefix] of [["support_question", "sq"], ["bug_report", "br"], ["troubleshooting", "tr"], ["off_topic", "ot"], ["edge cases", "edge"], ["meta", "meta"]] as const) {
  console.log(`  ${label.padEnd(18)} ${passRate(byCategory(prefix))}%`);
}
console.log(`avg latency: ${avgLatency}ms`);

const report = { timestamp: new Date().toISOString(), pass_rate: passRate(results), avg_latency_ms: avgLatency, results };
const file = `evals/report-${Date.now()}.json`;
writeFileSync(file, JSON.stringify(report, null, 2));
console.log(`report: ${file}`);
