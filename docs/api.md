# API

Until auth exists, the caller is identified by the `X-User-Id` header, which must match a document in
the `users` collection (e.g. the seed user).

## `POST /documents`

Asks for permission to upload one PDF. Creates a `documents` record with status `pending_upload` and
returns a resumable upload URL; the client then uploads the file directly to Cloud Storage.

Request body:

| Field | Type | Rules |
| --- | --- | --- |
| `filename` | string | required |
| `contentType` | string | must be `application/pdf` |
| `size` | number | bytes, 1 to 20 MB (20971520). The upload must be exactly this size |

```sh
curl -X POST http://localhost:3000/documents \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: seed-user' \
  -d '{"filename": "report.pdf", "contentType": "application/pdf", "size": 123456}'
```

Response `201`:

```json
{
  "documentId": "AbC123...",
  "uploadUrl": "https://storage.googleapis.com/upload/storage/v1/b/<bucket>/o?name=documents%2FAbC123....pdf&uploadType=resumable&upload_id=...",
  "uploadHeaders": {
    "Content-Type": "application/pdf"
  }
}
```

Errors:

| Status | When |
| --- | --- |
| `400` | missing or invalid body field, `contentType` is not `application/pdf`, or `size` is zero or over 20 MB |
| `401` | `X-User-Id` header missing |
| `403` | `X-User-Id` does not match a user |

### Uploading to the upload URL

`uploadUrl` is a Cloud Storage
[resumable upload session](https://cloud.google.com/storage/docs/resumable-uploads). `PUT` the whole
file to it in one request, with the headers in `uploadHeaders`. No auth header is needed: the URL
itself grants the upload, so keep it private.

- The file must be exactly the `size` declared in `POST /documents`. Cloud Storage rejects any other
  size with `400`.
- The object is stored as `application/pdf` whatever `Content-Type` the client sends.
- The session lasts up to a week. Cloud Storage does not report its expiry.

```sh
curl -X PUT "<uploadUrl>" \
  -H 'Content-Type: application/pdf' \
  --upload-file report.pdf
```

After the `PUT` succeeds, call `POST /documents/:id/complete`.

## `POST /documents/:id/complete`

Tells the service the upload has finished. The service verifies the stored file and updates the
document's status. No request body.

The stored file must:

- exist at the document's `gcsUri`
- be larger than zero and at most 20 MB
- have content type `application/pdf`
- start with the PDF signature `%PDF-`

| Case | Status | Effect on the record |
| --- | --- | --- |
| File is present and valid | `200`, returns the document | status → `uploaded`, `size` → actual object size |
| File is present but invalid | `422`, returns the reason | status → `failed`, `error` set, object deleted from the bucket |
| File is not in the bucket yet | `409` | unchanged (`pending_upload`): upload, then retry |
| Document is already `uploaded` or later | `200`, returns the document | unchanged |
| Document is already `failed` | `409` | unchanged: start again with `POST /documents` |
| `X-User-Id` header missing | `401` | unchanged |
| `X-User-Id` is not a user, or not the document's owner | `403` | unchanged |
| No document with that id | `404` | none |

```sh
curl -X POST http://localhost:3000/documents/<documentId>/complete \
  -H 'X-User-Id: seed-user'
```

Once a document is `uploaded`, call `POST /documents/:id/extract` to make it searchable.

Upload completion lives in `src/uploads/`, separate from the rest of the API:

| File | Role |
| --- | --- |
| `completeUpload.js` | Core: verifies the stored file and settles a `pending_upload` document. Safe to call repeatedly or concurrently. No HTTP or auth. |
| `verifyUpload.js` | The checks on the stored file, used by the core |
| `completeRoute.js` | This endpoint: checks the user and ownership, calls the core, maps the outcome to a status code. Mounted with one line in `src/app.js`. |

Another way of detecting completion (e.g. Cloud Storage events via Pub/Sub, #9) should call
`completeUpload` from its own entry point. Removing this endpoint means deleting `completeRoute.js`
and its mount line.

## `POST /documents/:id/extract`

Runs [RAG ingestion](rag.md#ingestion) on an `uploaded` document: downloads the PDF, then chunks,
embeds and stores its text in `chunks`. Synchronous: the request returns when ingestion has
finished. No request body.

Status flow: `uploaded` → `processing` → `ready`, or `failed` with `error` set.

| Case | Status | Effect on the record |
| --- | --- | --- |
| Ingestion succeeds | `200`, returns the document | status → `processing` → `ready` |
| Ingestion fails (incl. the PDF download) | `500`, returns the reason | status → `processing` → `failed`, `error` set |
| Document is not `uploaded` (incl. a call already `processing` it) | `409` | unchanged |
| `X-User-Id` header missing | `401` | unchanged |
| `X-User-Id` is not a user, or not the document's owner | `403` | unchanged |
| No document with that id | `404` | none |

```sh
curl -X POST http://localhost:3000/documents/<documentId>/extract \
  -H 'X-User-Id: seed-user'
```

Extraction lives in `src/extraction/`, with the same split as `src/uploads/`:

| File | Role |
| --- | --- |
| `extractDocument.js` | Core: moves an `uploaded` document to `processing`, downloads the PDF, calls `ingestPdf`, sets `ready` or `failed`. No HTTP or auth. |
| `extractRoute.js` | This endpoint: checks the user and ownership, calls the core, maps the result to a status code. Mounted with one line in `src/app.js`. |

Starting extraction automatically after upload should call `extractDocument` from its own entry
point.

Known limits:

- A document left in `processing` (e.g. the server restarts mid-run) can't be extracted again.
- Chunks written before a failure are left behind.
- A `failed` document can't be retried; upload it again.
- The call is synchronous. A large PDF takes hundreds of embedding requests in a row, so a client or
  proxy may time out first. The server keeps going and the record still ends `ready` or `failed`.

Once a document is `ready`, ask questions about it with `POST /documents/:id/chat`.

## `POST /documents/:id/chat`

Answers one question about a `ready` document with [RAG generation](rag.md#generation): retrieves the
nearest chunks of the document and answers from them, citing pages. Synchronous, plain JSON, no
streaming.

Each question is answered on its own: there is no message history, and nothing is written to
Firestore.

Request body:

| Field | Type | Rules |
| --- | --- | --- |
| `message` | string | required, 1 to 2,000 characters after trimming. Sent to the model trimmed |

```sh
curl -X POST http://localhost:3000/documents/<documentId>/chat \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: seed-user' \
  -d '{"message": "What does the report recommend?"}'
```

Response `200`:

```json
{
  "answer": "The report recommends ... [p. 4]",
  "sources": [{ "chunkId": "AbC123_7", "pageStart": 4, "pageEnd": 4, "text": "..." }]
}
```

`answer` is plain text in short paragraphs, with inline page citations like `[p. 4]`. `sources` are
the retrieved chunks, most relevant first, and may include chunks the answer doesn't cite.

| Case | Status |
| --- | --- |
| Answer generated | `200`, returns `answer` and `sources` |
| `message` missing, empty, not a string, or over 2,000 characters | `400` |
| `X-User-Id` header missing | `401` |
| `X-User-Id` is not a user, or not the document's owner | `403` |
| No document with that id | `404` |
| Document is not `ready` | `409` |
| The embedding model, the vector store or the chat model fails, or the answer is empty or blocked | `502`, returns the reason |

Checks run in that order, except that the `401` and unknown-user `403` come before the body is
validated.

Chat lives in `src/chat/`, with the same split as `src/uploads/` and `src/extraction/`:

| File | Role |
| --- | --- |
| `chatWithDocument.js` | Core: checks the document is `ready`, calls `askPdf` with the RAG dependencies from `src/lib/rag.js`. No HTTP or auth. |
| `chatRoute.js` | This endpoint: validates the body, checks the user and ownership, calls the core, maps the result to a status code. Mounted with one line in `src/app.js`. |
