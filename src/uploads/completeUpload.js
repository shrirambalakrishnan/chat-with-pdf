const { FieldValue } = require('@google-cloud/firestore');
const { fileFromGcsUri } = require('../lib/storage');
const { DOCUMENT_STATUS } = require('../constants');
const verifyUploadedPdf = require('./verifyUpload');

// Firestore gRPC status code for a failed update precondition.
const FAILED_PRECONDITION = 9;

const OUTCOME = Object.freeze({
  // The file was valid; the document is now uploaded.
  UPLOADED: 'uploaded',
  // The file was invalid; the document is now failed and the object is deleted.
  FAILED: 'failed',
  // No object in the bucket yet; the document is unchanged.
  NOT_UPLOADED: 'not_uploaded',
  // The document had already left pending_upload; it is unchanged.
  ALREADY_SETTLED: 'already_settled',
});

// Updates the document only if nobody else changed it since it was read.
// Resolves to false if a concurrent caller got there first.
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

/**
 * Verifies the uploaded file for a document and moves it out of pending_upload.
 *
 * Shared by every way of learning an upload finished (the client's
 * POST /documents/:id/complete today, a Cloud Storage event later). It knows
 * nothing about callers, so authorization is the entry point's job.
 *
 * Safe to call more than once or concurrently: only a pending_upload document
 * is changed, and only by the first caller to settle it.
 *
 * Resolves to { outcome, snapshot, reason }, where snapshot is the document's
 * current state and reason is set when the outcome is FAILED.
 */
async function completeUpload(snapshot) {
  if (snapshot.data().status !== DOCUMENT_STATUS.PENDING_UPLOAD) {
    return { outcome: OUTCOME.ALREADY_SETTLED, snapshot };
  }

  const file = fileFromGcsUri(snapshot.data().gcsUri);
  const result = await verifyUploadedPdf(file);

  if (result.status === 'missing') {
    return { outcome: OUTCOME.NOT_UPLOADED, snapshot };
  }

  const fields =
    result.status === 'valid'
      ? { status: DOCUMENT_STATUS.UPLOADED, size: result.size }
      : { status: DOCUMENT_STATUS.FAILED, error: result.reason };

  if (!(await updateIfUnchanged(snapshot, fields))) {
    // A concurrent caller settled the document first.
    return { outcome: OUTCOME.ALREADY_SETTLED, snapshot: await snapshot.ref.get() };
  }

  if (result.status === 'invalid') {
    await deleteObject(file, result.generation);
    return { outcome: OUTCOME.FAILED, snapshot: await snapshot.ref.get(), reason: result.reason };
  }

  return { outcome: OUTCOME.UPLOADED, snapshot: await snapshot.ref.get() };
}

module.exports = { completeUpload, OUTCOME };
