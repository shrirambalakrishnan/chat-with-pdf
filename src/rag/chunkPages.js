const DEFAULT_CHUNK_WORDS = 200;
const DEFAULT_OVERLAP_WORDS = 30;

// Every word of every page, each with the 1-based page it is on. Words are
// split on whitespace, so text without spaces (Chinese, Japanese) is not
// handled in v1: a whole page becomes one "word".
function toWords(pages) {
  return pages.flatMap((text, i) =>
    text
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => ({ word, page: i + 1 }))
  );
}

/**
 * Splits page texts into overlapping windows of words for embedding.
 *
 * Each chunk is `chunkWords` words long and repeats the last `overlapWords`
 * words of the previous one, so an idea cut at a chunk edge still appears
 * whole in the next chunk. Words are never cut in half. The chunk whose
 * window reaches the last word is the final one.
 *
 * Chunks may cross page breaks. Each one records the pages of its first and
 * last word, for citations.
 *
 * Takes the output of extractPages (index 0 is page 1) and returns
 * [{ index, text, pageStart, pageEnd }].
 */
function chunkPages(
  pages,
  { chunkWords = DEFAULT_CHUNK_WORDS, overlapWords = DEFAULT_OVERLAP_WORDS } = {}
) {
  if (overlapWords >= chunkWords) {
    throw new Error(`overlapWords (${overlapWords}) must be less than chunkWords (${chunkWords})`);
  }

  const words = toWords(pages);
  const step = chunkWords - overlapWords;
  const chunks = [];

  for (let start = 0; start < words.length; start += step) {
    const end = Math.min(start + chunkWords, words.length);
    const window = words.slice(start, end);
    chunks.push({
      index: chunks.length,
      text: window.map(({ word }) => word).join(' '),
      pageStart: window[0].page,
      pageEnd: window[window.length - 1].page,
    });
    if (end === words.length) break;
  }

  return chunks;
}

module.exports = { chunkPages, DEFAULT_CHUNK_WORDS, DEFAULT_OVERLAP_WORDS };
