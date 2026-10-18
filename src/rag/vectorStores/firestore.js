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
 * Every vector store implements the same contract, so ingestion and
 * retrieval do not know which one they use:
 *
 * - upsert(records): stores each record by its `id`, replacing any record
 *   with that id. A record is
 *   { id, ownerId, documentId, index, text, pageStart, pageEnd, embedding }.
 * - query(vector, { ownerId, documentId }, topK): resolves to the `topK`
 *   records of that owner's document nearest to `vector`, nearest first, as
 *   { id, text, pageStart, pageEnd, distance }. Records of other documents
 *   or owners are never returned.
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

  // Needs the composite vector index on (ownerId, documentId, embedding)
  // described in the README; without it Firestore rejects the query.
  async function query(vector, { ownerId, documentId }, topK) {
    const snapshot = await chunks
      .where('ownerId', '==', ownerId)
      .where('documentId', '==', documentId)
      .findNearest({
        vectorField: 'embedding',
        queryVector: vector,
        limit: topK,
        // Cosine, because the embeddings are not normalized (#19).
        distanceMeasure: 'COSINE',
        // Kept on each result for tuning; lower is nearer.
        distanceResultField: 'distance',
      })
      .get();

    return snapshot.docs.map((doc) => {
      const { text, pageStart, pageEnd, distance } = doc.data();
      return { id: doc.id, text, pageStart, pageEnd, distance };
    });
  }

  return { upsert, query };
}

module.exports = { createFirestoreVectorStore };
