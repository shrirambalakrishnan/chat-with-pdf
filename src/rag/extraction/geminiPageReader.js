const { PDFDocument } = require('pdf-lib');

const PROMPT =
  'Return the text of this page as markdown, in reading order, with tables as markdown tables. ' +
  'Return only the text: no comments, no code fences. If the page has no text, return an empty answer.';

// A PDF holding only the given page (1-based), so Gemini reads that page
// and is billed for it alone.
async function singlePagePdf(pdfBuffer, pageNumber) {
  const source = await PDFDocument.load(pdfBuffer);
  const single = await PDFDocument.create();
  const [page] = await single.copyPages(source, [pageNumber - 1]);
  single.addPage(page);
  return Buffer.from(await single.save());
}

/**
 * Reads one page of a PDF with a Gemini model, for scanned pages that
 * docling's OCR read badly (#54).
 *
 * - readPage(pdfBuffer, pageNumber): resolves to the markdown of one page
 *   (1-based), or '' if the page has no text.
 *
 * Gemini has no page range, so the page is copied into a PDF of its own.
 * Thinking is set to LOW: on the samples it was as accurate as the default
 * and much faster (6.7s instead of 66s on a blurry page). MINIMAL is not
 * supported by gemini-3.8-flash.
 *
 * `client` is a GoogleGenAI instance from @google/genai (Vertex AI mode);
 * the caller creates and configures it.
 */
function createGeminiPageReader({ client, model }) {
  async function readPage(pdfBuffer, pageNumber) {
    const pagePdf = await singlePagePdf(pdfBuffer, pageNumber);

    let response;
    try {
      response = await client.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'application/pdf', data: pagePdf.toString('base64') } },
              { text: PROMPT },
            ],
          },
        ],
        config: { thinkingConfig: { thinkingLevel: 'LOW' } },
      });
    } catch (err) {
      throw new Error(`Chat model "${model}" failed on page ${pageNumber}: ${err.message}`, {
        cause: err,
      });
    }

    // An empty answer that finished normally is a page with no text. A
    // blocked or cut-off answer has a blockReason or another finishReason.
    const reason =
      response.promptFeedback?.blockReason ?? response.candidates?.[0]?.finishReason;
    if (reason !== 'STOP') {
      throw new Error(
        `Chat model "${model}" did not finish reading page ${pageNumber} (reason: ${reason ?? 'unknown'})`
      );
    }
    return response.text?.trim() ?? '';
  }

  return { readPage };
}

module.exports = { createGeminiPageReader };
