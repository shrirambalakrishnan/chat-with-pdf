const extractPages = require('./extraction/extractPages');
const { chunkPages } = require('./chunkPages');

// Deterministic, so re-ingesting a document overwrites its chunks instead of
// duplicating them. Another vector store uses the same id as its vector id.
const chunkId = (documentId, index) => `${documentId}_${index}`;

/**
 * Ingests one PDF for retrieval: extracts its text page by page, splits it
 * into overlapping chunks, embeds each chunk and stores the chunks with
 * their embeddings.
 *
 * Knows nothing about HTTP, the documents collection or document status:
 * `ownerId` and `documentId` are only stored on each chunk so retrieval can
 * filter by them. The embedder, vector store and docling client are passed
 * in, so any of them can be swapped without touching this pipeline.
 *
 * Chunks already stored for the document are overwritten through their
 * deterministic ids. Resolves to { pageCount, chunkCount }.
 */
async function ingestPdf(
  pdfBuffer,
  { ownerId, documentId },
  { embedder, vectorStore, docling, chunkWords, overlapWords }
) {
  const pages = await extractPages(pdfBuffer, { docling });
  const chunks = chunkPages(pages.map((page) => page.text), { chunkWords, overlapWords });
  if (chunks.length === 0) {
    throw new Error('The PDF has no extractable text');
  }

  const embeddings = await embedder.embedDocuments(chunks.map((chunk) => chunk.text));

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
