const { SYSTEM_PROMPT, buildPrompt } = require('./prompts');

// How many chunks are retrieved and given to the model for each question.
const TOP_K = 5;

/**
 * Answers one question about one PDF: embeds the question, retrieves the
 * nearest chunks of that owner's document, and asks the model to answer
 * from them only, citing pages.
 *
 * Knows nothing about HTTP or document status. The embedder, vector store
 * and generator are passed in, so each can be swapped without touching this
 * pipeline.
 *
 * Resolves to { answer, sources }. `sources` are the retrieved chunks, in
 * retrieval order (most relevant first), not parsed from the answer. If no
 * chunks are found the model is still asked, and says it couldn't find the
 * answer.
 */
async function askPdf(question, { ownerId, documentId }, { embedder, vectorStore, generator }) {
  const vector = await embedder.embedQuery(question);
  const chunks = await vectorStore.query(vector, { ownerId, documentId }, TOP_K);

  const answer = await generator.generate({
    systemInstruction: SYSTEM_PROMPT,
    prompt: buildPrompt(question, chunks),
  });

  const sources = chunks.map(({ id, pageStart, pageEnd, text }) => ({
    chunkId: id,
    pageStart,
    pageEnd,
    text,
  }));
  return { answer, sources };
}

module.exports = { askPdf, TOP_K };
