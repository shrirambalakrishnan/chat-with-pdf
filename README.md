# Chat with PDF

Upload your PDF and chat with it!

Answers to your questions will be grounded in the document you have uploaded, with page citations!

Version 1 is an API only: no UI yet.

## Screenshot
![ChatResponseScreenshot](docs/assets/ChatResponseScreenshotV0.png)

## How this works?

```mermaid
flowchart TB
    subgraph upload["① Upload"]
        direction LR
        u1(["Client"]) -->|"POST /documents"| u2["Create record<br/><i>pending_upload</i>"]
        u2 -->|"signed URL"| u3["Client PUTs PDF"]
        u3 --> u4[("Cloud Storage")]
        u4 -->|"POST /complete"| u5["Verify file<br/><i>uploaded</i>"]
    end

    subgraph ingest["② Extract & index"]
        direction LR
        i1(["POST /extract"]) --> i2["Download PDF<br/>from Cloud Storage"]
        i2 --> i3["Extract text per page<br/><i>docling</i>"]
        i3 --> i4["Chunk<br/><i>200 words, 30 overlap</i>"]
        i4 --> i5["Embed chunks<br/><i>gemini-embedding-001</i>"]
        i5 --> i6[("Firestore<br/>chunks + vectors<br/><i>ready</i>")]
    end

    subgraph chat["③ Chat"]
        direction LR
        c1(["POST /chat<br/>question"]) --> c2["Embed question<br/><i>gemini-embedding-001</i>"]
        c2 --> c3[("Firestore<br/>findNearest, top 5")]
        c3 -->|"top 5 excerpts"| c4["Build prompt<br/><i>system prompt + question<br/>+ excerpts with pages</i>"]
        c4 -->|"generateContent"| c5[["Gemini 3.8 Flash<br/><i>Vertex AI</i>"]]
        c5 --> c6(["Answer +<br/>page citations"])
    end

    upload ~~~ ingest ~~~ chat

    classDef up fill:#e3f2fd,stroke:#1e88e5,color:#0d47a1
    classDef ing fill:#e8f5e9,stroke:#43a047,color:#1b5e20
    classDef ask fill:#fff3e0,stroke:#fb8c00,color:#e65100
    class u1,u2,u3,u4,u5 up
    class i1,i2,i3,i4,i5,i6 ing
    class c1,c2,c3,c4,c5,c6 ask
    style upload fill:#f5faff,stroke:#1e88e5,stroke-width:2px
    style ingest fill:#f6fbf6,stroke:#43a047,stroke-width:2px
    style chat fill:#fffaf3,stroke:#fb8c00,stroke-width:2px
```

## Tech Stack

|  |  |
  |---|---|
  | Runtime | Node.js 26 + Express 5 |
  | Embeddings | Vertex AI `gemini-embedding-001` (768 dimensions) |
  | Chat / answer generation | Vertex AI `gemini-3.8-flash` |
  | AI SDK | `@google/genai` |
  | Vector store | Firestore vector search (`findNearest`, cosine distance) |
  | PDF text extraction | [docling-serve](https://github.com/docling-project/docling-serve) on Cloud Run, OCR off; [`unpdf`](https://github.com/unjs/unpdf) to find pages with a text layer |
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
- [Deploy docling](docs/deploy-docling.md)
- [Data model](docs/data-model.md)
- [RAG](docs/rag.md)
- [API](docs/api.md)
