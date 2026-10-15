const { Storage } = require('@google-cloud/storage');
const config = require('../config');

const storage = new Storage({
  projectId: config.gcp.projectId,
  keyFilename: config.gcp.credentialsPath,
});

const bucket = storage.bucket(config.gcp.bucketName);

// Resolves a gs://{bucket}/{path} URI to a Cloud Storage File.
function fileFromGcsUri(gcsUri) {
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(gcsUri);
  if (!match) {
    throw new Error(`Invalid Cloud Storage URI: ${gcsUri}`);
  }
  const [, bucketName, objectPath] = match;
  return storage.bucket(bucketName).file(objectPath);
}

module.exports = { storage, bucket, fileFromGcsUri };
