const { Firestore } = require('@google-cloud/firestore');
const config = require('../config');

const firestore = new Firestore({
  projectId: config.gcp.projectId,
  databaseId: config.gcp.firestoreDatabaseId,
  keyFilename: config.gcp.credentialsPath,
});

module.exports = firestore;
