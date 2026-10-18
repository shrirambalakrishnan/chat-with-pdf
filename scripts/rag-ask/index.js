const USAGE = 'Usage: npm run rag:ask -- <ownerId> <documentId> "<question>"';

// Answers one question about an ingested document, for manual testing of
// src/rag without the API. Prints the answer, then the chunks it was given
// as sources, most relevant first.
async function askDocument() {
  const [ownerId, documentId, question] = process.argv.slice(2);
  if (!ownerId || !documentId || !question) {
    throw new Error(USAGE);
  }

  // Required after checking the arguments so usage errors are reported even
  // when the GCP env variables are not set yet.
  const { askPdf } = require('../../src/rag');
  const { embedder, vectorStore, generator } = require('../../src/lib/rag');

  const { answer, sources } = await askPdf(
    question,
    { ownerId, documentId },
    { embedder, vectorStore, generator }
  );

  console.log(`${answer}\n\nSources (${sources.length}):`);
  for (const { chunkId, pageStart, pageEnd } of sources) {
    const pages = pageStart === pageEnd ? `p${pageStart}` : `p${pageStart}-${pageEnd}`;
    console.log(`- ${chunkId} (${pages})`);
  }
}

askDocument().catch((err) => {
  console.error(`Ask failed: ${err.message}`);
  process.exitCode = 1;
});
