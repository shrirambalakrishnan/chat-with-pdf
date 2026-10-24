/**
 * Client for docling-serve, which reads PDF pages in reading order, with
 * columns and tables, and returns them as markdown.
 *
 * - convertPage(pdfBuffer, pageNumber, { ocr }): resolves to the markdown of
 *   one page (1-based) of the PDF. By default it is read from the page's text
 *   layer with OCR off. With `ocr: true`, the text in the page's images is
 *   read with EasyOCR, for pages with no text layer (scans, photos).
 *
 * `url` is the docling service's URL, with no trailing slash. `getToken`
 * resolves to an ID token the service accepts; the caller decides how it is
 * made.
 */
function createDoclingClient({ url, getToken }) {
  async function convertPage(pdfBuffer, pageNumber, { ocr = false } = {}) {
    const form = new FormData();
    // Docling gets the whole PDF and converts only the page in page_range,
    // so the PDF never has to be split.
    form.append('files', new Blob([pdfBuffer], { type: 'application/pdf' }), 'document.pdf');
    form.append('to_formats', 'md');
    form.append('do_ocr', String(ocr));
    if (ocr) {
      // Not RapidOCR: its direction classifier turns some text upside down,
      // and it read "99" as "66" on a sample scan. Docling's default preset
      // (auto) gave the same result there; EasyOCR read it right (#50).
      form.append('ocr_preset', 'easyocr');
    }
    // page_range is a [first, last] pair, sent as two fields of the same name.
    form.append('page_range', String(pageNumber));
    form.append('page_range', String(pageNumber));

    const response = await fetch(`${url}/v1/convert/file`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await getToken()}` },
      body: form,
    });
    if (!response.ok) {
      throw new Error(`Docling returned ${response.status} for page ${pageNumber}`);
    }
    const { document } = await response.json();
    return document.md_content;
  }

  return { convertPage };
}

module.exports = { createDoclingClient };
