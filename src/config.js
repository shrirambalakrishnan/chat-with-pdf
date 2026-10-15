require('dotenv').config({ quiet: true });

const REQUIRED_VARS = [
  'GCP_PROJECT_ID',
  'GCS_BUCKET_NAME',
  'FIRESTORE_DATABASE_ID',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'VERTEX_LOCATION',
  'EMBEDDING_MODEL',
  'EMBEDDING_DIMENSIONS',
];

// Firestore vector fields hold at most 2048 dimensions.
const MAX_EMBEDDING_DIMENSIONS = 2048;

const missing = REQUIRED_VARS.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Copy .env.example to .env and fill in every value.'
  );
}

const embeddingDimensions = Number(process.env.EMBEDDING_DIMENSIONS);
if (
  !Number.isInteger(embeddingDimensions) ||
  embeddingDimensions < 1 ||
  embeddingDimensions > MAX_EMBEDDING_DIMENSIONS
) {
  throw new Error(
    `EMBEDDING_DIMENSIONS must be a whole number from 1 to ${MAX_EMBEDDING_DIMENSIONS}, ` +
      `got "${process.env.EMBEDDING_DIMENSIONS}"`
  );
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  gcp: {
    projectId: process.env.GCP_PROJECT_ID,
    bucketName: process.env.GCS_BUCKET_NAME,
    firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID,
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    vertexLocation: process.env.VERTEX_LOCATION,
  },
  embedding: {
    model: process.env.EMBEDDING_MODEL,
    dimensions: embeddingDimensions,
  },
};
