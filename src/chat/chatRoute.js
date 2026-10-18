const express = require('express');
const { findDocument } = require('../lib/documents');
const requireUser = require('../middleware/requireUser');
const { DOCUMENT_STATUS, MAX_MESSAGE_LENGTH } = require('../constants');
const chatWithDocument = require('./chatWithDocument');

// Client chat with one document: POST /documents/:id/chat.
// Only validates the message, authorizes the caller and maps the result to
// HTTP; the logic lives in chatWithDocument. Removing this entry point means
// deleting this file and its mount in app.js.
const router = express.Router();

// Returns an error message if the body is invalid, or null if it is valid.
function validateChatBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Request body must be a JSON object';
  }

  const { message } = body;
  if (typeof message !== 'string' || !message.trim()) {
    return 'message is required and must be a non-empty string';
  }
  if (message.trim().length > MAX_MESSAGE_LENGTH) {
    return `message must be at most ${MAX_MESSAGE_LENGTH} characters`;
  }
  return null;
}

router.post('/:id/chat', requireUser, async (req, res) => {
  const validationError = validateChatBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const snapshot = await findDocument(req.params.id);
  if (!snapshot) {
    return res.status(404).json({ error: 'Document not found' });
  }
  if (snapshot.data().ownerId !== req.userId) {
    return res.status(403).json({ error: 'Document belongs to another user' });
  }

  let result;
  try {
    result = await chatWithDocument(snapshot, req.body.message.trim());
  } catch (err) {
    // Every failure here is an upstream service: the embedding model, the
    // vector store or the chat model.
    console.error(`Chat failed for document ${snapshot.id}:`, err);
    return res.status(502).json({ error: err.message });
  }

  if (!result) {
    return res.status(409).json({
      error: `Document is ${snapshot.data().status}; only ${DOCUMENT_STATUS.READY} documents can be chatted with`,
    });
  }
  res.status(200).json(result);
});

module.exports = router;
