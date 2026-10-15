const { GoogleGenAI } = require('@google/genai');
const config = require('../config');
const firestore = require('./firestore');
const { createGeminiEmbedder, createFirestoreVectorStore } = require('../rag');

// The RAG module reads no config; this wires its dependencies from env.
const genai = new GoogleGenAI({
  vertexai: true,
  project: config.gcp.projectId,
  location: config.gcp.vertexLocation,
  googleAuthOptions: { keyFilename: config.gcp.credentialsPath },
});

const embedder = createGeminiEmbedder({
  client: genai,
  model: config.embedding.model,
  dimensions: config.embedding.dimensions,
});

const vectorStore = createFirestoreVectorStore({ firestore });

module.exports = { embedder, vectorStore };
