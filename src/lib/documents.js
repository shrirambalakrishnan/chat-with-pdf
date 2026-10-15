const firestore = require('./firestore');

// Firestore gRPC status code for a malformed document id (e.g. "..").
const INVALID_ARGUMENT = 3;

// Loads a document snapshot, or null if no document has that id.
async function findDocument(documentId) {
  try {
    const snapshot = await firestore.collection('documents').doc(documentId).get();
    return snapshot.exists ? snapshot : null;
  } catch (err) {
    // Ids Firestore cannot address can never match a document.
    if (err.code === INVALID_ARGUMENT) return null;
    throw err;
  }
}

// Shapes a document snapshot for an API response.
function serializeDocument(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    createdAt: data.createdAt?.toDate().toISOString() ?? null,
    updatedAt: data.updatedAt?.toDate().toISOString() ?? null,
  };
}

module.exports = { findDocument, serializeDocument };
