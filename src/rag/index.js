// Retrieval-augmented generation: ingestion now, retrieval with chat (#3).
// Everything this module needs (clients, model, settings) is passed in by
// the caller; nothing here reads environment variables.
const ingestPdf = require('./ingestPdf');
const { chunkPages } = require('./chunkPages');
const { createGeminiEmbedder } = require('./embedder');
const { createFirestoreVectorStore } = require('./vectorStores/firestore');

module.exports = {
  ingestPdf,
  chunkPages,
  createGeminiEmbedder,
  createFirestoreVectorStore,
};
