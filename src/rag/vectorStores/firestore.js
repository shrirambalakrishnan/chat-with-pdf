const { FieldValue } = require('@google-cloud/firestore');

// Firestore allows at most 500 writes in one batch, and at most 10 MiB per
// request. 500 chunks at 768 dimensions stay well under the size limit.
const MAX_BATCH_WRITES = 500;

// The Firestore document for one record: its fields, with the embedding as a
// vector field. The id is the document id, so it is not stored as a field.
function toChunkDoc({ id, embedding, ...fields }) {
  return {
    ...fields,
    embedding: FieldValue.vector(embedding),
    createdAt: FieldValue.serverTimestamp(),
  };
}

/**
 * Vector store on Firestore native vector search.
 *
 * Every vector store implements the same contract, so ingestion does not
 * know which one it writes to:
 *
 * - upsert(records): stores each record by its `id`, replacing any record
 *   with that id. A record is
 *   { id, ownerId, documentId, index, text, pageStart, pageEnd, embedding }.
 *
 * Here each record is one document in the `chunks` collection, with the
 * embedding stored as a Firestore vector field next to the text.
 */
function createFirestoreVectorStore({ firestore, collection = 'chunks' }) {
  const chunks = firestore.collection(collection);

  async function upsert(records) {
    for (let i = 0; i < records.length; i += MAX_BATCH_WRITES) {
      const batch = firestore.batch();
      for (const record of records.slice(i, i + MAX_BATCH_WRITES)) {
        batch.set(chunks.doc(record.id), toChunkDoc(record));
      }
      await batch.commit();
    }
  }

  return { upsert };
}

module.exports = { createFirestoreVectorStore };
