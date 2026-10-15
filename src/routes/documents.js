const express = require('express');
const { FieldValue } = require('@google-cloud/firestore');
const firestore = require('../lib/firestore');
const { bucket, fileFromGcsUri } = require('../lib/storage');
const verifyUploadedPdf = require('../uploads/verifyUpload');
const requireUser = require('../middleware/requireUser');
const {
  PDF_CONTENT_TYPE,
  MAX_UPLOAD_SIZE_BYTES,
  UPLOAD_URL_EXPIRY_MS,
  DOCUMENT_STATUS,
} = require('../constants');

const router = express.Router();

// Firestore gRPC status codes.
const INVALID_ARGUMENT = 3;
const FAILED_PRECONDITION = 9;

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
  const expiresAt = new Date(Date.now() + UPLOAD_URL_EXPIRY_MS);

  // These headers are part of the signature, so Cloud Storage rejects a PUT
  // with a different content type or a body outside the size range.
  const uploadHeaders = {
    'Content-Type': PDF_CONTENT_TYPE,
    'x-goog-content-length-range': `1,${MAX_UPLOAD_SIZE_BYTES}`,
  };

  // Sign before writing the record so a signing failure leaves no orphan record.
  const [uploadUrl] = await bucket.file(objectPath).getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: expiresAt,
    contentType: PDF_CONTENT_TYPE,
    extensionHeaders: {
      'x-goog-content-length-range': uploadHeaders['x-goog-content-length-range'],
    },
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
    uploadHeaders,
    expiresAt: expiresAt.toISOString(),
  });
});


// Loads a document snapshot, or null if no document has that id.
async function findDocument(documentId) {
  try {
    const snapshot = await firestore.collection('documents').doc(documentId).get();
    return snapshot.exists ? snapshot : null;
  } catch (err) {
    // Ids Firestore cannot address (e.g. "..") can never match a document.
    if (err.code === INVALID_ARGUMENT) return null;
    throw err;
  }
}

function serializeDocument(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    createdAt: data.createdAt?.toDate().toISOString() ?? null,
    updatedAt: data.updatedAt?.toDate().toISOString() ?? null,
  };
}

// Updates the document only if nobody else changed it since it was read.
// Resolves to false if a concurrent request got there first.
async function updateIfUnchanged(snapshot, fields) {
  try {
    await snapshot.ref.update(
      { ...fields, updatedAt: FieldValue.serverTimestamp() },
      { lastUpdateTime: snapshot.updateTime }
    );
    return true;
  } catch (err) {
    if (err.code === FAILED_PRECONDITION) return false;
    throw err;
  }
}

// Responds for a document that is no longer pending_upload. Never changes it.
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

async function deleteObject(file, generation) {
  try {
    // Only delete the exact object that failed the checks.
    await file.delete({ ifGenerationMatch: generation });
  } catch (err) {
    // Already gone, or replaced by a newer upload: nothing left to remove.
    if (err.code === 404 || err.code === 412) return;
    throw err;
  }
}

router.post('/:id/complete', requireUser, async (req, res) => {
  const snapshot = await findDocument(req.params.id);
  if (!snapshot) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const { ownerId, status, gcsUri } = snapshot.data();
  if (ownerId !== req.userId) {
    return res.status(403).json({ error: 'Document belongs to another user' });
  }
  if (status !== DOCUMENT_STATUS.PENDING_UPLOAD) {
    return respondWithSettledStatus(res, snapshot);
  }

  const file = fileFromGcsUri(gcsUri);
  const result = await verifyUploadedPdf(file);

  if (result.status === 'missing') {
    return res.status(409).json({ error: 'File has not been uploaded yet' });
  }

  const fields =
    result.status === 'valid'
      ? { status: DOCUMENT_STATUS.UPLOADED, size: result.size }
      : { status: DOCUMENT_STATUS.FAILED, error: result.reason };

  if (!(await updateIfUnchanged(snapshot, fields))) {
    // A concurrent request settled the document first; report its outcome.
    return respondWithSettledStatus(res, await snapshot.ref.get());
  }

  if (result.status === 'invalid') {
    await deleteObject(file, result.generation);
    return res.status(422).json({ error: result.reason });
  }

  res.status(200).json(serializeDocument(await snapshot.ref.get()));
});

module.exports = router;
