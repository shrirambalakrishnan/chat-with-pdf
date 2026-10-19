const express = require('express');
const { FieldValue } = require('@google-cloud/firestore');
const firestore = require('../lib/firestore');
const { bucket } = require('../lib/storage');
const requireUser = require('../middleware/requireUser');
const {
  PDF_CONTENT_TYPE,
  MAX_UPLOAD_SIZE_BYTES,
  DOCUMENT_STATUS,
} = require('../constants');

const router = express.Router();

// Returns an error message for the first invalid field, or null if the body is valid.
function validateCreateBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Request body must be a JSON object';
  }

  const { filename, contentType, size } = body;
  if (typeof filename !== 'string' || !filename.trim()) {
    return 'filename is required and must be a non-empty string';
  }
  if (typeof contentType !== 'string') {
    return 'contentType is required and must be a string';
  }
  if (contentType !== PDF_CONTENT_TYPE) {
    return `contentType must be ${PDF_CONTENT_TYPE}`;
  }
  if (!Number.isInteger(size)) {
    return 'size is required and must be an integer number of bytes';
  }
  if (size <= 0 || size > MAX_UPLOAD_SIZE_BYTES) {
    return `size must be between 1 and ${MAX_UPLOAD_SIZE_BYTES} bytes`;
  }
  return null;
}

router.post('/', requireUser, async (req, res) => {
  const validationError = validateCreateBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { filename, contentType, size } = req.body;

  const docRef = firestore.collection('documents').doc();
  const objectPath = `documents/${docRef.id}.pdf`;
  // A resumable upload session needs no signing, so it works with any
  // credentials, including a developer's gcloud login. The session fixes the
  // content type, and Cloud Storage rejects a PUT whose body is not exactly
  // the declared size. Start the session before writing the record so a
  // failure leaves no orphan record.
  const [uploadUrl] = await bucket.file(objectPath).createResumableUpload({
    metadata: { contentType: PDF_CONTENT_TYPE, contentLength: size },
  });

  await docRef.create({
    ownerId: req.userId,
    filename: filename.trim(),
    contentType,
    size,
    gcsUri: `gs://${bucket.name}/${objectPath}`,
    status: DOCUMENT_STATUS.PENDING_UPLOAD,
    error: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  res.status(201).json({
    documentId: docRef.id,
    uploadUrl,
    uploadHeaders: { 'Content-Type': PDF_CONTENT_TYPE },
  });
});

module.exports = router;
