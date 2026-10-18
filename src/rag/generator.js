/**
 * Generator backed by a Gemini chat model.
 *
 * Every generator implements the same contract, so askPdf does not know
 * which model it calls:
 *
 * - generate({ systemInstruction, prompt }): resolves to the answer text for
 *   one user turn, following the rules in `systemInstruction`.
 *
 * `client` is a GoogleGenAI instance from @google/genai (Vertex AI mode);
 * the caller creates and configures it.
 */
function createGeminiGenerator({ client, model }) {
  async function generate({ systemInstruction, prompt }) {
    let response;
    try {
      response = await client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        // Default generation and thinking settings.
        config: { systemInstruction },
      });
    } catch (err) {
      // Name the model, so a wrong CHAT_MODEL (404) or a model not offered
      // in CHAT_LOCATION is easy to spot.
      throw new Error(`Chat model "${model}" failed: ${err.message}`, { cause: err });
    }

    const text = response.text?.trim();
    if (!text) {
      // A blocked prompt has no candidates and a blockReason; a blocked or
      // cut-off answer has a finishReason such as SAFETY or MAX_TOKENS.
      const reason =
        response.promptFeedback?.blockReason ??
        response.candidates?.[0]?.finishReason ??
        'unknown';
      throw new Error(`Chat model "${model}" returned no answer (reason: ${reason})`);
    }
    return text;
  }

  return { generate };
}

module.exports = { createGeminiGenerator };
