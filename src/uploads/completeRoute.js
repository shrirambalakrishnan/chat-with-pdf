const express = require('express');
const { findDocument, serializeDocument } = require('../lib/documents');
const requireUser = require('../middleware/requireUser');
const { DOCUMENT_STATUS } = require('../constants');
const { completeUpload, OUTCOME } = require('./completeUpload');

// Client-signalled upload completion: POST /documents/:id/complete.
// Only authorizes the caller and maps outcomes to HTTP; the logic lives in
// completeUpload. Removing this entry point means deleting this file and
// its mount in app.js.
const router = express.Router();

// Responds for a document that has left pending_upload. Never changes it.
function respondWithSettledStatus(res, snapshot) {
  const { status, error } = snapshot.data();
  if (status === DOCUMENT_STATUS.FAILED) {
    return res.status(409).json({
      error: `Upload already failed: ${error}. Start again with POST /documents`,
    });
  }
  if (
    [DOCUMENT_STATUS.UPLOADED, DOCUMENT_STATUS.PROCESSING, DOCUMENT_STATUS.READY].includes(status)
  ) {
    return res.status(200).json(serializeDocument(snapshot));
  }
  throw new Error(`Document ${snapshot.id} has unexpected status: ${status}`);
}

router.post('/:id/complete', requireUser, async (req, res) => {
  const snapshot = await findDocument(req.params.id);
  if (!snapshot) {
    return res.status(404).json({ error: 'Document not found' });
  }
  if (snapshot.data().ownerId !== req.userId) {
    return res.status(403).json({ error: 'Document belongs to another user' });
  }

  const { outcome, snapshot: current, reason } = await completeUpload(snapshot);
  switch (outcome) {
    case OUTCOME.UPLOADED:
      return res.status(200).json(serializeDocument(current));
    case OUTCOME.FAILED:
      return res.status(422).json({ error: reason });
    case OUTCOME.NOT_UPLOADED:
      return res.status(409).json({ error: 'File has not been uploaded yet' });
    case OUTCOME.ALREADY_SETTLED:
      return respondWithSettledStatus(res, current);
    default:
      throw new Error(`Unknown upload outcome: ${outcome}`);
  }
});

module.exports = router;
