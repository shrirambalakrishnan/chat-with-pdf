# Prerequisites

## Tools

- Node **v26.2.0** and npm **11.13.0** (enforced — `npm install` fails on other versions)
- The [`gcloud` CLI](https://cloud.google.com/sdk/docs/install)
- [`jq`](https://jqlang.org/), for the walkthrough
- A GCP project with billing enabled

## GCP setup

One time, per project. The bucket, Firestore and Cloud Run all go in `us-central1`.

1. Log in and select the project, so later commands default to it:

   ```sh
   gcloud auth login
   gcloud config set project <project-id>
   ```

2. Enable Cloud Storage, Firestore and Vertex AI (for the embedding and chat models):

   ```sh
   gcloud services enable storage.googleapis.com firestore.googleapis.com aiplatform.googleapis.com
   ```

3. Create a private bucket for the uploaded PDFs:

   ```sh
   gcloud storage buckets create gs://<bucket-name> \
     --location us-central1 \
     --uniform-bucket-level-access \
     --public-access-prevention
   ```

4. Create the Firestore database. Its location can't be changed later:

   ```sh
   gcloud firestore databases create --database "(default)" --location us-central1
   ```

5. Create the composite vector index on the `chunks` collection, which retrieval needs to search the
   chunks of one document. The dimension must match `EMBEDDING_DIMENSIONS`:

   ```sh
   gcloud firestore indexes composite create \
     --database "(default)" \
     --collection-group chunks \
     --query-scope collection \
     --field-config field-path=ownerId,order=ascending \
     --field-config field-path=documentId,order=ascending \
     --field-config field-path=embedding,vector-config='{"dimension":"768","flat":"{}"}'
   ```

   The index takes a few minutes to build. Chat fails until its state is `READY`:

   ```sh
   gcloud firestore indexes composite list --database "(default)"
   ```

6. Grant these roles to the account the service runs as (your Google account locally, see
   [Credentials](run-locally.md#credentials)). A project owner already has them, so skip this step if you own the
   project:
   - `Storage Object Admin` (`roles/storage.objectAdmin`) on the bucket: object read/write/delete
   - `Cloud Datastore User` (`roles/datastore.user`): Firestore read/write
   - `Vertex AI User` (`roles/aiplatform.user`)

   ```sh
   gcloud storage buckets add-iam-policy-binding gs://<bucket-name> \
     --member <member> --role roles/storage.objectAdmin
   gcloud projects add-iam-policy-binding <project-id> --member <member> --role roles/datastore.user
   gcloud projects add-iam-policy-binding <project-id> --member <member> --role roles/aiplatform.user
   ```

   where `<member>` is `user:<your-email>` or `serviceAccount:<service-account-email>`.

7. Deploy the docling service. The app sends it pages with complex layouts and scanned pages, both
   locally and on Cloud Run. Follow [Deploy docling](deploy-docling.md). Locally, the app calls it as
   your Google account, which needs `roles/run.invoker` on the service. A project owner already has
   this role.
