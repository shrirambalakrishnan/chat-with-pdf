/**
 * Embedder backed by a Gemini embedding model.
 *
 * Every embedder implements the same contract, so ingestion and retrieval do
 * not know which model they call:
 *
 * - embedDocuments(texts): resolves to one vector per text, in order, each
 *   embedded for retrieval as a document.
 * - embedQuery(text): resolves to one vector for a question, embedded to be
 *   matched against document vectors.
 *
 * `client` is a GoogleGenAI instance from @google/genai (Vertex AI mode);
 * the caller creates and configures it.
 */
function createGeminiEmbedder({ client, model, dimensions }) {
  // Documents and questions use the same model and dimensions, and differ
  // only in task type. If either differed, questions would match nothing.
  async function embed(text, taskType) {
    const response = await client.models.embedContent({
      model,
      contents: text,
      config: {
        taskType,
        // gemini-embedding-001 returns 3072 dimensions by default, and
        // Firestore vectors hold at most 2048. 768 is a recommended size that
        // trades a small quality loss for less storage and faster search.
        outputDimensionality: dimensions,
        // Fail instead of silently embedding only the first part of a text
        // over 2048 tokens. Chunks of 200 words and questions of at most 2,000
        // characters are far below that limit, so this is a safety net.
        autoTruncate: false,
      },
    });
    const values = response.embeddings?.[0]?.values;
    if (values?.length !== dimensions) {
      throw new Error(
        `Expected a ${dimensions}-dimension embedding from ${model}, got ${values?.length ?? 'none'}`
      );
    }
    return values;
  }

  // Gemini embedding models on Vertex AI take one text per request, so each
  // chunk is one request, sent one after another.
  async function embedDocuments(texts) {
    const vectors = [];
    for (const text of texts) {
      vectors.push(await embed(text, 'RETRIEVAL_DOCUMENT'));
    }
    return vectors;
  }

  // The whole question is embedded as one vector, not chunked.
  function embedQuery(text) {
    return embed(text, 'RETRIEVAL_QUERY');
  }

  return { embedDocuments, embedQuery };
}

module.exports = { createGeminiEmbedder };
