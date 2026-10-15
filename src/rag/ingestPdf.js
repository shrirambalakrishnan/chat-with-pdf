const extractPages = require('./extractPages');
const { chunkPages } = require('./chunkPages');

// Deterministic, so re-ingesting a document replaces its chunks. Another
// vector store uses the same id as its vector id.
const chunkId = (documentId, index) => `${documentId}_${index}`;

/**
 * Ingests one PDF for retrieval: extracts its text page by page, splits it
 * into overlapping chunks, embeds each chunk and stores the chunks with
 * their embeddings.
 *
 * Knows nothing about HTTP, the documents collection or document status:
 * `ownerId` and `documentId` are only stored on each chunk so retrieval can
 * filter by them. The embedder and vector store are passed in, so either
 * can be swapped without touching this pipeline.
 *
 * Any chunks already stored for the document are replaced. Resolves to
 * { pageCount, chunkCount }.
 */
async function ingestPdf(
  pdfBuffer,
  { ownerId, documentId },
  { embedder, vectorStore, chunkSize, chunkOverlap }
) {
  const pages = await extractPages(pdfBuffer);
  const chunks = chunkPages(pages, { chunkSize, chunkOverlap });
  if (chunks.length === 0) {
    throw new Error('The PDF has no extractable text');
  }

  const embeddings = await embedder.embedDocuments(chunks.map((chunk) => chunk.text));

  // A re-run may produce fewer chunks than last time; clear the old ones so
  // none are left behind.
  await vectorStore.deleteByDocument(documentId);
  await vectorStore.upsert(
    chunks.map((chunk, i) => ({
      id: chunkId(documentId, chunk.index),
      ownerId,
      documentId,
      ...chunk,
      embedding: embeddings[i],
    }))
  );

  return { pageCount: pages.length, chunkCount: chunks.length };
}

module.exports = ingestPdf;
