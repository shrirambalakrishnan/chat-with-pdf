const { Storage } = require('@google-cloud/storage');
const config = require('../config');

const storage = new Storage({
  projectId: config.gcp.projectId,
  keyFilename: config.gcp.credentialsPath,
});

const bucket = storage.bucket(config.gcp.bucketName);

module.exports = { storage, bucket };
