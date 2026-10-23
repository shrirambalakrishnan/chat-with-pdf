const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const config = require('../config');

const execFileAsync = promisify(execFile);

// Mints ID tokens for the service account a Cloud Run service runs as.
const METADATA_IDENTITY_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';

// gcloud mints a new identity token on every call, valid for 60 minutes.
// Reusing one for 55 leaves a margin for slow requests.
const GCLOUD_TOKEN_TTL_MS = 55 * 60 * 1000;

let gcloudToken = null; // { value, expiresAt }

// Cloud Run sets K_SERVICE on every service; it is never set locally.
function isRunningLocally() {
  return !process.env.K_SERVICE;
}

async function tokenFromMetadataServer(audience) {
  const url = `${METADATA_IDENTITY_URL}?audience=${encodeURIComponent(audience)}`;
  const res = await fetch(url, { headers: { 'Metadata-Flavor': 'Google' } });
  if (!res.ok) {
    throw new Error(`Metadata server returned ${res.status} for an identity token`);
  }
  return res.text();
}

async function tokenFromGcloud() {
  if (gcloudToken && Date.now() < gcloudToken.expiresAt) {
    return gcloudToken.value;
  }
  const { stdout } = await execFileAsync('gcloud', ['auth', 'print-identity-token']);
  gcloudToken = { value: stdout.trim(), expiresAt: Date.now() + GCLOUD_TOKEN_TTL_MS };
  return gcloudToken.value;
}

/**
 * ID token for calling the private docling service, which only accepts
 * callers with roles/run.invoker.
 *
 * Locally it is the gcloud user's token, the same one used to curl the
 * service. The Node auth library cannot mint an ID token from a user login,
 * so this runs `gcloud auth print-identity-token` and reuses the token for
 * 55 minutes.
 *
 * On Cloud Run the token is for the app's service account, from the
 * metadata server, with the docling URL as its audience. It is fetched on
 * every call: the metadata server is local and fast.
 */
async function getDoclingToken() {
  if (isRunningLocally()) {
    return tokenFromGcloud();
  }
  return tokenFromMetadataServer(config.docling.url);
}

module.exports = getDoclingToken;
