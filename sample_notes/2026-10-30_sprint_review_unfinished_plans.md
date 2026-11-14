# Sprint Review: Q4 Roadmap & Unfinished Plans

Date: 2026-10-30
Author: Product & Architecture Team
Project: WhyThen

## Completed Architecture Deliverables
1. Local-first RAG pipeline integrating SQLite FTS5 and ChromaDB embeddings.
2. Background asynchronous ingestion worker with `202 Accepted` job polling.
3. Path sandboxing and security validation preventing file traversal.
4. React + TypeScript frontend with 5 production screens (Dashboard, Ask WhyThen, Decision Timeline, Knowledge Sources, Settings).
5. Grounded citation verification with honest abstention coverage badges.

## Unfinished Plans & Pending Decisions
The following features are scheduled for post-MVP releases:
1. Server-Sent Events (SSE) Streaming: Real-time token streaming for LLM answers instead of synchronous REST POST `/ask`.
2. Complex PDF Table Parsing: Enhance PyMuPDF parser with OCR and table boundary detection for financial and tabular notes.
3. Decision Export: Export decision timelines directly to Markdown or formatted PDF reports for executive distribution.
4. Voice Dictation: Direct audio capture for fast voice note ingestion on desktop.
