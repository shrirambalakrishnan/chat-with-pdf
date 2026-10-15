// Embeddings for text that will be searched. Questions are embedded with
// RETRIEVAL_QUERY (chat, #3), using the same model and dimensions.
const TASK_TYPE_DOCUMENT = 'RETRIEVAL_DOCUMENT';

// Gemini embedding models on Vertex AI take one text per request, so chunks
// are embedded with parallel requests, at most this many at a time.
const DEFAULT_CONCURRENCY = 5;

// Retries for rate limits and transient server errors, waiting 1s, 2s, 4s...
const DEFAULT_MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1000;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 503]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Calls fn on every item, at most `limit` at a time. Results keep item order.
// After the first failure no new calls start, and the failure is thrown.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  let failed = false;
  async function worker() {
    while (!failed && next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function withRetry(fn, maxRetries) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxRetries || !RETRYABLE_STATUS_CODES.has(err.status)) throw err;
      // Jitter spreads out parallel requests that were rate-limited together.
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt * (0.5 + Math.random()));
    }
  }
}

// Scales a vector to length 1. Embeddings shortened with outputDimensionality
// are not normalized by the model; normalized vectors give the same ranking
// under cosine, dot product and Euclidean distance, whichever store is used.
function normalize(values) {
  const length = Math.hypot(...values);
  return values.map((v) => v / length);
}

/**
 * Creates an embedder backed by a Gemini embedding model.
 *
 * `client` is a GoogleGenAI instance from @google/genai (Vertex AI mode);
 * the caller creates and configures it.
 *
 * Returns { dimensions, embedDocuments(texts) }, where embedDocuments
 * resolves to one normalized vector per text, in order.
 */
function createGeminiEmbedder({
  client,
  model,
  dimensions,
  concurrency = DEFAULT_CONCURRENCY,
  maxRetries = DEFAULT_MAX_RETRIES,
}) {
  async function embed(text, taskType) {
    const response = await withRetry(
      () =>
        client.models.embedContent({
          model,
          contents: text,
          // autoTruncate false: fail loudly instead of embedding part of a chunk.
          config: { taskType, outputDimensionality: dimensions, autoTruncate: false },
        }),
      maxRetries
    );
    const values = response.embeddings?.[0]?.values;
    if (values?.length !== dimensions) {
      throw new Error(
        `Expected a ${dimensions}-dimension embedding from ${model}, got ${values?.length ?? 'none'}`
      );
    }
    return normalize(values);
  }

  return {
    dimensions,
    embedDocuments: (texts) =>
      mapWithConcurrency(texts, concurrency, (text) => embed(text, TASK_TYPE_DOCUMENT)),
  };
}

module.exports = { createGeminiEmbedder };
