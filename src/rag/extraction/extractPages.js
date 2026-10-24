const { extractText } = require('unpdf');

// A page has a text layer when unpdf finds any text on it. A scanned page
// that also carries stray text (a page number, a "Scanned by" stamp) counts
// as having one in v1.
function hasTextLayer(pageText) {
  return pageText.trim() !== '';
}

/**
 * Extracts the text of a PDF, one string per page.
 *
 * Resolves to an array where index 0 is page 1. A page without text (e.g. a
 * full-page image) is an empty string, so indexes always line up with page
 * numbers.
 *
 * unpdf reads the text layer of every page in one call, only to tell which
 * pages have one. Those pages are then read by docling (OCR off), one after
 * another, which keeps columns and tables in reading order and returns
 * markdown. The chunker splits it into words like any other text.
 *
 * `docling` is a client from createDoclingClient; the caller creates it.
 */
async function extractPages(pdfBuffer, { docling }) {
  // pdf.js takes ownership of the bytes it is given, so pass a copy.
  const { text: pageTexts } = await extractText(new Uint8Array(pdfBuffer));

  const pages = [];
  for (const [index, pageText] of pageTexts.entries()) {
    if (hasTextLayer(pageText)) {
      pages.push(await docling.convertPage(pdfBuffer, index + 1));
    } else {
      // No text layer: OCR comes in #50. An empty string keeps the page's slot,
      // so later pages keep their numbers.
      pages.push('');
    }
  }
  return pages;
}

module.exports = extractPages;
