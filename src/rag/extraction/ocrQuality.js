// v1 of the score. Every change to these constants, the allowed characters or
// the dictionary is recorded on #53, with the sample pages that justify it.

// Pages with fewer non-whitespace characters than this score 0.
const MIN_CHARS = 50;
// How hard junk characters pull the score down: 10% junk halves it, and 20%
// or more makes it 0.
const JUNK_WEIGHT = 5;
// Lowest score that is accepted. Lower scores go to the Gemini fallback (#54).
// 0.7 accepted two garbled sample pages (0.76 and 0.79); the lowest good one
// scored 0.83.
const MIN_SCORE = 0.8;

// Anything that is not a letter, a digit, whitespace, common punctuation,
// a currency sign or one of markdown's `| # *`. Without `|`, a page holding
// only a table would score 0 however good the OCR was.
const JUNK = /[^\p{L}\p{N}\s.,;:!?'"()\-%₹$/|#*]/gu;

// ~275,000 lowercase English words. Loaded on the first score, not at
// startup: it takes about 35 MB, and most PDFs have no scanned pages.
let dictionary = null;

function getDictionary() {
  dictionary ??= new Set(require('an-array-of-english-words'));
  return dictionary;
}

/**
 * Scores how readable the OCR output of one page is, from 0 to 1. Docling
 * returns no confidence, so the score is computed from the text alone:
 *
 * 1. Fewer than MIN_CHARS non-whitespace characters scores 0.
 * 2. Word ratio: the share of letter runs that are English words.
 * 3. Junk penalty: the share of characters that are not letters, digits,
 *    whitespace or allowed punctuation, times JUNK_WEIGHT, capped at 1.
 *
 * Score = word ratio × (1 − junk penalty). It catches garbled text, not
 * misreads that are still plausible: "99" read as "66", or "docling" as
 * "docking", scores as well as the right text.
 */
function ocrQuality(text) {
  const chars = text.replace(/\s/g, '').length;
  if (chars < MIN_CHARS) return 0;

  const tokens = text.toLowerCase().match(/[a-z]+/g) || [];
  const words = getDictionary();
  const wordRatio = tokens.filter((token) => words.has(token)).length / (tokens.length || 1);

  const junkRatio = (text.match(JUNK) || []).length / chars;

  return wordRatio * (1 - Math.min(junkRatio * JUNK_WEIGHT, 1));
}

module.exports = { ocrQuality, MIN_SCORE };
