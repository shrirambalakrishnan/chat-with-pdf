const { embedder, vectorStore, generator } = require('../lib/rag');
const { askPdf } = require('../rag');
const { DOCUMENT_STATUS } = require('../constants');

/**
 * Answers one question about a ready document from its chunks, citing pages.
 *
 * Shared by every way of chatting with a document (the client's
 * POST /documents/:id/chat today). It knows nothing about callers, so
 * authorization and validating the message are the entry point's job.
 *
 * Nothing is stored: each question is answered on its own, without history.
 *
 * Resolves to null if the document is not ready, or to { answer, sources }.
 * Rejects if the embedding model, the vector store or the chat model fails.
 */
async function chatWithDocument(snapshot, message) {
  const { status, ownerId } = snapshot.data();
  if (status !== DOCUMENT_STATUS.READY) return null;

  return askPdf(
    message,
    { ownerId, documentId: snapshot.id },
    { embedder, vectorStore, generator }
  );
}

module.exports = chatWithDocument;
