# Chat with PDF

Upload your PDF and chat with it!

Answers to your questions will be grounded to the document you have uploaded!

## Screenshot
![ChatResponseScreenshot](docs/assets/ChatResponseScreenshotV0.png)

## Architecture Diagram

## Tech Stack

|  |  |
  |---|---|
  | Runtime | Node.js 26 + Express 5 |
  | Embeddings | Vertex AI `gemini-embedding-001` (768 dimensions) |
  | Chat / answer generation | Vertex AI `gemini-3.8-flash` |
  | AI SDK | `@google/genai` |
  | Vector store | Firestore vector search (`findNearest`, cosine distance) |
  | PDF text extraction | [`unpdf`](https://github.com/unjs/unpdf) |
  | File storage | GCP Cloud Storage |
  | Hosting | GCP Cloud Run |

## Roadmap

- Eval Harness
- Add new adapter for GCP "Vector Search"
- Support PDF containing images (OCR)
- Pub/Sub based upload detection

## Documentation

- [Prerequisites](docs/prerequisites.md)
- [Run locally](docs/run-locally.md)
- [Testing](docs/testing.md)
- [Deploy](docs/deploy.md)
- [Data model](docs/data-model.md)
- [RAG](docs/rag.md)
- [API](docs/api.md)
