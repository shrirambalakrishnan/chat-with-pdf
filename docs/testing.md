# Walkthrough: upload a PDF end to end

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
