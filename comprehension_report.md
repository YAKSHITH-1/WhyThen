# Comprehension Review Report

## Paraphrase

### What this proposes
WhyThen proposes a local-first, single-user desktop personal memory and decision-history assistant built with a React/TypeScript frontend (Vite, Tailwind, shadcn/ui) and a Python FastAPI backend. The system ingests local notes (Markdown, TXT, PDF) via folder scanning and browser uploads, chunks text structurally with temporal metadata extraction, and supports hybrid retrieval (BM25 sparse search via SQLite FTS5 and dense semantic search via ChromaDB) combined through Reciprocal Rank Fusion and temporal reranking. Grounded answers and chronological decision timelines are generated locally using Ollama, citing verifiable chunks and explicitly abstaining when supporting evidence is lacking.

### How the existing system works, per this document
Per the architecture document, an existing Python/FastAPI backend core already contains ingestion logic (`_ingest_single_file`), retrieval components, and test suites (`pytest`), but currently lacks dashboard/settings routes, upload endpoints, and CORS/static mounting. The frontend client does not currently exist as an integrated application and must be initialized from scratch using Vite, React, and TypeScript to connect to the backend services.

---

## Findings

### Finding 1
* **Severity**: Blocker
* **Affected Scope**: Section 1.1 (Lines 29–30), Section 3.2 (Lines 158–162)
* **Discrepancy Description & Rationale**: **Conflicting retrieval/reranking pipeline and undefined `quality` and `temporal` scoring metrics.**
  - In Section 3.2, step 3 specifies fusing candidate chunks using Reciprocal Rank Fusion ($RRF(d) = \sum \frac{1}{60 + \text{rank}_m(d)}$), but step 5 introduces an independent linear reranking formula: $\text{Score} = 0.50 \cdot \text{sem} + 0.25 \cdot \text{lex} + 0.15 \cdot \text{temporal} + 0.10 \cdot \text{quality}$.
  - The document fails to clarify whether step 5 replaces RRF or operates as a second-pass reranker on top of RRF. If it operates on top, it does not explain how `sem` (cosine similarity) and `lex` (SQLite FTS5 BM25 unbounded negative scores) are normalized to a common $[0, 1]$ interval.
  - Most critically, `quality` is never defined or mentioned anywhere else in the document. A fresh reader or developer has no specification of what factors constitute chunk quality (e.g., character length, structural hierarchy, presence of dates, markdown formatting).
  - Furthermore, the decay curve or distance function used to calculate `temporal` score from `event_date` is omitted.

### Finding 2
* **Severity**: Blocker
* **Affected Scope**: Section 3.2 (Line 154), Section 5.1 (Lines 201–255), Section 6.2 (Line 312)
* **Discrepancy Description & Rationale**: **Ghost `project` filter parameter in API contract without schema or extraction support.**
  - Section 3.2 states that the query flow accepts an optional "project filter", and Section 6.2 defines `project?: string | null;` in `AskRequest`.
  - However, the SQLite schema in Section 5.1 contains no `project` column or foreign key in either the `documents` or `chunks` tables.
  - The document provides no explanation or mechanism for how projects are defined, extracted (e.g., from frontmatter, parent directory names, or tags), stored, or queried in the retrieval pipeline.

### Finding 3
* **Severity**: Major
* **Affected Scope**: Section 1.1 (Line 33), Section 5.1 (Lines 201–255), Section 6.1 (Lines 274–275), Section 6.2 (Lines 342–357), Section 8 (Lines 386, 416)
* **Discrepancy Description & Rationale**: **Unstated persistence mechanism and undefined re-indexing execution for runtime settings.**
  - `SettingsPayload` defines 13 configurable parameters including Ollama endpoints, model names, directory paths, chunk size, chunk overlap, weights, and thresholds.
  - The SQLite database schema has no table for system settings or configuration. The document does not state where or how settings are persisted (e.g., a local JSON file like `data/settings.json`, environment variables, or an unstated table).
  - The document mentions presenting a "re-indexing warnings modal" when chunking or embedding parameters are modified (lines 33, 416). However, there is no `/api/ingest/reindex` or index-purge endpoint defined in the API contract (Section 6.1), and no explanation of how vector dimension mismatches or re-chunking of existing files are executed upon configuration change.

### Finding 4
* **Severity**: Major
* **Affected Scope**: Section 2.1 (Line 127), Section 3.3 (Lines 179–180)
* **Discrepancy Description & Rationale**: **Vague and hand-waved deterministic heuristic fallback for decision lineage reconstruction.**
  - Line 179 states: "If the LLM is unreachable or returns malformed JSON, a deterministic heuristic fallback identifies decision keywords and constructs the timeline safely."
  - The document gives zero operational specification for this heuristic: it does not define the keyword dictionary, how decision relations (`initial_choice`, `revises`, `supersedes`, `confirms`) are inferred without semantic understanding, or how rationales and unresolved questions are parsed deterministically.

### Finding 5
* **Severity**: Major
* **Affected Scope**: Section 3.1 (Lines 141–144), Section 5.1 (Line 213), Section 6.2 (Line 280)
* **Discrepancy Description & Rationale**: **Inconsistent document status taxonomy and unspecified lifecycle state transitions.**
  - Section 3.1 states that the file scanner categorizes files into `unchanged`, `new`, `modified`, and `removed`.
  - Section 5.1 stores `documents.status` as an unconstrained `TEXT NOT NULL`.
  - Section 6.2 defines `DocumentStatus = 'indexed' | 'modified' | 'removed' | 'failed'`.
  - The document does not define how `new` maps to `indexed`, what conditions cause `failed`, whether `unchanged` is represented in the database, or how the backend updates statuses between folder scans and multipart file uploads.

### Finding 6
* **Severity**: Major
* **Affected Scope**: Section 3.2 (Lines 160–167), Section 4 (Lines 187–193), Section 6.2 (Line 306)
* **Discrepancy Description & Rationale**: **Ambiguous filtering of undated chunks and unstated citation validation recovery behavior.**
  - Section 4 acknowledges that chunks can have missing or null dates (`event_date` is nullable in Section 5.1). Section 3.2 states that candidates with known `event_date` outside `[date_from, date_to]` are eliminated. The document does not specify whether chunks with `event_date = NULL` are kept or discarded when date range boundaries are applied.
  - Section 3.2 states that the system "Validates that citations exist in the candidate set" and assigns a coverage badge (`supported`, `partial`, `no_evidence_found`). However, it does not state what happens if the LLM hallucinates citations (does the backend strip them, regenerate, or downgrade coverage?), nor does it provide quantitative thresholds for distinguishing between `'supported'` and `'partial'`.

### Finding 7
* **Severity**: Nit
* **Affected Scope**: Section 3.2 (Line 157)
* **Discrepancy Description & Rationale**: **Syntactically invalid SQLite FTS5 query representation.**
  - Line 157 writes: `SQLite FTS5 MATCH bm25(chunks_fts)`.
  - In SQLite FTS5, `MATCH` takes a search query string (`chunks_fts MATCH '...'`), while `bm25(chunks_fts)` is an auxiliary ranking function used in the `SELECT` or `ORDER BY` clause. This representation is inaccurate.

### Finding 8
* **Severity**: Nit
* **Affected Scope**: Section 7.2 (Lines 371–372), Section 8 (Line 388)
* **Discrepancy Description & Rationale**: **Missing SPA HTML fallback routing requirement in FastAPI production mode.**
  - Section 7.2 describes FastAPI serving `frontend/dist` on `/` while hosting `/api/*` on port 8000.
  - When serving a React Router single-page application with client-side routes (e.g. `/timeline`, `/ask`), standard static file mounting without a catch-all route returning `index.html` causes HTTP 404 errors on browser refresh or direct navigation.

### Finding 9
* **Severity**: Nit
* **Affected Scope**: Section 6.2 (Line 324) vs. Section 8 (Line 412)
* **Discrepancy Description & Rationale**: **Inconsistent naming and casing of timeline relation statuses.**
  - Section 6.2 defines `export type DecisionRelation = 'initial_choice' | 'revises' | 'supersedes' | 'confirms'`.
  - Section 8 (Milestone 3.4) refers to badges as uppercase (`INITIAL_CHOICE`, `REVISES`, `CONFIRMS`) and omits `SUPERSEDES`.
