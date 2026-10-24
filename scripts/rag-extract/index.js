const fs = require('node:fs');

const USAGE = 'Usage: npm run rag:extract -- <file.pdf>';

// Two decimals, truncated rather than rounded, so a score just under the
// 0.8 threshold (#58) never shows as 0.80.
function formatScore(score) {
  return (Math.floor(score * 100) / 100).toFixed(2);
}

// Runs only the extraction step of RAG ingestion on a local PDF, for manual
// checks of what each page comes out as. Nothing is chunked, embedded or
// written to Firestore.
async function extractLocalPdf() {
  const [filePath] = process.argv.slice(2);
  if (!filePath) {
    throw new Error(USAGE);
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Required after checking the arguments so usage errors are reported even
  // when the env variables are not set yet.
  const { extractPages } = require('../../src/rag');
  const { docling } = require('../../src/lib/rag');

  const startedAt = Date.now();
  const pages = await extractPages(fs.readFileSync(filePath), { docling });
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  pages.forEach(({ text, route, score }, i) => {
    let label = route;
    if (route === 'docling-ocr') {
      label += score === null ? ', no ocr score' : `, ocr score ${formatScore(score)}`;
    }
    console.log(`--- page ${i + 1} (${label}) ---\n${text || '(empty)'}\n`);
  });
  console.log(`${pages.length} pages in ${seconds}s`);
}

extractLocalPdf().catch((err) => {
  console.error(`Extraction failed: ${err.message}`);
  process.exitCode = 1;
});
