const { FieldValue } = require('@google-cloud/firestore');
const { fileFromGcsUri } = require('../lib/storage');
const { embedder, vectorStore } = require('../lib/rag');
const { ingestPdf } = require('../rag');
const { DOCUMENT_STATUS } = require('../constants');

async function setStatus(snapshot, fields) {
  await snapshot.ref.update({ ...fields, updatedAt: FieldValue.serverTimestamp() });
}

/**
 * Runs RAG ingestion on an uploaded document and records the result in its
 * status: uploaded → processing → ready, or failed with an error.
 *
 * Shared by every way of starting extraction (the client's
 * POST /documents/:id/extract today, an automatic trigger after upload
 * later). It knows nothing about callers, so authorization is the entry
 * point's job.
 *
 * A second call while the first is running sees processing and is turned
 * away. Two calls that read uploaded at the same moment both run, which only
 * costs a second round of embedding requests: chunk ids are deterministic.
 *
 * Resolves to null if the document is not uploaded (it is unchanged), or to
 * the document's new snapshot, which is ready or failed.
 */
async function extractDocument(snapshot) {
  const { status, gcsUri, ownerId } = snapshot.data();
  if (status !== DOCUMENT_STATUS.UPLOADED) return null;

  await setStatus(snapshot, { status: DOCUMENT_STATUS.PROCESSING });

  try {
    const [pdfBuffer] = await fileFromGcsUri(gcsUri).download();
    await ingestPdf(pdfBuffer, { ownerId, documentId: snapshot.id }, { embedder, vectorStore });
    await setStatus(snapshot, { status: DOCUMENT_STATUS.READY });
  } catch (err) {
    console.error(`Extraction failed for document ${snapshot.id}:`, err);
    await setStatus(snapshot, { status: DOCUMENT_STATUS.FAILED, error: err.message });
  }

  return snapshot.ref.get();
}

module.exports = extractDocument;
