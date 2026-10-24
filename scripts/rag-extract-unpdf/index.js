const fs = require('node:fs');

const USAGE = 'Usage: npm run rag:extract:unpdf -- <file.pdf>';

// Prints unpdf's text layer of every page of a local PDF, with no docling
// call and no text-layer check, to compare with rag:extract:docling on the
// same file. Needs no env variables.
async function extractWithUnpdf() {
  const [filePath] = process.argv.slice(2);
  if (!filePath) {
    throw new Error(USAGE);
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const { extractText } = require('unpdf');

  const startedAt = Date.now();
  // pdf.js takes ownership of the bytes it is given, so pass a copy.
  const { text: pages } = await extractText(new Uint8Array(fs.readFileSync(filePath)));
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  pages.forEach((text, i) => {
    console.log(`--- page ${i + 1} ---\n${text || '(empty)'}\n`);
  });
  console.log(`${pages.length} pages in ${seconds}s (unpdf)`);
}

extractWithUnpdf().catch((err) => {
  console.error(`Extraction failed: ${err.message}`);
  process.exitCode = 1;
});
