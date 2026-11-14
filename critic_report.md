# Stage 7: Critic Review Report

**Target Document**: `docs/architecture/technical-architecture.md` (FeatureRange: lines 1–374)  
**Reviewers**: Hostile Design Critic (`egm-design`), Structural Document Architect (`egm-structural`), Technical Copy Editor (`egm-style`)

---

## 1. Hostile Design Critic Findings (Architecture, Security & Robustness)

### Finding 1: Synchronous Blocking Ingestion in Request-Response Cycle
* **Severity**: 🔴 Blocker
* **Affected Scope**: Section 1.1, Section 3.1, Section 6.1 (`POST /api/ingest/folder`, `POST /api/ingest/upload`).
* **Critique**: Ingesting hundreds of files (PDF parsing + SentenceTransformers embeddings) synchronously blocks the Uvicorn worker thread and triggers Axios / browser connection timeouts. Ingestion must return `202 Accepted` with a `job_id` and execute in background tasks.

### Finding 2: Synchronous Blocking LLM Generation & Timeout Vulnerability
* **Severity**: 🔴 Blocker
* **Affected Scope**: Section 1.2, Section 3.2, Section 6.1 (`POST /api/ask`).
* **Critique**: Local Ollama generation with a 2,500-token context pack takes 15–45+ seconds on CPU/entry GPU. Synchronous calls lock the UI on a spinner and risk client drops. If SSE streaming is deferred for the MVP, the client must use long timeouts (>60s) with explicit `AbortController` cancellation.

### Finding 3: Arbitrary Filesystem Traversal & Data Exfiltration via Wildcard CORS
* **Severity**: 🔴 Blocker
* **Affected Scope**: Section 2 (Line 72), Section 3.1, Section 6.1 (`POST /api/ingest/folder`).
* **Critique**: `POST /api/ingest/folder` accepts arbitrary absolute paths. Paired with `allow_origins=["*"]`, any malicious webpage the user browses could issue background fetch requests to `localhost:8000/api/ingest/folder` pointing to sensitive folders (`.ssh`, `.aws`) and extract data via `/api/search`.
* **Fix**: Restrict CORS strictly to `http://localhost:5173` in development, block access to system directories (`Windows`, `Program Files`, `.ssh`), and validate paths.

### Finding 4: Dual Ingestion Path Collisions & Duplicate Chunks
* **Severity**: 🟡 Major
* **Affected Scope**: Section 3.1, Section 5.1 (`documents` table `path TEXT UNIQUE`).
* **Critique**: Scanned local files are indexed by system path; uploaded files are written to `data/uploads/`. If a user uploads a file that already exists in a scanned folder, both are indexed separately under different paths, creating duplicate chunks and inflating BM25 scores. Deduplication must anchor on SHA-256 `content_hash`, and `upload_dir` must be excluded from folder scans.

### Finding 5: Non-Atomic Dual Writes Across SQLite and ChromaDB
* **Severity**: 🔴 Blocker
* **Affected Scope**: Section 2.0, Section 3.1.
* **Critique**: SQLite commits and ChromaDB vector upserts are executed sequentially without compensation. If ChromaDB fails mid-batch, SQLite marks the file indexed, but vectors are missing, permanently breaking dense retrieval for that file.

### Finding 6: Missing SQLite Concurrency PRAGMAs (WAL Mode & Busy Timeout)
* **Severity**: 🟡 Major
* **Affected Scope**: Section 5.1 (`whythen.db` schema).
* **Critique**: Omitting `PRAGMA journal_mode = WAL;` and `PRAGMA busy_timeout = 5000;` causes concurrent reads from the UI (`GET /api/dashboard/summary`) to crash with `sqlite3.OperationalError: database is locked` while ingestion writes chunks.

### Finding 7: All-or-Nothing Hard Date Filtering Drops Undated Notes
* **Severity**: 🟡 Major
* **Affected Scope**: Section 3.2, Section 4.
* **Critique**: If personal notes lack explicit dates (`event_date IS NULL`), strict date range queries either drop them completely or leak ancient notes.
* **Fix**: Coalesce timestamps: $\text{effective\_date} = \text{coalesce}(\text{event\_date}, \text{document\_date}, \text{modified\_at})$ and apply boundary checks on effective date with down-weighted confidence.

### Finding 8: Mathematical Disconnect in Reranking & BM25 Scoring
* **Severity**: 🟡 Major
* **Affected Scope**: Section 3.2 (Lines 158–162).
* **Critique**: SQLite FTS5 `bm25()` returns negative values (lower is better), while cosine similarity is in $[0, 1]$. Linearly combining them without min-max normalization inverts the ranking.

---

## 2. Structural Document Architect Findings (Layout & Symmetry)

### Finding 9: Singleton Subsections & Structural Asymmetry
* **Severity**: 🟡 Major
* **Affected Scope**: Section 2 (`## 2. High-Level Architecture`) and Section 5 (`## 5. Storage Schema & Data Models`).
* **Critique**: Section 2 only defines `2.1 Component Responsibilities` with no 2.2. Section 5 only defines `5.1 SQLite Tables` while omitting `5.2 ChromaDB Collections & Embedding Schema` and `5.3 Filesystem Storage Model`.

### Finding 10: Section 4 Truncation & Heading Scope Mismatch
* **Severity**: 🟡 Major
* **Affected Scope**: Section 4 (`## 4. Time-Aware Retrieval & Date Schema`).
* **Critique**: Section 4 contains only a 4-row date resolution table and no retrieval algorithms or temporal weighting formulas (which were scattered in Section 3.2).

### Finding 11: Missing Behavioral Sequence Diagrams in Section 3
* **Severity**: 🟡 Major
* **Affected Scope**: Section 3 (Lines 132–181).
* **Critique**: Ingestion, Grounded Q&A, and Decision Lineage flows are described exclusively as dense numbered text without sequence diagrams (`sequenceDiagram`).

### Finding 12: API Contract Coverage Gap in Section 6.2
* **Severity**: 🟡 Major
* **Affected Scope**: Section 6.1 vs. Section 6.2.
* **Critique**: Section 6.1 lists 11 endpoints, but Section 6.2 only defines TypeScript types for 4 endpoints. Missing schemas: `DashboardSummaryResponse`, `FolderIngestRequest/Response`, `UploadIngestResponse`, `SearchRequest/Response`, and `ApiErrorResponse`.

---

## 3. Technical Copy Editor Findings (Style & Precision)

### Finding 13: Uncalibrated Claim & Undefined "Quality" Metric
* **Severity**: 🟡 Major
* **Affected Scope**: Section 1.1 (Line 30) & Section 3.2 (Line 162).
* **Critique**: Formula includes `+ 0.10 * quality`, but `quality` is never defined or measured in the text, and is omitted from `SettingsPayload`. Recalibrate weights or define exact heuristic.

### Finding 14: Uncalibrated Engineering Disjunction ("Mark or purge")
* **Severity**: 🟡 Major
* **Affected Scope**: Section 3.1 (Line 144).
* **Critique**: "Mark or purge deleted files" is an uncalibrated design hedge. Specify deterministic behavior: uploaded files are purged from disk; local scanned files are retained on disk and tombstoned in SQLite.

### Finding 15: Promotional Contrast & Jargon
* **Severity**: 🟢 Nit
* **Affected Scope**: Section 1 (Line 19).
* **Critique**: "Unlike standard document chatbots, WhyThen treats time... as first-class retrieval signals" is marketing jargon. Replace with direct technical framing: "WhyThen incorporates timestamp metadata and decision history as primary query filtering and reranking dimensions."
