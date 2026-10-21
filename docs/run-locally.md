# Run locally

Run these steps in order, from the repo root, after the [prerequisites](prerequisites.md).

## Install

```sh
nvm use        # picks v26.2.0 from .nvmrc
npm install
```

## Credentials

The service needs no key file. The Google client libraries find credentials on their own through
[Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials)
(ADC). Locally, log in once with your Google account:

```sh
gcloud auth application-default login
```

On Cloud Run, ADC uses the service account attached to the service.

If `GOOGLE_APPLICATION_CREDENTIALS` is set, in your shell or in `.env`, the libraries read credentials
from that file instead. Leave it unset unless you mean to use a key file.

## Environment variables

Copy `.env.example` to `.env` and fill in every value:

| Variable | Description |
| --- | --- |
| `GCP_PROJECT_ID` | GCP project id |
| `GCS_BUCKET_NAME` | Cloud Storage bucket name |
| `FIRESTORE_DATABASE_ID` | Firestore database id (`(default)` for the default database) |
| `VERTEX_LOCATION` | Vertex AI region for the embedding model, e.g. `us-central1` |
| `EMBEDDING_MODEL` | Embedding model, `gemini-embedding-001` |
| `EMBEDDING_DIMENSIONS` | Embedding size, `768`. At most 2048 (Firestore's vector limit) |
| `CHAT_MODEL` | Chat model that answers questions, `gemini-3.8-flash` |
| `CHAT_LOCATION` | Vertex AI location for the chat model, `global`. `gemini-3.8-flash` is served on the global and multi-region endpoints, not in single regions like `us-central1` |
| `PORT` | Optional, defaults to `3000` |

The service refuses to start if any required variable is missing, and names the missing ones.

## Seed user

Until auth exists, every document belongs to a single seed user. Its `id`, `name` and `email` live in
`scripts/seed-user/seed-user.json`. That file is for seeding only — application code reads users from
Firestore, never from this file.

With `.env` in place and logged in (see [Credentials](#credentials)), create the seed user:

```sh
npm run seed:user
```

This creates `users/{id}` using the `id` from the config file as the document id. It is safe to re-run:
if the user already exists it is left unchanged.

## Run

```sh
npm start      # run the server
npm run dev    # run with auto-restart on file changes
```

Check it is up:

```sh
curl http://localhost:3000/health   # {"status":"ok"}
```

## Walkthrough: upload a PDF end to end

With the server running and the seed user created. `URL` and `TOKEN` point the calls at the local
server; set them as in [Call the deployed service](deploy.md#call-the-deployed-service) to run the same steps
against Cloud Run.

```sh
URL=http://localhost:3000
TOKEN=                              # not needed locally
FILE=~/Downloads/report.pdf         # path to your PDF
SIZE=$(wc -c < "$FILE" | tr -d ' ')

# 1. Ask for an upload URL
RESPONSE=$(curl -s -X POST "$URL/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: seed-user' \
  -d "{\"filename\": \"$(basename "$FILE")\", \"contentType\": \"application/pdf\", \"size\": $SIZE}")
echo "$RESPONSE" | jq .
DOCUMENT_ID=$(echo "$RESPONSE" | jq -r .documentId)
UPLOAD_URL=$(echo "$RESPONSE" | jq -r .uploadUrl)

# 2. Upload the file straight to Cloud Storage (no Authorization header); prints 200
curl -s -o /dev/null -w "%{http_code}\n" -X PUT "$UPLOAD_URL" \
  -H 'Content-Type: application/pdf' \
  --upload-file "$FILE"

# 3. Confirm the upload; status becomes "uploaded"
curl -s -X POST "$URL/documents/$DOCUMENT_ID/complete" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'X-User-Id: seed-user' | jq .

# 4. Extract, chunk and embed the text; status becomes "ready"
curl -s -X POST "$URL/documents/$DOCUMENT_ID/extract" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'X-User-Id: seed-user' | jq .

# 5. Ask a question; returns an answer with page citations and its sources
curl -s -X POST "$URL/documents/$DOCUMENT_ID/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: seed-user' \
  -d '{"message": "What does the report recommend?"}' | jq .
```
