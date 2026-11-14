# Stage 8: Intermediate Zoom Out Review Report

**Target Document**: `docs/architecture/technical-architecture.md` (lines 1–423)  
**Reviewer**: Skeptical Architect (`egm-zoom-out`)  
**Context**: Evaluates additions, mitigations, and systemic complexity resulting from Stage 5 (Initial Zoom Out), Stage 6 (Comprehension), and Stage 7 (Critic) reports.

---

## 1. High-Altitude Review: Convergence & Simplification Opportunities

The reviews from the Comprehension, Critic, and Inventive Catalyst stages have identified critical technical failure modes:
1. **Synchronous Ingestion Lockup**: The UI freezes and HTTP requests time out when indexing multiple files.
2. **Dual-Store Inconsistency**: Decoupled writes between SQLite and ChromaDB risk corrupted index state.
3. **Ghost Variables & Disconnected RRF**: Mathematical confusion between RRF rank pooling and 4-weight linear reranking.
4. **Security Hole**: Wildcard CORS combined with absolute path folder ingestion creates a local file disclosure vector.

However, in addressing these findings, the architecture must **avoid over-compensating with enterprise bloat** (e.g. adding Celery, Redis, message queues, Docker, or complex distributed saga state machines).

---

## 2. Minimalist Remediation Architecture (YAGNI & Infrastructure Economics)

### 2.1 Native Asynchronous Ingestion without External Brokers
* **Over-Engineered Temptation**: Introducing Celery, Redis, or RabbitMQ for background jobs.
* **Minimalist Solution**: Use FastAPI's native `BackgroundTasks` executing within the existing Python process. The endpoint `POST /api/ingest/folder` generates a UUID `job_id`, records it in the existing `ingestion_jobs` SQLite table, spawns the background worker, and returns `202 Accepted` immediately. The frontend polls `GET /api/ingest/jobs/{job_id}` every 1–2 seconds. Zero new infrastructure dependencies.

### 2.2 Reconcile Dual-Store Writes with Self-Healing Startup Check
* **Over-Engineered Temptation**: Two-phase commit protocol or external distributed transaction manager.
* **Minimalist Solution**: 
  - Add `vector_synced INTEGER DEFAULT 0` column to the `chunks` SQLite table.
  - Set `vector_synced = 1` immediately after ChromaDB batch upsert succeeds.
  - On application startup (`lifespan`), a 10-line query identifies any chunks where `vector_synced = 0` and schedules background re-embedding.

### 2.3 Rationalize Retrieval Pipeline & Eliminate Phantom "Quality"
* **Over-Engineered Temptation**: Complex multi-pass rerankers with fine-tuned cross-encoders.
* **Minimalist Solution**:
  - Two clean stages:
    - **Stage 1 (Hybrid Candidate Retrieval)**: Query ChromaDB (dense) and SQLite FTS5 (sparse BM25). Fuse using Reciprocal Rank Fusion ($k=60$) to obtain top 20 candidates.
    - **Stage 2 (Temporal Filtering & Scoring)**: Apply hard date filtering on `effective_date = coalesce(event_date, document_date, modified_at)`.
    - Apply transparent normalized reranking:
      $$\text{Score} = 0.50 \cdot \text{sem} + 0.30 \cdot \text{lex} + 0.20 \cdot \text{temporal\_fit}$$
      (Eliminating the synthetic, unbacked `quality` variable entirely).

### 2.4 Sanitize Ingestion Boundaries & Tighten CORS
* **Minimalist Solution**:
  - Restrict CORS origin strictly to `http://localhost:5173` in development.
  - Validate folder paths to ensure they exist, are directories, and are not root or system-critical folders (`C:\Windows`, `C:\Program Files`, `~/.ssh`).

### 2.5 Single-Process Desktop Packaging
* **Minimalist Solution**:
  - Keep React Router client routes working in production mode by adding a simple 5-line catch-all route in FastAPI (`@app.get("/{full_path:path}")`) that serves `frontend/dist/index.html` for any path not prefixed with `/api` or `/health`.

---

## 3. Verdict
The architecture can achieve rock-solid reliability, security, and responsive UX purely through native Python and standard FastAPI primitives. Do not add external services.
