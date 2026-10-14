require('dotenv').config({ quiet: true });

const REQUIRED_VARS = [
  'GCP_PROJECT_ID',
  'GCS_BUCKET_NAME',
  'FIRESTORE_DATABASE_ID',
  'GOOGLE_APPLICATION_CREDENTIALS',
];

const missing = REQUIRED_VARS.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Copy .env.example to .env and fill in every value.'
  );
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  gcp: {
    projectId: process.env.GCP_PROJECT_ID,
    bucketName: process.env.GCS_BUCKET_NAME,
    firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID,
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  },
};
