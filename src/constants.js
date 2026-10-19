const PDF_CONTENT_TYPE = 'application/pdf';

// Largest PDF a client may upload.
const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;

// Longest chat message a client may send, in characters, after trimming.
const MAX_MESSAGE_LENGTH = 2000;

const DOCUMENT_STATUS = Object.freeze({
  PENDING_UPLOAD: 'pending_upload',
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
});

module.exports = {
  PDF_CONTENT_TYPE,
  MAX_UPLOAD_SIZE_BYTES,
  MAX_MESSAGE_LENGTH,
  DOCUMENT_STATUS,
};
