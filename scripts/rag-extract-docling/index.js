const fs = require('node:fs');

const USAGE = 'Usage: npm run rag:extract:docling -- <file.pdf>';

// Sends every page of a local PDF to docling with OCR off, one call per
// page, with no text-layer check, and prints the markdown. To compare with
// rag:extract:unpdf on the same file. A page with no text layer comes out
// empty: with OCR off, docling has no text to read.
async function extractWithDocling() {
  const [filePath] = process.argv.slice(2);
  if (!filePath) {
    throw new Error(USAGE);
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Required after checking the arguments so usage errors are reported even
  // when the env variables are not set yet.
  const { getDocumentProxy } = require('unpdf');
  const { docling } = require('../../src/lib/rag');

  const pdfBuffer = fs.readFileSync(filePath);
  // pdf.js takes ownership of the bytes it is given, so pass a copy.
  const { numPages } = await getDocumentProxy(new Uint8Array(pdfBuffer));

  const startedAt = Date.now();
  const pages = [];
  for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
    pages.push(await docling.convertPage(pdfBuffer, pageNumber));
  }
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  pages.forEach((text, i) => {
    console.log(`--- page ${i + 1} ---\n${text || '(empty)'}\n`);
  });
  console.log(`${pages.length} pages in ${seconds}s (docling, OCR off)`);
}

extractWithDocling().catch((err) => {
  console.error(`Extraction failed: ${err.message}`);
  process.exitCode = 1;
});
