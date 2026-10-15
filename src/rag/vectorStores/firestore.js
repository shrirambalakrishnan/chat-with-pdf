const { FieldValue } = require('@google-cloud/firestore');

// Firestore allows at most 500 writes in one batch.
const MAX_BATCH_WRITES = 500;

/**
 * Vector store on Firestore native vector search.
 *
 * Every vector store implements the same contract, so ingestion does not
 * know which one it writes to:
 *
 * - upsert(records): stores each record by its `id`, replacing any record
 *   with that id. A record is
 *   { id, ownerId, documentId, index, text, pageStart, pageEnd, embedding }.
 * - deleteByDocument(documentId): removes every record of a document.
 * - query(vector, { ownerId, documentId }, topK): nearest records. Part of
 *   retrieval, implemented with chat (#3).
 *
 * Here each record is one document in the `chunks` collection, with the
 * embedding stored as a Firestore vector field next to the text.
 */
function createFirestoreVectorStore({ firestore, collection = 'chunks' }) {
  const chunks = firestore.collection(collection);

  async function upsert(records) {
    for (let i = 0; i < records.length; i += MAX_BATCH_WRITES) {
      const batch = firestore.batch();
      for (const { id, embedding, ...fields } of records.slice(i, i + MAX_BATCH_WRITES)) {
        batch.set(chunks.doc(id), {
          ...fields,
          embedding: FieldValue.vector(embedding),
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
  }

  async function deleteByDocument(documentId) {
    const query = chunks.where('documentId', '==', documentId).select().limit(MAX_BATCH_WRITES);
    for (;;) {
      const snapshot = await query.get();
      if (snapshot.empty) return;
      const batch = firestore.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  }

  async function query() {
    throw new Error('Vector store query is not implemented yet (retrieval, #3)');
  }

  return { upsert, deleteByDocument, query };
}

module.exports = { createFirestoreVectorStore };
