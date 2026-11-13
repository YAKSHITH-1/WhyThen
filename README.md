# WhyThen

A local-first, time-aware personal memory and decision history assistant.

## Overview
WhyThen helps users search their personal notes, project logs, and learning records across time. It reconstructs what was decided, when, why, and whether choices were later revised or superseded, backed by verifiable citations and strict abstention when evidence is absent.

## Key Features
- **Incremental Ingestion**: Hashes files (Markdown, TXT, PDF) to index only new or modified files.
- **SQLite FTS5 + ChromaDB Hybrid Retrieval**: Merges keyword-exact matching with dense semantic embeddings via Reciprocal Rank Fusion.
- **Time-Aware Retrieval**: Distinguishes `event_date`, `document_date`, `modified_at`, and `ingested_at`.
- **Query-Time Decision Lineage**: Dynamically traces decisions, alternatives, rationales, and later reversals.
- **Grounded Answers**: Context-only answering with source excerpts, dates, and honest abstention.

## Setup
```bash
# Create and activate virtual environment
uv venv --python 3.12 .venv
.venv\Scripts\activate

# Install dependencies
uv pip install -e .[dev]
```

