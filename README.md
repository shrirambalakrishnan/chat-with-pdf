# Chat with PDF

Upload your PDF and chat with it!

Answers to your questions will be grounded in the document you have uploaded, with page citations!

Version 1 is an API only: no UI yet.

## Screenshot
![ChatResponseScreenshot](docs/assets/ChatResponseScreenshotV0.png)

## How this works?

```mermaid
flowchart TB
    subgraph upload["<span style='font-size:22px'><b>① Upload</b></span>"]
        direction LR
        u1(["Client"]) -->|"POST /documents"| u2["Create record<br/><i>pending_upload</i>"]
        u2 -->|"signed URL"| u3["Client PUTs PDF"]
        u3 --> u4[("Cloud Storage")]
        u4 -->|"POST /complete"| u5["Verify file<br/><i>uploaded</i>"]
    end

    subgraph ingest["<span style='font-size:22px'><b>② Extract & index</b></span>"]
        direction LR
        i1(["POST /extract"]) --> i2["Download PDF<br/>from Cloud Storage"]
        i2 --> extract
        subgraph extract["Extract text, page by page"]
            direction TB
            e1["unpdf reads<br/>the text layer"] --> e2{"Page has<br/>text?"}
            e2 -->|yes| e3(["Use unpdf text"])
            e2 -->|"no: scan / photo"| e4["docling OCR<br/><i>EasyOCR → markdown</i>"]
            e4 --> e5{"OCR score<br/>≥ 0.8?"}
            e5 -->|yes| e6(["Use docling text"])
            e5 -->|"no / missing"| e7["Gemini reads the page<br/><i>gemini-3.8-flash</i>"]
            e7 --> e8(["Use Gemini text"])
        end
        extract --> i4["Chunk<br/><i>200 words, 30 overlap</i>"]
        i4 --> i5["Embed chunks<br/><i>gemini-embedding-001</i>"]
        i5 --> i6[("Firestore<br/>chunks + vectors<br/><i>ready</i>")]
    end

    subgraph chat["<span style='font-size:22px'><b>③ Chat</b></span>"]
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
    class i1,i2,i4,i5,i6,e1,e2,e3,e4,e5,e6,e7,e8 ing
    class c1,c2,c3,c4,c5,c6 ask
    style upload fill:#f5faff,stroke:#1e88e5,stroke-width:2px
    style ingest fill:#f6fbf6,stroke:#43a047,stroke-width:2px
    style extract fill:#ffffff,stroke:#43a047,stroke-dasharray:4 3
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
  | PDF text extraction | [`unpdf`](https://github.com/unjs/unpdf) |
  | OCR for scanned pages | [docling-serve](https://github.com/docling-project/docling-serve) on Cloud Run, with EasyOCR |
  | OCR fallback | Vertex AI `gemini-3.8-flash`, for scanned pages docling's OCR scored below 0.8 |
  | PDF page splitting | [`pdf-lib`](https://github.com/Hopding/pdf-lib) |
  | File storage | GCP Cloud Storage |
  | Hosting | GCP Cloud Run |

## Roadmap

- Eval Harness
- Add new adapter for GCP "Vector Search"
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
