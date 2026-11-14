# WhyThen 🧭

A local-first, time-aware personal memory and decision history assistant.

## Overview
WhyThen helps users search and reconstruct their personal notes, project logs, and architecture records across time. It recovers what was decided, when it was decided, why it was chosen, and whether earlier decisions were later revised or superseded—all backed by verifiable citations and explicit abstention when evidence is absent.

## Technology Stack
- **Frontend**: React 18/19, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, Axios, Lucide React.
- **Backend**: Python 3.12, FastAPI, SQLite (FTS5 BM25), ChromaDB, Sentence Transformers (`all-MiniLM-L6-v2`), Ollama (local LLM).

## Core Features
1. **Dashboard**: High-level overview of indexed knowledge sources, chunk metrics, and quick search.
2. **Ask WhyThen**: Grounded natural-language Q&A with date filters, verifiable bracketed citations (`[chunk_id]`), and honest abstention badges.
3. **Decision Timeline**: Chronological reconstruction of choices, rationales, and later revisions (`INITIAL_CHOICE`, `REVISES`, `CONFIRMS`).
4. **Knowledge Sources**: Supports both local absolute folder path scanning (incremental SHA-256 detection) and browser-based multi-file upload.
5. **Settings**: Configurable local Ollama host, model picker, storage paths, and retrieval parameters.

---

## Getting Started

### 1. Prerequisites
- **Python**: 3.11+ (Python 3.12 recommended, managed via `uv`)
- **Node.js**: v18+ (Node v24 recommended)
- **Ollama**: (Optional for local LLM inference) `ollama run llama3.2`

### 2. Backend Setup
```powershell
# Create Python 3.12 virtual environment with uv
uv venv --python 3.12 .venv
.venv\Scripts\activate

# Install dependencies in editable mode
uv pip install -e .[dev]

# Start FastAPI server (runs on http://localhost:8000)
.\.venv\Scripts\uvicorn app.api.main:app --reload --port 8000
```

### 3. Frontend Setup
```powershell
# Navigate to frontend directory and install dependencies
cd frontend
npm install

# Start Vite development server (runs on http://localhost:5173 with /api proxy)
npm run dev
```

### 4. Running Tests
```powershell
# Run backend pytest suite
.\.venv\Scripts\pytest -v

# Run frontend typecheck & build
cd frontend
npm run build
```
