/**
 * Embedder backed by a Gemini embedding model.
 *
 * Every embedder implements the same contract, so ingestion does not know
 * which model it calls:
 *
 * - embedDocuments(texts): resolves to one vector per text, in order, each
 *   embedded for retrieval as a document.
 *
 * `client` is a GoogleGenAI instance from @google/genai (Vertex AI mode);
 * the caller creates and configures it.
 */
function createGeminiEmbedder({ client, model, dimensions }) {
  async function embedDocument(text) {
    const response = await client.models.embedContent({
      model,
      contents: text,
      config: {
        // Chunks are embedded as documents; questions will use RETRIEVAL_QUERY
        // (#3), with the same model and dimensions.
        taskType: 'RETRIEVAL_DOCUMENT',
        // gemini-embedding-001 returns 3072 dimensions by default, and
        // Firestore vectors hold at most 2048. 768 is a recommended size that
        // trades a small quality loss for less storage and faster search.
        outputDimensionality: dimensions,
        // Fail instead of silently embedding only the first part of a chunk
        // over 2048 tokens. Chunks of 200 words are far below that limit, so
        // this is a safety net.
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
      vectors.push(await embedDocument(text));
    }
    return vectors;
  }

  return { embedDocuments };
}

module.exports = { createGeminiEmbedder };
