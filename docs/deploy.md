# Deploy

The service runs on Cloud Run as `chat-with-pdf` in `us-central1`, the same region as Firestore and
Vertex AI. Cloud Build builds the image from the `Dockerfile`, so Docker is not needed locally.

## One-time setup

Enable the APIs:

```sh
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  --project <project-id>
```

Create the service account the service runs as, and give it the roles from
[Prerequisites](prerequisites.md):

```sh
gcloud iam service-accounts create chat-with-pdf-run --project <project-id>

SA=serviceAccount:chat-with-pdf-run@<project-id>.iam.gserviceaccount.com
gcloud storage buckets add-iam-policy-binding gs://<bucket-name> --member $SA --role roles/storage.objectAdmin
gcloud projects add-iam-policy-binding <project-id> --member $SA --role roles/datastore.user
gcloud projects add-iam-policy-binding <project-id> --member $SA --role roles/aiplatform.user
```

Let Cloud Build build the image. `gcloud run deploy --source` builds as the default compute service
account, `<project-number>-compute@developer.gserviceaccount.com`, which needs the Cloud Run Builder
role:

```sh
PROJECT_NUMBER=$(gcloud projects describe <project-id> --format 'value(projectNumber)')
gcloud projects add-iam-policy-binding <project-id> \
  --member serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com \
  --role roles/run.builder
```

## Deploy a new version

The service's environment variables come from `env.cloudrun.yaml` (the same variables as `.env`,
minus `PORT`, which Cloud Run sets). It is not committed. The first time, copy the template and fill
in the values:

```sh
cp env.cloudrun.example.yaml env.cloudrun.yaml
```

Then, from the repo root, with your Google account logged in (`gcloud auth login`):

```sh
gcloud run deploy chat-with-pdf \
  --source . \
  --project <project-id> \
  --region us-central1 \
  --service-account chat-with-pdf-run@<project-id>.iam.gserviceaccount.com \
  --env-vars-file env.cloudrun.yaml \
  --no-allow-unauthenticated
```

To change config, edit `env.cloudrun.yaml` and redeploy. `.gcloudignore` keeps `.env`,
`env.cloudrun.yaml`, keys and sample PDFs out of the upload.

The service uses Cloud Run's defaults: 300s request timeout, 512 MiB memory, 1 vCPU, 80 concurrent
requests per instance, and 0 to 100 instances. `/extract` runs in the request, so a very large PDF
may need a longer timeout.

## Call the deployed service

The service is private: Cloud Run rejects any request without a Google identity token (`403`)
before it reaches the app. A project owner can invoke it; anyone else needs `roles/run.invoker`.
Send the token in the `Authorization` header, alongside `X-User-Id`:

```sh
URL=$(gcloud run services describe chat-with-pdf --region us-central1 --format 'value(status.url)')
TOKEN=$(gcloud auth print-identity-token)

curl -H "Authorization: Bearer $TOKEN" $URL/health   # {"status":"ok"}
```

The deployed service reads users from the same Firestore database, so the seed user must exist
before any call that sends `X-User-Id`, or every call returns `403`. If you haven't created it yet,
follow [Seed user](run-locally.md#seed-user).

With `URL` and `TOKEN` set like this, run the [walkthrough](testing.md)
from `FILE=` on. The token expires after an hour; set `TOKEN` again if calls start returning `401`.
