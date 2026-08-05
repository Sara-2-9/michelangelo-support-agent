/**
 * Embeddings via the Cloudflare Workers AI REST API (bge-m3) — shared by
 * the local indexing script and the Worker cron sync.
 */

export const EMBEDDING_MODEL = "@cf/baai/bge-m3"; // multilingual: IT queries → EN docs

/**
 * Embeds a batch of texts.
 *
 * Adaptive batch splitting: if the provider answers "context overflow"
 * (the local token estimate can be way off vs the real tokenizer —
 * dense YAML/markdown tokenizes much worse than prose), the batch is
 * halved and retried recursively instead of trusting the estimate.
 */
export async function embedBatch(
  texts: string[],
  accountId: string,
  apiToken: string,
  log: (msg: string) => void = console.log
): Promise<number[][]> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${EMBEDDING_MODEL}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: texts }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (body.includes("Max context reached") && texts.length > 1) {
      const mid = Math.ceil(texts.length / 2);
      log(`   ⚠️  context overflow with ${texts.length} texts → splitting batch in two`);
      const left = await embedBatch(texts.slice(0, mid), accountId, apiToken, log);
      const right = await embedBatch(texts.slice(mid), accountId, apiToken, log);
      return [...left, ...right];
    }
    throw new Error(`Workers AI ${res.status}: ${body}`);
  }
  const json = (await res.json()) as { result: { data: number[][] } };
  return json.result.data;
}
