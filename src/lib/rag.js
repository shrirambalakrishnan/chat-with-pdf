const { GoogleGenAI } = require('@google/genai');
const config = require('../config');
const firestore = require('./firestore');
const {
  createGeminiEmbedder,
  createGeminiGenerator,
  createFirestoreVectorStore,
} = require('../rag');

// The RAG module reads no config; this wires its dependencies from env.
// A Vertex AI client is bound to one location, and the chat model is not
// offered in every region the embedding model is, so each gets its own.
function vertexClient(location) {
  return new GoogleGenAI({
    vertexai: true,
    project: config.gcp.projectId,
    location,
  });
}

const embedder = createGeminiEmbedder({
  client: vertexClient(config.gcp.vertexLocation),
  model: config.embedding.model,
  dimensions: config.embedding.dimensions,
});

const vectorStore = createFirestoreVectorStore({ firestore });

const generator = createGeminiGenerator({
  client: vertexClient(config.chat.location),
  model: config.chat.model,
});

module.exports = { embedder, vectorStore, generator };
