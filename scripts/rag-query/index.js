const USAGE = 'Usage: npm run rag:query -- <ownerId> <documentId> "<question>"';

// Same top K that askPdf will use (#30).
const TOP_K = 5;

// Runs RAG retrieval for one question on an ingested document, for manual
// testing of src/rag without the API. Prints the nearest chunks with their
// pages and distance, nearest first.
async function queryDocument() {
  const [ownerId, documentId, question] = process.argv.slice(2);
  if (!ownerId || !documentId || !question) {
    throw new Error(USAGE);
  }

  // Required after checking the arguments so usage errors are reported even
  // when the GCP env variables are not set yet.
  const { embedder, vectorStore } = require('../../src/lib/rag');

  const vector = await embedder.embedQuery(question);
  const results = await vectorStore.query(vector, { ownerId, documentId }, TOP_K);

  console.log(`${results.length} chunks for "${question}" in ${documentId}:`);
  for (const { id, text, pageStart, pageEnd, distance } of results) {
    const pages = pageStart === pageEnd ? `p${pageStart}` : `p${pageStart}-${pageEnd}`;
    console.log(`\n${id} (${pages}, distance ${distance.toFixed(4)})\n${text}`);
  }
}

queryDocument().catch((err) => {
  console.error(`Query failed: ${err.message}`);
  process.exitCode = 1;
});
