# Consolidated Architectural Review Report

**Target Document**: `docs/architecture/technical-architecture.md` (lines 1–423)  
**Protocol**: EGM Goldfish Review Protocol — Uninterrupted Full Flow  
**Stages Executed**: 
- Stage 5: Initial Zoom Out Review (`zoom_out_report.md`)
- Stage 6: Comprehension Test (`comprehension_report.md`)
- Stage 7: Critic Review (`critic_report.md`)
- Stage 8: Intermediate Zoom Out Review (`intermediate_zoom_out_report.md`)
- Stage 9: Implementation Readiness Test (`implementation_readiness_report.md`)

---

## 1. Executive Summary

WhyThen possesses a compelling, well-founded core value proposition: a **local-first, time-aware personal memory and decision history assistant**. Its foundation—pairing dense vector search with SQLite FTS5 BM25 lexical indexing, chronological decision lineage synthesis, and strict source grounding with honest abstention—is technically sound.

However, the transition from Streamlit to a standalone React + TypeScript frontend exposed critical architectural disconnects:
1. **API Prefix Routing Disconnect**: The existing backend mounts routes at root (`/search`, `/ask`, `/ingest`), whereas the frontend and Vite proxy target `/api/*`.
2. **Missing Multipart Dependency**: File upload support was specified without `python-multipart` in dependencies.
3. **Synchronous Ingestion & Server Lockup**: Ingesting folders inside a synchronous HTTP request will block Uvicorn and trigger client timeouts.
4. **Local Attack Surface**: Wildcard CORS combined with arbitrary local folder scanning creates an unintended local file disclosure vector.
5. **Dual-Store Inconsistency**: Sequential writes to SQLite and ChromaDB lack reconciliation on failures.
6. **Settings Persistence & Vector Dimensionality**: Modifying embedding models at runtime crashes ChromaDB without a collection versioning or migration strategy.
7. **Single-Process Production 404s**: React Router client routes 404 in production mode without a FastAPI SPA catch-all fallback.

All identified vulnerabilities can be resolved using **native Python and standard FastAPI primitives** without external enterprise message brokers or cloud services.

---

## 2. Consolidated Action Items by Priority

### 🔴 Blockers (Must Resolve Before Frontend Implementation)

| ID | Title | Description | Target Scope |
| :--- | :--- | :--- | :--- |
| **B-01** | **API Prefix Mount (`/api/*`)** | Refactor `app/api/main.py` to mount all API routers under the `/api` prefix (`/api/ingest`, `/api/search`, `/api/decisions`, `/api/dashboard`, `/api/settings`) so Vite dev proxy and production static mounting do not 404 or collide. | `app/api/main.py`, `app/api/routes_*.py` |
| **B-02** | **Add `python-multipart` Dependency** | Add `python-multipart>=0.0.9` to `dependencies` in `pyproject.toml` to prevent runtime crashes on multipart file uploads. | `pyproject.toml` |
| **B-03** | **Asynchronous Background Ingestion** | Convert `POST /api/ingest/folder` to use FastAPI `BackgroundTasks`. Return `202 Accepted` with a `job_id` immediately; expose `GET /api/ingest/jobs/{job_id}` for progress tracking to prevent client timeouts. | `app/api/routes_ingest.py`, `app/services/ingest_service.py` |
| **B-04** | **CORS & Filesystem Sandboxing** | Restrict CORS strictly to `http://localhost:5173` in development. Validate folder paths to block traversal into operating system root folders (`Windows`, `Program Files`, `.ssh`). | `app/api/main.py`, `app/ingestion/scanner.py` |
| **B-05** | **Dual-Store Atomicity & Reconciliation** | Add `vector_synced INTEGER DEFAULT 0` to SQLite `chunks` table. Add a startup reconciliation check in `app/api/main.py` lifespan that detects and backfills unsynced chunks in ChromaDB. | `app/storage/database.py`, `app/services/ingest_service.py` |
| **B-06** | **Settings Persistence & Guardrails** | Implement `SettingsService` reading and writing to `data/settings.json`. Prevent runtime modification of `embedding_model` if documents exist, or require an explicit re-index confirmation. | `app/services/settings_service.py`, `app/config.py` |
| **B-07** | **FastAPI SPA Catch-All Fallback Route** | Register a catch-all route `@app.get("/{full_path:path}")` returning `frontend/dist/index.html` for any non-API path in production mode so React Router paths (`/timeline`, `/ask`) do not 404. | `app/api/main.py` |

---

### 🟡 Major Action Items (High Priority)

| ID | Title | Description | Target Scope |
| :--- | :--- | :--- | :--- |
| **M-01** | **Upload Deduplication & Exclusion** | Anchor document deduplication on SHA-256 `content_hash`. Automatically exclude `data/uploads/` from recursive folder scanning to prevent duplicate chunk indexing. | `app/ingestion/scanner.py`, `app/services/ingest_service.py` |
| **M-02** | **Implement Document Deletion Endpoint** | Add `delete_document(doc_id: str)` to `IngestService` and expose `DELETE /api/ingest/documents/{id}` cascading across SQLite and ChromaDB. | `app/api/routes_ingest.py`, `app/services/ingest_service.py` |
| **M-03** | **Dashboard Summary Contract & Queries** | Define `DashboardSummaryResponse` in Pydantic and TypeScript. Add `count()` and `get_recent(limit=5)` to `DocumentRepository` and `ChunkRepository`. | `app/schemas/dashboard.py`, `app/storage/repositories.py` |
| **M-04** | **Coalesced Effective Date Filtering** | Filter temporal queries on $\text{effective\_date} = \text{coalesce}(\text{event\_date}, \text{document\_date}, \text{modified\_at})$ so undated notes are not abruptly dropped. | `app/services/search_service.py`, `app/retrieval/reranker.py` |
| **M-05** | **Rationalize Reranking Formula** | Min-max normalize BM25 scores before combining with cosine similarity. Drop the unbacked `quality` variable from the formula: $\text{Score} = 0.50 \cdot \text{sem} + 0.30 \cdot \text{lex} + 0.20 \cdot \text{temporal}$. | `app/retrieval/reranker.py`, `docs/architecture/technical-architecture.md` |
| **M-06** | **SQLite Concurrency PRAGMAs** | Enable `PRAGMA journal_mode = WAL;` and `PRAGMA busy_timeout = 5000;` on SQLite connection initialization to allow concurrent reads during ingestion. | `app/storage/database.py` |
| **M-07** | **Decision Timeline Context Window Cap** | Cap retrieved chunks fed into Ollama for timeline extraction to $N=15$ chunks to avoid context overflow on local 8B models. | `app/services/decision_service.py` |
| **M-08** | **Action Tags in Implementation Plan** | Annotate every file in Milestones 1–3 with operational markers: `[Create]`, `[Modify]`, or `[Delete]`. | `docs/architecture/technical-architecture.md` |
| **M-09** | **Expand TypeScript Contract Coverage** | Add TypeScript definitions for `DashboardSummaryResponse`, `IngestJobResponse`, `ApiErrorResponse`, and `HealthResponse`. | `frontend/src/types/` |

---

### 🟢 Nits & Code Quality

| ID | Title | Description | Target Scope |
| :--- | :--- | :--- | :--- |
| **N-01** | **FastAPI Lifespan Context Manager** | Replace deprecated `@app.on_event("startup")` with `@asynccontextmanager async def lifespan(app: FastAPI)`. | `app/api/main.py` |
| **N-02** | **Live Health Diagnostic Probing** | Update `GET /health` to probe SQLite connectivity and Ollama daemon reachability. | `app/api/main.py` |
| **N-03** | **Decision Relation Enum Casing** | Harmonize `DecisionRelation` casing to lowercase literals with uppercase UI display transforms. | `frontend/src/types/decision.ts`, `docs/architecture/technical-architecture.md` |
| **N-04** | **Remove Promotional Jargon & Hedging** | Remove marketing buzzwords ("unlike standard document chatbots", "first-class signals") from architectural documentation. | `docs/architecture/technical-architecture.md` |

---

## 3. Traceability Matrix

| Consolidated Action Item | Stage 5 (Zoom Out) | Stage 6 (Comprehension) | Stage 7 (Critic) | Stage 8 (Inter. Zoom Out) | Stage 9 (Readiness) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **B-01 (API Prefix Mount)** | — | Finding 7 | — | — | Finding 1, Codebase Finding 2 |
| **B-02 (python-multipart Dep)** | — | — | — | — | Codebase Finding 3 |
| **B-03 (Async Ingestion)** | Finding 5 | Finding 5 | Finding 1.1 | Section 2.1 | — |
| **B-04 (CORS & Sandboxing)** | — | — | Finding 2.1 | Section 2.4 | — |
| **B-05 (Dual-Store Atomicity)** | Finding 6 | — | Finding 4.1 | Section 2.2 | — |
| **B-06 (Settings Persistence)** | Finding 2 | Finding 3 | Finding 4.3 | — | Finding 5, Codebase Finding 4 |
| **B-07 (SPA Fallback Route)** | — | Finding 8 | Finding 6.1 | Section 2.5 | Finding 3 |
| **M-01 (Upload Deduplication)**| Finding 1 | — | Finding 3.1 | — | Codebase Finding 6 |
| **M-02 (Document Delete API)** | — | — | Finding 3.2 | — | Finding 6, Codebase Finding 5 |
| **M-03 (Dashboard Summary)** | — | Finding 2 | — | — | Finding 4, Codebase Finding 7 |
| **M-04 (Coalesced Date Filter)**| — | Finding 6 | Finding 5.1 | Section 2.3 | — |
| **M-05 (Reranking & Quality)** | Finding 3 | Finding 1 | Finding 5.2, 13 | Section 2.3 | Codebase Finding 10 |
| **M-06 (SQLite WAL Mode)** | — | — | Finding 4.2 | — | — |
| **M-07 (Decision Context Cap)**| Finding 7 | Finding 4 | Finding 1.3 | — | — |
| **M-08 (Action Tag Markers)** | — | — | — | — | Codebase Finding 1 |
| **M-09 (TS Contract Coverage)**| — | Finding 4 | Finding 12 | — | — |
| **N-01 (Lifespan Refactor)** | — | — | — | — | Codebase Finding 11 |
| **N-02 (Live Health Probe)** | — | — | — | — | Codebase Finding 9 |
| **N-03 (Relation Enum Casing)**| — | Finding 9 | — | — | Finding 9 |
| **N-04 (Style & Precision)** | — | — | Finding 14, 15 | — | — |

---

## 4. Remediation Sequence

To proceed seamlessly with implementation:
1. **Apply Architecture Document Fixes**: Update `docs/architecture/technical-architecture.md` with the resolved formulas, background job endpoints, `/api` prefixes, and complete TypeScript contracts.
2. **Execute Milestone 1 (Backend Hardening)**:
   - Mount all routes under `/api/*`.
   - Add `python-multipart` to `pyproject.toml`.
   - Add SQLite WAL mode & startup reconciliation in `app/api/main.py`.
   - Implement `routes_dashboard.py`, `routes_settings.py`, and `DELETE /api/ingest/documents/{id}`.
   - Implement SPA fallback handler for `frontend/dist`.
3. **Execute Milestones 2 & 3 (React Frontend)**:
   - Scaffold Vite React TypeScript app with Tailwind and shadcn/ui.
   - Implement the 5 functional screens targeting the `/api/*` endpoints.
