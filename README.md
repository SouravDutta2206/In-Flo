# In-Flo 🤖

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-18%2B-brightgreen.svg)
![Python](https://img.shields.io/badge/python-3.11%2B-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.116%2B-009688.svg)

> A modern, multi-provider AI chat interface with web search and retrieval-augmented generation (RAG) capabilities.
---

## ✨ Features

- **Multi-Provider Support** — Seamlessly switch between Ollama (local), HuggingFace, OpenRouter, Groq, and Gemini
- **Real-Time Streaming** — Server-sent events for instant, token-by-token responses
- **Web Search** — DuckDuckGo search + FAISS retrieval for grounded, citation-backed answers
- **Privacy-First** — Run entirely locally with Ollama for complete data privacy
- **Easy Configuration** — Manage API keys and models through an intuitive Settings page

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version  | Notes                |
| ----------- | -------- | -------------------- |
| Node.js     | 18+      | LTS recommended      |
| pnpm        | Latest   | Or npm/yarn          |
| Python      | 3.11+    | Required for backend |
| uv          | Latest   | Recommended (or pip) |
| Ollama      | Optional | For local models     |

### Installation

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd LocalLLM
   ```

2. **Start the Frontend**

   ```bash
   pnpm install
   pnpm dev
   # → http://localhost:3000
   ```

3. **Start the Backend**

   Using [uv](https://docs.astral.sh/uv/) (recommended):

   ```bash
   cd python-backend
   uv sync
   uv run uvicorn server:app --reload --host 0.0.0.0 --port 8000
   ```

   Or using pip:

   ```bash
   cd python-backend
   python -m venv .venv
   .venv\Scripts\activate  # Windows
   # source .venv/bin/activate  # Linux/macOS
   pip install -e .
   uvicorn server:app --reload --host 0.0.0.0 --port 8000
   ```

4. **Open the app** at [http://localhost:3000](http://localhost:3000)

---

## ⚙️ Configuration

### API Keys

Navigate to **Settings → API Keys** to configure your providers:

| Provider    | API Key Required | Notes                                             |
| ----------- | ---------------- | ------------------------------------------------- |
| Ollama      | ❌ No            | Auto-detected when running locally                |
| HuggingFace | ✅ Yes           | [Get key](https://huggingface.co/settings/tokens) |
| OpenRouter  | ✅ Yes           | [Get key](https://openrouter.ai/keys)             |
| Groq        | ✅ Yes           | [Get key](https://console.groq.com/keys)          |
| Gemini      | ✅ Yes           | [Get key](https://aistudio.google.com/app/apikey) |

### Web Search

Enable **Web Search** in the chat UI for retrieval-augmented responses. The backend uses DuckDuckGo for search and FAISS for semantic retrieval.

---

## 💬 Usage

1. **Select a model** from the model selector in the input area
2. **Toggle Web Search** to enable grounded responses with citations
3. **Start chatting!**

### API Example

For debugging or integration, you can call the backend directly:

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "conversation": [{"role": "user", "content": "What is quantum computing?"}],
    "model": {"name": "llama3.2", "provider": "ollama"},
    "web_search": false
  }'
```

See [schemas.py](python-backend/utils/schemas.py) for the full request/response shapes.

---
## 🔍 Web Search

When **Web Search** is enabled, the app uses a RAG (Retrieval-Augmented Generation) pipeline to provide grounded, citation-backed answers.

![Web-Search Architecture](https://github.com/SouravDutta2206/In-Flo/blob/main/public/data/web-search-architecture.png)

### Architecture Overview

The web search pipeline consists of three main components working together:

#### 1. Search Component

| Module              | Technology          | Details                                                     |
| ------------------- | ------------------- | ----------------------------------------------------------- |
| **Primary Search**  | DuckDuckGo (`ddgs`) | Fetches URLs matching the user query                        |
| **Fallback Search** | Tavily API          | Used when DuckDuckGo fails or returns no results            |
| **URL Filtering**   | Domain exclusions   | Filters out Wikipedia, Reddit, YouTube, Quora, Britannica   |
| **Retry Logic**     | Adaptive fetching   | Retries with increased offset until target results achieved |

#### 2. Scraper Component

| Step                    | Technology               | Details                                                |
| ----------------------- | ------------------------ | ------------------------------------------------------ |
| **Async Fetching**      | `httpx`                  | Concurrent requests (max 10) with 30s timeout          |
| **HTML Parsing**        | `BeautifulSoup` + `lxml` | Extracts main content, removes noise elements          |
| **Content Cleaning**    | Custom filters           | Removes nav, ads, sidebars, link lists, empty elements |
| **Markdown Conversion** | `markdownify`            | Converts clean HTML to structured markdown             |
| **Output Format**       | LangChain `Document`     | Includes `source` URL and `title` in metadata          |

#### 3. Embedding & Retrieval Component

| Step                  | Technology                       | Details                                               |
| --------------------- | -------------------------------- | ----------------------------------------------------- |
| **Text Chunking**     | LangChain `RecursiveCharacterTextSplitter` | 800-char chunks with 80-char overlap                  |
| **Embedding Model**   | `all-MiniLM-L6-v2`               | Sentence-Transformers model (384 dimensions)          |
| **Vector Index**      | FAISS            | Returns 5 most semantically similar chunks |
| **Source Mapping**    | Custom formatter                 | Wraps chunks with `<source_id>` tags for citation     |

### Pipeline Flow

1. **User Query** → Sent to both Search and Embedding components
2. **Search** → DuckDuckGo (or Tavily fallback) finds relevant URLs
3. **Scrape** → Async HTTP fetch → BeautifulSoup parsing → Markdown extraction
4. **Chunk** → Documents split into 800-char overlapping chunks
5. **Embed** → Query and chunks embedded with `all-MiniLM-L6-v2`
6. **Retrieve** → FAISS returns top-5 semantically similar chunks
7. **Format** → Chunks wrapped with source IDs and combined with original query
8. **Generate** → LLM produces response with inline `[N]` citations
---
## 🗺️ Roadmap

Planned features for future releases:

- [ ] **Local Knowledge Base** — Generate and query knowledge bases from user-provided documents and online sources
- [ ] **Deep Research Agent** — Autonomous research agent for complex multi-step queries
- [ ] **YouTube Integration** — Transcribe and extract information from YouTube videos
- [ ] **Multi-Modal Inference** — Image and audio processing for supported models

## 📄 License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

---


