# Chat with PDF

Upload your PDF and chat with it!

Answers to your questions will be grounded to the document you have uploaded!

## Setup

### Prerequisites

- Node **v26.2.0** and npm **11.13.0** (enforced — `npm install` fails on other versions)
- A GCP project with:
  - a Cloud Storage bucket
  - a Firestore database
  - a service account with object read/write/delete on the bucket and Firestore read/write

```sh
nvm use        # picks v26.2.0 from .nvmrc
npm install
```

### Service account key

Download a JSON key for the service account from the GCP console and save it at the repo root as
`service-account-key.json`. This file is gitignored — never commit it.
`service-account-key.example.json` shows the expected shape.

### Environment variables

Copy `.env.example` to `.env` and fill in every value:

| Variable | Description |
| --- | --- |
| `GCP_PROJECT_ID` | GCP project id |
| `GCS_BUCKET_NAME` | Cloud Storage bucket name |
| `FIRESTORE_DATABASE_ID` | Firestore database id (`(default)` for the default database) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to the service account key file, e.g. `./service-account-key.json` |
| `PORT` | Optional, defaults to `3000` |

The service refuses to start if any required variable is missing, and names the missing ones.

### Run

```sh
npm start      # run the server
npm run dev    # run with auto-restart on file changes
```

Check it is up:

```sh
curl http://localhost:3000/health   # {"status":"ok"}
```

## Data model

### `users` collection

| Field | Type | Notes |
| --- | --- | --- |
| document id | string | Fixed for the seed user (from the seed config file), auto-generated for real users later. Not duplicated as a field. |
| `name` | string | |
| `email` | string | |
| `createdAt` | timestamp | Set by the server when the document is created |

## Seed user

Until auth exists, every document belongs to a single seed user. Its `id`, `name` and `email` live in
`scripts/seed-user/seed-user.json`. That file is for seeding only — application code reads users from
Firestore, never from this file.

With `.env` and the key file in place, create the seed user:

```sh
npm run seed:user
```

This creates `users/{id}` using the `id` from the config file as the document id. It is safe to re-run:
if the user already exists it is left unchanged.
