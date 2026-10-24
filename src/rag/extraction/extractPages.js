const { extractText } = require('unpdf');

// A page has a text layer when unpdf finds any text on it. A scanned page
// that also carries stray text (a page number, a "Scanned by" stamp) counts
// as having one in v1.
function hasTextLayer(pageText) {
  return pageText.trim() !== '';
}

// Lowest docling OCR confidence whose text is kept: where docling's "good"
// grade starts. Docling recommends no threshold, so this was checked on the
// sample pages (#58). A lower score, or none, sends the page to Gemini.
const MIN_OCR_SCORE = 0.8;

function isOcrGoodEnough(score) {
  return score !== null && score >= MIN_OCR_SCORE;
}

/**
 * Extracts the text of a PDF, page by page.
 *
 * Resolves to an array where index 0 is page 1, with { text, route, score }
 * for each page. Every page gets an entry, with empty text if nothing could
 * be read from it, so indexes always line up with page numbers. `route`
 * names how the page was read: 'unpdf', 'docling-ocr' or 'gemini'. `score`
 * is docling's OCR confidence for pages without a text layer (#58), kept
 * for pages Gemini read again, and null for text-layer pages or when
 * docling gave none.
 *
 * unpdf reads the text layer of every page in one call, in the order the
 * text is stored in the PDF. Google Docs, Word and LaTeX store it in reading
 * order, columns included. PDFs that store it out of order (slides,
 * brochures) come out scrambled, and tables lose their structure (#49).
 *
 * Pages with no text layer (scans, photos) are read by docling with OCR, one
 * after another, and come back as markdown. When docling's OCR confidence
 * is below MIN_OCR_SCORE, or missing, the page is read again by Gemini and
 * Gemini's markdown is used instead (#54). The score can't catch every bad
 * page: text docling dropped doesn't lower it.
 *
 * `docling` is a client from createDoclingClient and `gemini` a page reader
 * from createGeminiPageReader; the caller creates both.
 */
async function extractPages(pdfBuffer, { docling, gemini }) {
  // pdf.js takes ownership of the bytes it is given, so pass a copy.
  const { text: pageTexts } = await extractText(new Uint8Array(pdfBuffer));

  const pages = [];
  for (const [index, pageText] of pageTexts.entries()) {
    if (hasTextLayer(pageText)) {
      pages.push({ text: pageText, route: 'unpdf', score: null });
    } else {
      const pageNumber = index + 1;
      const { markdown, ocrScore } = await docling.convertPage(pdfBuffer, pageNumber, { ocr: true });
      if (isOcrGoodEnough(ocrScore)) {
        pages.push({ text: markdown, route: 'docling-ocr', score: ocrScore });
      } else {
        const text = await gemini.readPage(pdfBuffer, pageNumber);
        pages.push({ text, route: 'gemini', score: ocrScore });
      }
    }
  }
  return pages;
}

module.exports = extractPages;
