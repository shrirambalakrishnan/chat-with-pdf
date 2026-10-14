const fs = require('node:fs');
const path = require('node:path');

const CONFIG_PATH = path.join(__dirname, 'seed-user.json');
const REQUIRED_FIELDS = ['id', 'name', 'email'];

// Firestore gRPC status code for a create() on a document that already exists.
const ALREADY_EXISTS = 6;

function loadSeedUser() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Seed user config file not found: ${CONFIG_PATH}`);
  }

  let seedUser;
  try {
    seedUser = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (err) {
    throw new Error(`Seed user config file is not valid JSON: ${CONFIG_PATH} (${err.message})`);
  }

  const missing = REQUIRED_FIELDS.filter(
    (field) => typeof seedUser[field] !== 'string' || !seedUser[field].trim()
  );
  if (missing.length > 0) {
    throw new Error(
      `Seed user config file is missing required field(s): ${missing.join(', ')} (${CONFIG_PATH})`
    );
  }

  return seedUser;
}

async function seedUser() {
  const { id, name, email } = loadSeedUser();

  // Required after validating the seed file so a bad seed file is reported
  // even when the GCP env variables are not set yet.
  const { FieldValue } = require('@google-cloud/firestore');
  const firestore = require('../../src/lib/firestore');

  try {
    // create() fails if the document exists, so re-runs never overwrite or duplicate.
    await firestore.collection('users').doc(id).create({
      name,
      email,
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log(`Created seed user users/${id}`);
  } catch (err) {
    if (err.code === ALREADY_EXISTS) {
      console.log(`Seed user users/${id} already exists, left unchanged`);
      return;
    }
    throw err;
  }
}

seedUser().catch((err) => {
  console.error(`Seeding user failed: ${err.message}`);
  process.exitCode = 1;
});
