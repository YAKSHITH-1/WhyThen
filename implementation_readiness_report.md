# Stage 9: Implementation Readiness Report

**Target Document**: `docs/architecture/technical-architecture.md` (DetailedRange: lines 375–423)  
**Reviewers**: Pragmatic Tech Lead (`egm-implementation-readiness`), Pedantic Quality Auditor (`egm-codebase-details`)

---

## Executive Summary
Section 8 ("Detailed Implementation Plan") outlines a structured milestone progression from backend hardening to frontend views and integration testing. However, the plan cannot be executed as written due to **critical routing mismatches, missing dependencies, unstated settings persistence mechanisms, and omitted endpoint implementations**.

---

## Itemized Findings & Audit

### 1. API Route Prefix Mismatch & Vite Proxy Disconnect
* **Severity**: 🔴 **Blocker**
* **Affected Scope**: Milestone 1 (Lines 384–389), `app/api/main.py`, `app/api/routes_*.py`.
* **Finding**:
  The existing backend routes in the codebase are currently mounted without an `/api` prefix (e.g. `routes_ingest.py` has `prefix="/ingest"`, `routes_search.py` mounts `/search` and `/ask` directly, `routes_decisions.py` has `prefix="/decisions"`).
  However, Section 6.1 and Section 7.1 dictate that the frontend Axios client and Vite dev proxy target `/api/*` (e.g., `POST /api/ingest/upload`, `GET /api/settings`, `POST /api/ask`).
  If Milestone 1 does not mandate refactoring `app/api/main.py` to route all endpoints under `/api`, all frontend API calls will fail with `404 Not Found`, and static mounting at `/` in production will collide with `/search` and `/ask`.
* **Actionable Fix**: Explicitly add a task in Milestone 1: *"Refactor `app/api/main.py` to mount all API sub-routers under the `/api` prefix (`/api/ingest`, `/api/search`, `/api/decisions`, `/api/dashboard`, `/api/settings`)."*

### 2. Missing `python-multipart` Dependency
* **Severity**: 🔴 **Blocker**
* **Affected Scope**: Milestone 1 Item 3 (Line 387), `pyproject.toml`.
* **Finding**:
  Milestone 1 item 3 specifies: `"Add POST /api/ingest/upload handling multipart uploads into data/uploads/"`.
  FastAPI strictly requires `python-multipart` to parse form-data and file uploads. `python-multipart` is currently missing from `pyproject.toml`. Attempting to accept file uploads will cause a runtime crash: `RuntimeError: Form data requires "python-multipart" to be installed.`
* **Actionable Fix**: Add `python-multipart>=0.0.9` to `dependencies` in `pyproject.toml`.

### 3. Settings Schema Discrepancy & Undefined Persistence Mechanism
* **Severity**: 🔴 **Blocker**
* **Affected Scope**: Milestone 1 Item 2 (Line 386), Section 6.2 (`SettingsPayload`), `app/config.py`.
* **Finding**:
  `SettingsPayload` specifies 13 fields (including `knowledge_base_dir`, `upload_dir`, `top_k`, `timezone`, `semantic_weight`, `keyword_weight`, `temporal_weight`, `relevance_threshold`).
  Existing `app/config.py` does not define these fields.
  Furthermore, the SQLite database schema has no `settings` table, and `pydantic-settings` reads from environment variables at startup. The implementation plan specifies no persistence mechanism for `POST /api/settings` (e.g. JSON file or SQLite table).
* **Actionable Fix**: Define `SettingsService` reading and writing to `data/settings.json`, and expose default/custom values cleanly to the settings endpoints.

### 4. SPA Client-Side Fallback Routing Omitted for Production
* **Severity**: 🔴 **Blocker**
* **Affected Scope**: Milestone 1 Item 4 (Line 388), Section 7.2.
* **Finding**:
  Milestone 1 Item 4 specifies "add conditional static mounting of `frontend/dist`".
  In FastAPI, mounting `StaticFiles(directory="frontend/dist", html=True)` only resolves files that physically exist. When using React Router (`/timeline`, `/sources`, `/ask`), browser refresh or direct navigation triggers an HTTP 404.
* **Actionable Fix**: Register a catch-all route `@app.get("/{full_path:path}")` returning `FileResponse("frontend/dist/index.html")` for non-API routes when `frontend/dist` exists.

### 5. Incomplete Upload Contract & Missing Document Delete Endpoint
* **Severity**: 🟡 **Major**
* **Affected Scope**: Milestone 1 (Lines 384–389), Table 6.1 (Line 270), Milestone 3 Item 2 (Line 405).
* **Finding**:
  Milestone 3 Item 2 mandates document delete actions, and Table 6.1 documents `DELETE /api/ingest/documents/{id}`.
  However, Milestone 1 completely omits implementing this endpoint and the underlying service method (`IngestService.delete_document`).
* **Actionable Fix**: Add `DELETE /api/ingest/documents/{id}` to Milestone 1, implementing cascading deletion across SQLite and ChromaDB.

### 6. Undefined Contract & Aggregation Logic for Dashboard Summary
* **Severity**: 🟡 **Major**
* **Affected Scope**: Milestone 1 Item 1 (Line 385), Section 6.2, `app/storage/repositories.py`.
* **Finding**:
  `routes_dashboard.py` must calculate total documents, total chunks, storage sizes, and recent files.
  - Section 6.2 lacks the TypeScript interface `DashboardSummaryResponse`.
  - `DocumentRepository` and `ChunkRepository` lack lightweight `SELECT COUNT(*)` and `SELECT * ... ORDER BY ingested_at DESC LIMIT 5` methods.
* **Actionable Fix**: Add `count()` and `get_recent(limit=5)` to repositories; define `DashboardSummaryResponse` in Pydantic and TypeScript contracts.

### 7. Missing Action Tag Markers (`[Create]`, `[Modify]`, `[Delete]`)
* **Severity**: 🟡 **Major**
* **Affected Scope**: Section 8 (Milestones 1–3, Lines 378–418).
* **Finding**: Files listed in the plan are not tagged with operational states (e.g. `[Create]` for `routes_dashboard.py`, `[Modify]` for `routes_ingest.py` and `app/api/main.py`), leaving file boundaries ambiguous.
* **Actionable Fix**: Explicitly annotate every file in Milestones 1–3 with `[Create]`, `[Modify]`, or `[Delete]`.

### 8. Deprecated FastAPI Startup Event
* **Severity**: 🟢 **Nit**
* **Affected Scope**: `app/api/main.py` (Line 23).
* **Finding**: `@app.on_event("startup")` is deprecated in FastAPI/Starlette in favor of the `lifespan` context manager.
* **Actionable Fix**: Refactor to `@asynccontextmanager async def lifespan(app: FastAPI)` during Milestone 1.

### 9. Health Endpoint Live Probing
* **Severity**: 🟢 **Nit**
* **Affected Scope**: Table 6.1 (Line 265), `app/api/main.py`.
* **Finding**: Existing `/health` returns a static stub without probing SQLite or Ollama. Upgrade to test database query and Ollama reachability.
