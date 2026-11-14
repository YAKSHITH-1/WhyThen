# Stage 5: Initial Zoom Out Review Report

**Target Document**: `docs/architecture/technical-architecture.md` (lines 1–423)  
**Reviewers**: Skeptical Architect (`egm-zoom-out`), Inventive Catalyst (`egm-inventive-catalyst`)

---

## 1. Skeptical Architect Review (Simplicity, Minimalism & YAGNI)

### Finding 1: Browser-Based Multipart File Upload (`/api/ingest/upload`)
* **Severity**: Blocker
* **Affected Scope**: Section 1.1 (Core Capabilities #1, line 26), Section 3.1 (lines 145–151), Section 6.1 (line 268), Section 8 (lines 387, 404).
* **Simplicity Rationale**:
  WhyThen is scoped as a local-first, single-user desktop application. The user's notes already live on their local filesystem.
  Introducing browser multipart uploads (`POST /api/ingest/upload` copying files into `data/uploads/`) is a web-app pattern that directly conflicts with local-first principles:
  1. **File Duplication**: Copies local files into a secondary directory (`data/uploads/`), severing links to the user's actual notes repository. When the user edits the original file in Obsidian or VS Code, WhyThen cannot incrementally detect the change via SHA-256 hash.
  2. **Unnecessary Surface**: Introduces multipart streaming, MIME type validation, file-size limits (25MB), temporary directory cleanup, and separate deletion handling.
  3. **Alternative**: Rely primarily on local folder scanning (`POST /api/ingest/folder`) using `FileScanner`. If file upload is maintained for browser drag-and-drop convenience, it must be treated as a secondary ingress into a dedicated folder without compromising file hash deduplication.

### Finding 2: Dynamic Runtime Settings & Hyperparameter Mutation (`POST /api/settings`)
* **Severity**: Blocker
* **Affected Scope**: Section 6.1 (lines 274–275), Section 6.2 (`SettingsPayload`, lines 342–356), Section 8 (lines 386, 414–417).
* **Simplicity Rationale**:
  The architecture proposes a dynamic settings API and UI view allowing users to modify runtime parameters including `embedding_model`, `chunk_size`, `chunk_overlap`, and retrieval weights over HTTP.
  1. **Index Incompatibility Trap**: If a user switches `embedding_model` from `all-MiniLM-L6-v2` to another model at runtime, all existing embeddings stored in ChromaDB become mathematically incompatible (differing dimensions and latent geometry), causing immediate search crashes.
  2. **No Reindexing Engine**: Modifying `chunk_size` or `chunk_overlap` at runtime invalidates chunk boundaries of already-indexed notes, but WhyThen has no background re-indexing engine.
  3. **Alternative**: Keep settings configuration-driven via `.env` or local JSON loaded at startup. The settings screen should be restricted to connection strings (Ollama host/port, active model) and read-only diagnostics (DB health, Ollama status, indexed counts).

### Finding 3: Redundant Retrieval Fusion & Ghost "Quality" Metric
* **Severity**: Major
* **Affected Scope**: Section 1.1 (#4, #5, lines 29–30), Section 3.2 (lines 158–163), Section 6.2 (lines 352–355).
* **Simplicity Rationale**:
  Section 3.2 specifies fusing candidates with RRF ($k=60$), but then immediately discards the RRF score and re-scores candidates using a 4-parameter linear combination:
  $$\text{Score} = 0.50 \cdot \text{sem} + 0.25 \cdot \text{lex} + 0.15 \cdot \text{temporal} + 0.10 \cdot \text{quality}$$
  The schema has no `quality` attribute. Fusing with RRF and then min-max normalizing sparse BM25 scores linearly introduces redundant math and arbitrary weights.
  **Alternative**: Standardize on RRF rank scoring directly, or filter candidates using hard date bounds and sort directly by fused RRF score. Eliminate the ad-hoc linear combination reranker and the synthetic quality metric.

### Finding 4: Decoupled Dual-Runtime Complexity (React + Vite vs. FastAPI)
* **Severity**: Major
* **Affected Scope**: Section 2 (lines 45–67), Section 7 (lines 361–374), Section 8 (Milestones 2 & 3).
* **Simplicity Rationale**:
  Requiring both Node.js (v18+) and Python runtimes for a single-user local tool adds build and packaging complexity (Vite proxy, CORS, static asset serving). Ensure the development and production workflows are streamlined so running both is frictionless, or generate TypeScript contracts directly from FastAPI OpenAPI to avoid dual-contract drift.

---

## 2. Inventive Catalyst Review (Contradiction Elimination & TRIZ Transforms)

### Finding 5: Synchronous Ingestion vs. Server Responsiveness & Client Timeouts
* **Severity**: Major
* **Affected Scope**: Section 1.2 (Line 38), Section 3.1 (Lines 137–150), Section 6.1 (`POST /api/ingest/folder`).
* **False Compromise**: Synchronous folder scanning, parsing, chunking, and embedding generation inside a single HTTP request will block the server for minutes, causing client timeouts.
* **TRIZ Resolution**: *Segmentation & Cheap Dispensables* (FastAPI `BackgroundTasks`).
  Return `202 Accepted` with a `job_id` immediately; execute scanning/embedding in background threads; expose `GET /api/ingest/jobs/{job_id}` for lightweight status tracking.

### Finding 6: Uncoordinated Dual-Store Persistence vs. Crash Consistency
* **Severity**: Major
* **Affected Scope**: Section 2.0 (Lines 104–115), Section 3.1 (Lines 143–144), Section 5.1.
* **False Compromise**: Splitting state between SQLite and ChromaDB without transactional coordination risks orphaned vectors or unindexed chunks on crash.
* **TRIZ Resolution**: *Self-Service & Intermediary* (Reconciliation loop & sync status flag).
  Add `vector_synced INTEGER DEFAULT 0` to SQLite `chunks`. Implement a startup integrity check (`ReconciliationService`) auditing SQLite chunks against ChromaDB collections.

### Finding 7: Query-Time Decision Synthesis Context Limits & Latency
* **Severity**: Major
* **Affected Scope**: Section 1.2 (Line 39), Section 3.3 (Lines 169–180), Section 6.1 (`GET /api/decisions/timeline`).
* **False Compromise**: Stuffing all historical chunks for a topic into a single Ollama prompt will overflow small-model context windows (4k–8k tokens) and cause 20–40s latency.
* **TRIZ Resolution**: *Preliminary Action & Segmentation* (Two-tier extraction).
  Apply lightweight regex heuristics during chunking (`is_decision_candidate`), prioritize decision-tagged chunks at query time, and cap retrieved context to $N=15$ chunks.
