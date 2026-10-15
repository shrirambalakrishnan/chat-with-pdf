const { extractText } = require('unpdf');

// Tidies one page of extracted text: unified line endings, single spaces,
// at most one blank line in a row. Newlines are kept because the chunker
// prefers to split on them.
function normalizePageText(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extracts the text layer of a PDF, one string per page.
 *
 * Resolves to an array where index 0 is page 1. A page without text (e.g. a
 * full-page image) is an empty string, so indexes always line up with page
 * numbers.
 */
async function extractPages(pdfBuffer) {
  // pdf.js takes ownership of the bytes it is given, so pass a copy.
  const { text } = await extractText(new Uint8Array(pdfBuffer));
  return text.map(normalizePageText);
}

module.exports = extractPages;
