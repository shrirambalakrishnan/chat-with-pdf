// Retrieval-augmented generation: ingestion, retrieval and answering.
// Everything this module needs (clients, model, settings) is passed in by
// the caller; nothing here reads environment variables.
const ingestPdf = require('./ingestPdf');
const { askPdf, TOP_K } = require('./askPdf');
const { chunkPages } = require('./chunkPages');
const { createGeminiEmbedder } = require('./embedder');
const { createGeminiGenerator } = require('./generator');
const { createFirestoreVectorStore } = require('./vectorStores/firestore');

module.exports = {
  ingestPdf,
  askPdf,
  TOP_K,
  chunkPages,
  createGeminiEmbedder,
  createGeminiGenerator,
  createFirestoreVectorStore,
};
