const { extractText } = require('unpdf');

/**
 * Extracts the text of a PDF, one string per page.
 *
 * Resolves to an array where index 0 is page 1. A page without text (e.g. a
 * full-page image) is an empty string, so indexes always line up with page
 * numbers.
 *
 * unpdf reads the text layer of every page in one call; the pages are then
 * handled one by one, in order.
 *
 * Page texts are returned as unpdf gives them: the chunker splits them into
 * words, which takes care of whitespace. Words hyphenated across lines
 * ("exam-\nple") are not rejoined in v1.
 */
async function extractPages(pdfBuffer) {
  // pdf.js takes ownership of the bytes it is given, so pass a copy.
  const { text: pageTexts } = await extractText(new Uint8Array(pdfBuffer));

  const pages = [];
  for (const pageText of pageTexts) {
    pages.push(pageText);
  }
  return pages;
}

module.exports = extractPages;
