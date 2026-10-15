const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 150;

// Placed between pages, so a page break also counts as a paragraph break.
const PAGE_SEPARATOR = '\n\n';

// Places a chunk may end, best first. Each pattern matches the separator a
// chunk ends after.
const BOUNDARIES = [
  /\n\s*\n/g, // paragraph
  /\n/g, // line
  /[.!?]["')\]]*\s+/g, // sentence
  /\s+/g, // word
];

// A chunk ends at the best boundary found in its second half. Ending earlier
// would leave chunks much shorter than the target size.
const MIN_CHUNK_FRACTION = 0.5;

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

// Where the chunk starting at `start` should end: after the best boundary
// between minEnd and maxEnd, or exactly at maxEnd if there is none.
function findChunkEnd(text, start, chunkSize) {
  const maxEnd = start + chunkSize;
  if (maxEnd >= text.length) return text.length;

  const minEnd = start + Math.floor(chunkSize * MIN_CHUNK_FRACTION);
  const window = text.slice(start, maxEnd);
  for (const pattern of BOUNDARIES) {
    let lastEnd = -1;
    for (const match of window.matchAll(pattern)) {
      const end = start + match.index + match[0].length;
      if (end >= minEnd) lastEnd = end;
    }
    if (lastEnd !== -1) return lastEnd;
  }
  return maxEnd;
}

// Where the chunk after [start, end) should start: at most `overlap`
// characters before `end`, at the first line or sentence start in that
// range, or failing that the first word start, so no chunk opens mid-word.
function findNextStart(text, start, end, overlap) {
  const from = Math.max(end - overlap, start + 1);
  const overlapText = text.slice(from, end);

  let next = end;
  const sentence = /(?:\n|[.!?]["')\]]*\s)\s*(?=\S)/.exec(overlapText);
  if (sentence) {
    next = from + sentence.index + sentence[0].length;
  } else if (/\s/.test(text[from - 1])) {
    next = from;
  } else {
    const word = /\s+(?=\S)/.exec(overlapText);
    if (word) next = from + word.index + word[0].length;
  }

  while (next < text.length && /\s/.test(text[next])) next++;
  return next;
}

/**
 * Splits page texts into overlapping chunks for embedding.
 *
 * Chunks are at most `chunkSize` characters and end at the best natural
 * boundary available (paragraph, then line, sentence, word). Each chunk
 * repeats up to `chunkOverlap` characters from the end of the previous one,
 * so text cut at a boundary still appears whole in one of them.
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
  if (chunkOverlap >= chunkSize * MIN_CHUNK_FRACTION) {
    // Otherwise a chunk could start before the previous one and never advance.
    throw new Error(
      `chunkOverlap (${chunkOverlap}) must be less than half of chunkSize (${chunkSize})`
    );
  }

  const { text, pageStarts } = joinPages(pages);
  const chunks = [];
  let start = text.search(/\S/);
  if (start === -1) return chunks;

  while (start < text.length) {
    const end = findChunkEnd(text, start, chunkSize);
    const raw = text.slice(start, end);
    const trimmedStart = start + raw.search(/\S/);
    const chunkText = raw.trim();
    if (chunkText) {
      chunks.push({
        index: chunks.length,
        text: chunkText,
        pageStart: pageAt(pageStarts, trimmedStart),
        pageEnd: pageAt(pageStarts, trimmedStart + chunkText.length - 1),
      });
    }
    if (end >= text.length) break;
    start = findNextStart(text, start, end, chunkOverlap);
  }

  return chunks;
}

module.exports = { chunkPages, DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_OVERLAP };
