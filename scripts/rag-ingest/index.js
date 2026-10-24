const fs = require('node:fs');

const USAGE = 'Usage: npm run rag:ingest -- <file.pdf> <ownerId> <documentId>';

// Runs RAG ingestion on a local PDF, for manual testing of src/rag without
// the API. Writes chunks/{documentId}_{n} in Firestore; the ids do not have
// to match existing users or documents.
async function ingestLocalPdf() {
  const [filePath, ownerId, documentId] = process.argv.slice(2);
  if (!filePath || !ownerId || !documentId) {
    throw new Error(USAGE);
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Required after checking the arguments so usage errors are reported even
  // when the GCP env variables are not set yet.
  const { ingestPdf } = require('../../src/rag');
  const { embedder, vectorStore, docling, gemini } = require('../../src/lib/rag');

  const startedAt = Date.now();
  const { pageCount, chunkCount } = await ingestPdf(
    fs.readFileSync(filePath),
    { ownerId, documentId },
    { embedder, vectorStore, docling, gemini }
  );
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `Ingested ${filePath}: ${pageCount} pages, ${chunkCount} chunks in ${seconds}s ` +
      `(chunks/${documentId}_0 to chunks/${documentId}_${chunkCount - 1})`
  );
}

ingestLocalPdf().catch((err) => {
  console.error(`Ingestion failed: ${err.message}`);
  process.exitCode = 1;
});
