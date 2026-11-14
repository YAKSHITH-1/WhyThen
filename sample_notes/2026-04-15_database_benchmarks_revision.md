# Architecture Progress & Decision: ChromaDB Benchmark Review

Date: 2026-04-15
Author: Performance & Database Team
Project: WhyThen

## Confirms: ChromaDB for MVP with LanceDB as Future Phase 2 Candidate

Following memory stress-testing across 5,000 synthetic technical notes on low-spec developer laptops (8 GB RAM), we observed that ChromaDB's in-memory index footprint grew noticeably under heavy concurrent insertions.

We benchmarked three local vector options:
1. ChromaDB (DuckDB + SQLite persistence)
2. LanceDB (file-based columnar vector store)
3. Qdrant embedded mode

We decided to confirm ChromaDB for the MVP release.
Switching our vector layer to LanceDB would require rewriting our collections manager and delayed our MVP milestone by 3 weeks. ChromaDB's local persistence is fully adequate for typical personal corpora (< 50,000 chunks).

### Actionable Contingency
We established a strict memory threshold: if ChromaDB heap memory exceeds 1.5 GB on corpora up to 20,000 documents, we will execute a migration to LanceDB in Phase 2.

## Unfinished Work
- Implement SQLite chunk synchronization status (`vector_synced`) to guarantee transactional consistency if embedding generation is interrupted.
- Build reconciliation service on startup to backfill orphaned chunks.
