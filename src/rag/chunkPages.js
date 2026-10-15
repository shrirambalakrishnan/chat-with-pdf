const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 150;

// Placed between pages when they are joined into one text.
const PAGE_SEPARATOR = '\n\n';

const isSpace = (char) => /\s/.test(char);

// Joins the pages into one text and records where each page starts in it.
function joinPages(pages) {
  const pageStarts = [];
  let text = '';
  pages.forEach((page, i) => {
    if (i > 0) text += PAGE_SEPARATOR;
    pageStarts.push(text.length);
    text += page;
  });
  return { text, pageStarts };
}

// 1-based page number of the character at offset.
function pageAt(pageStarts, offset) {
  let page = 0;
  while (page + 1 < pageStarts.length && pageStarts[page + 1] <= offset) page++;
  return page + 1;
}

/**
 * Splits page texts into overlapping chunks for embedding.
 *
 * Slides a window of `chunkSize` characters over the text; each chunk starts
 * about `chunkOverlap` characters before the previous one ended, so text cut
 * at a chunk edge still appears whole in the next chunk. Chunk edges are
 * moved to the nearest space so no word is cut in half.
 *
 * Chunks may cross page breaks. Each one records the pages it covers, for
 * citations.
 *
 * Takes the output of extractPages (index 0 is page 1) and returns
 * [{ index, text, pageStart, pageEnd }].
 */
function chunkPages(
  pages,
  { chunkSize = DEFAULT_CHUNK_SIZE, chunkOverlap = DEFAULT_CHUNK_OVERLAP } = {}
) {
  if (chunkOverlap >= chunkSize) {
    throw new Error(`chunkOverlap (${chunkOverlap}) must be less than chunkSize (${chunkSize})`);
  }

  const { text, pageStarts } = joinPages(pages);
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    // End the chunk at the last space in the window rather than mid-word.
    // The space must leave the chunk longer than the overlap, so the next
    // chunk still starts after this one.
    let end = Math.min(start + chunkSize, text.length);
    if (end < text.length && !isSpace(text[end])) {
      let space = end - 1;
      while (space > start + chunkOverlap && !isSpace(text[space])) space--;
      if (space > start + chunkOverlap) end = space;
    }

    const raw = text.slice(start, end);
    const chunkText = raw.trim();
    if (chunkText) {
      const textStart = start + raw.search(/\S/);
      chunks.push({
        index: chunks.length,
        text: chunkText,
        pageStart: pageAt(pageStarts, textStart),
        pageEnd: pageAt(pageStarts, textStart + chunkText.length - 1),
      });
    }
    if (end === text.length) break;

    // Step back for the overlap, then forward to the start of a word.
    let next = end - chunkOverlap;
    while (next < end && !isSpace(text[next - 1])) next++;
    start = next;
  }

  return chunks;
}

module.exports = { chunkPages, DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_OVERLAP };
