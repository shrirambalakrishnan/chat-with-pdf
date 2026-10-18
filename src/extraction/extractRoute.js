const express = require('express');
const { findDocument, serializeDocument } = require('../lib/documents');
const requireUser = require('../middleware/requireUser');
const { DOCUMENT_STATUS } = require('../constants');
const extractDocument = require('./extractDocument');

// Client-started extraction: POST /documents/:id/extract.
// Only authorizes the caller and maps the result to HTTP; the logic lives in
// extractDocument. Removing this entry point means deleting this file and
// its mount in app.js.
const router = express.Router();

router.post('/:id/extract', requireUser, async (req, res) => {
  const snapshot = await findDocument(req.params.id);
  if (!snapshot) {
    return res.status(404).json({ error: 'Document not found' });
  }
  if (snapshot.data().ownerId !== req.userId) {
    return res.status(403).json({ error: 'Document belongs to another user' });
  }

  const current = await extractDocument(snapshot);
  if (!current) {
    return res.status(409).json({
      error: `Document is ${snapshot.data().status}; only ${DOCUMENT_STATUS.UPLOADED} documents can be extracted`,
    });
  }

  const { status, error } = current.data();
  if (status === DOCUMENT_STATUS.FAILED) {
    return res.status(500).json({ error });
  }
  res.status(200).json(serializeDocument(current));
});

module.exports = router;
