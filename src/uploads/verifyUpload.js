const { PDF_CONTENT_TYPE, MAX_UPLOAD_SIZE_BYTES } = require('../constants');

const PDF_SIGNATURE = Buffer.from('%PDF-');

/**
 * Checks an uploaded object is a plausible PDF without reading the whole file.
 *
 * Resolves to one of:
 *   { status: 'missing' }                          object is not in the bucket
 *   { status: 'invalid', reason, generation }      object exists but fails a check
 *   { status: 'valid', size, generation }          object passes every check
 */
async function verifyUploadedPdf(file) {
  let metadata;
  try {
    [metadata] = await file.getMetadata();
  } catch (err) {
    if (err.code === 404) return { status: 'missing' };
    throw err;
  }

  const size = Number(metadata.size);
  const { contentType, generation } = metadata;
  const invalid = (reason) => ({ status: 'invalid', reason, generation });

  if (!(size > 0)) {
    return invalid('Uploaded file is empty');
  }
  if (size > MAX_UPLOAD_SIZE_BYTES) {
    return invalid(`Uploaded file is larger than ${MAX_UPLOAD_SIZE_BYTES} bytes`);
  }
  if (contentType !== PDF_CONTENT_TYPE) {
    return invalid(`Uploaded file content type is ${contentType || 'not set'}, expected ${PDF_CONTENT_TYPE}`);
  }

  const [head] = await file.download({ start: 0, end: PDF_SIGNATURE.length - 1 });
  if (!head.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
    return invalid('Uploaded file is not a PDF (missing %PDF- signature)');
  }

  return { status: 'valid', size, generation };
}

module.exports = verifyUploadedPdf;
