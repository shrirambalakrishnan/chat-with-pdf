# Deploy docling

[docling-serve](https://github.com/docling-project/docling-serve) reads pages with complex layouts
and scanned pages. It runs as a separate private Cloud Run service, `docling`, in `us-central1`, and
the app calls it over HTTP. Local runs call the same deployed service, so you don't need Docker or
Python locally.

`docling/Dockerfile` pins docling-serve's CPU image, which already includes RapidOCR. Cloud Run can't
pull from `ghcr.io`, so Cloud Build copies the image into Artifact Registry.

## One-time setup

Run the app's [one-time setup](deploy.md#one-time-setup) first. This deploy needs the same APIs and
the same Cloud Run Builder role.

Create a service account for docling with no roles. Docling calls no Google APIs and reads PDFs that
users upload, so it gets no access:

```sh
gcloud iam service-accounts create docling-run --project <project-id>
```

## Deploy a new version

From the repo root:

```sh
gcloud run deploy docling \
  --source docling \
  --project <project-id> \
  --region us-central1 \
  --service-account docling-run@<project-id>.iam.gserviceaccount.com \
  --port 5001 \
  --cpu 2 \
  --memory 8Gi \
  --timeout 600 \
  --set-env-vars DOCLING_SERVE_MAX_SYNC_WAIT=600 \
  --execution-environment gen2 \
  --no-allow-unauthenticated
```

- `--port 5001`: docling-serve listens on `5001` and ignores Cloud Run's `PORT`.
- 2 vCPU and 8 GiB: docling runs its layout, table and OCR models on the CPU. It uses two worker
  threads, and each one loads its own copy of the models.
- `--timeout 600` and `DOCLING_SERVE_MAX_SYNC_WAIT=600`: a request can take up to 10 minutes.
  Without the variable, docling-serve stops waiting at 120s, even if Cloud Run's timeout is longer.
- `gen2`: full Linux compatibility, for the ML libraries.
- Min instances stays at the default of 0. After the service has been idle, the first call waits
  for a new instance to start and load the models.

The first deploy takes several minutes because Cloud Build copies a 2 GB image. To upgrade docling,
change the tag in `docling/Dockerfile` and redeploy.

## Let the app call it

The app's service account needs `roles/run.invoker` on the service:

```sh
gcloud run services add-iam-policy-binding docling \
  --project <project-id> \
  --region us-central1 \
  --member serviceAccount:chat-with-pdf-run@<project-id>.iam.gserviceaccount.com \
  --role roles/run.invoker
```

When the app runs locally, it calls docling as your Google account. A project owner can already
invoke the service. Anyone else needs the same role with `--member user:<your-email>`.

## Check it

You need two single-page PDFs: one with a text layer, and one scanned page with no text layer:

```sh
DOCLING_URL=$(gcloud run services describe docling --region us-central1 --format 'value(status.url)')
TOKEN=$(gcloud auth print-identity-token)

# No token: Cloud Run rejects the call
curl -s -o /dev/null -w '%{http_code}\n' $DOCLING_URL/health   # 403

# OCR off
curl -s -H "Authorization: Bearer $TOKEN" $DOCLING_URL/v1/convert/file \
  -F files=@<text-page.pdf> -F to_formats=md -F do_ocr=false \
  | jq -r .document.md_content

# RapidOCR
curl -s -H "Authorization: Bearer $TOKEN" $DOCLING_URL/v1/convert/file \
  -F files=@<scanned-page.pdf> -F to_formats=md -F do_ocr=true -F ocr_preset=rapidocr \
  | jq -r .document.md_content
```

Both calls print the page as markdown. The first call after a deploy, or after the service has been
idle, is slow because a new instance has to start.
