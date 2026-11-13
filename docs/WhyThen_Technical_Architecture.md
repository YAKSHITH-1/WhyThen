# MemoTrail

A Local-First, Time-Aware Personal Memory & Decision History Assistant

TECHNICAL ARCHITECTURE DOCUMENT  |  MVP

Document detail

Description

Purpose

Define the system architecture, components, data flow, storage model, APIs, and MVP implementation plan.

Primary use case

Search personal notes and project history by topic and time; reconstruct decisions and changes of mind with source evidence.

Design principle

Local-first, source-grounded, incremental indexing, and explicit handling of missing evidence.

Suggested implementation

Python, FastAPI, Streamlit, SQLite, ChromaDB, BM25, sentence-transformers, and Ollama or a configurable LLM API.

Scope

Beginner-to-intermediate MVP; one user; local files and notes; no email/calendar integrations in the first release.

## 1. Product Overview

MemoTrail is a personal knowledge assistant that helps a user recover what they learned, planned, and decided over time. Unlike a basic document chatbot, it treats time and decision history as first-class retrieval signals. It answers questions such as “What did I decide about the database last month?”, “Did I change my mind?”, and “What was I planning to do next?”

1.1 Core capabilities

Ingest local Markdown, TXT, PDF, and optionally DOCX files from user-selected folders.

Extract document text and preserve source path, title, dates, and file metadata.

Split content into retrieval chunks and create embeddings for semantic search.

Build a keyword index (BM25) alongside the vector index for hybrid retrieval.

Apply date filters and recency-aware ranking without allowing recency to override relevance blindly.

Identify candidate decisions, technologies, reasons, dates, and later revisions.

Generate answers with citations to source files and relevant excerpts.

Return “no supporting record found” when the indexed material does not justify an answer.

Incrementally re-index only new or modified files.

1.2 Non-goals for the MVP

Not a general-purpose autonomous agent or a replacement for a notes application.

No automatic scraping of websites, social media, or private accounts.

No automatic editing or deletion of the user's source documents.

No guaranteed extraction of every decision; extracted decisions are suggestions that must remain traceable to source text.

No multi-user collaboration, mobile app, or cloud synchronization in the first version.

## 2. High-Level Architecture

The MVP uses a modular monolith: one Python application with clearly separated ingestion, indexing, retrieval, decision analysis, and answer-generation modules. This keeps deployment simple while preserving clean boundaries.

USER                     |              Streamlit Web UI                     |               FastAPI Backend                     |       +-------------+-------------------+       |             |                   |   Ingestion      Query Service     Decision Service       |             |                   |  File Parsers   Query Understanding  Decision Extraction  Normalization  Date Filter          Timeline Builder  Chunking       Hybrid Retrieval     Change Detection       |             |                   |       +-------------+-------------------+                     |               Retrieval Layer          +----------+-----------+          |                      |     ChromaDB                BM25 Index   (embeddings)             (keywords)          |                      |          +----------+-----------+                     |              Reranking / Scoring                     |              LLM Answer Layer                     |          Answer + citations + dates                     |       SQLite metadata / local files

2.1 Component responsibilities

Component

Responsibility

Suggested technology

Frontend

Upload/select folders, ask questions, inspect citations and timelines.

Streamlit

API layer

Expose ingestion, search, timeline, and health endpoints.

FastAPI + Pydantic

Ingestion

Parse files, normalize text, extract metadata, detect updates.

Python; PyMuPDF; python-docx; Markdown parser

Chunking

Create overlapping, source-aware text chunks.

Custom Python module

Embedding

Convert chunks and queries into vectors.

sentence-transformers; bge-small-en or equivalent

Vector store

Store embeddings and metadata for semantic retrieval.

ChromaDB

Keyword search

Retrieve exact names, terms, identifiers, and phrases.

rank_bm25

Metadata store

Track documents, chunks, hashes, dates, and ingestion state.

SQLite

Decision analysis

Extract and group decision statements and possible revisions.

LLM structured output + validation

Answer generation

Compose grounded answers with dated source references.

Ollama local model or configurable API

## 3. End-to-End Data Flow

3.1 Ingestion and indexing flow

User selects a folder or uploads files through the UI.

File scanner enumerates supported files and rejects unsupported or oversized files.

Compute a content hash (for example SHA-256) and compare it with the SQLite document registry.

Skip unchanged files; process new or modified files; mark removed files as unavailable without deleting the originals.

Extract text using a parser selected by file type. Preserve page numbers or section headings where possible.

Normalize whitespace and remove extraction artefacts while retaining meaningful structure such as headings, dates, and code blocks.

Extract document-level metadata: source path, filename, title, created/modified timestamps when available, and ingestion timestamp.

Infer a content date only when it is explicitly present or reliably available; store the date source and confidence.

Split text into chunks using heading-aware boundaries, with a target of roughly 400–700 tokens and 60–100 tokens overlap as an initial experiment.

Generate embeddings and upsert chunks into ChromaDB; update BM25 corpus and SQLite metadata.

Optionally run decision extraction on chunks and store candidate decision records with source references.

3.2 Query and answer flow

Receive the user's question and classify its intent: general recall, date-scoped recall, decision history, comparison, or unfinished-plan lookup.

Extract entities and temporal constraints such as project name, technology, “last month”, or a date range.

Convert relative dates using the user's configured timezone; store and query normalized date boundaries.

Run metadata filtering first when a date range, source type, or project filter is specified.

Retrieve candidates from both vector search and BM25 search.

Merge candidate lists using Reciprocal Rank Fusion (RRF) or a comparable rank-fusion method.

Apply a time-aware reranker using semantic relevance, keyword relevance, date fit, and source quality.

Construct a context pack containing excerpts, source identifiers, dates, and file paths.

Ask the LLM to answer only from the retrieved context and require citations for factual claims.

Validate that cited chunk IDs exist and return the answer, source excerpts, dates, and a confidence/coverage indicator.

3.3 Decision-history flow

Decision tracking should be implemented as a layer on top of ordinary retrieval, not as an independent source of truth. The original source chunks remain authoritative; extracted decision records are structured indexes that point back to them.

Detect candidate statements expressing a decision, preference, rejected option, reason, action item, or later revision.

Extract structured fields: project/entity, decision statement, chosen option, alternatives, rationale, event date, and source chunk ID.

Normalize entity names carefully (for example, “vector DB” and “ChromaDB” may be related but should not be merged without evidence).

Group related records into a decision thread using entity/project similarity and temporal proximity.

Detect possible changes: a later record explicitly replaces, reverses, or qualifies an earlier decision.

Present the timeline chronologically and label uncertain relationships as “possible change” rather than asserting a definite reversal.

## 4. Time-Aware Retrieval Design

Time-aware retrieval is the main differentiator. The system must distinguish when a file was created, when an event was described, and when the system indexed it. These timestamps are not interchangeable.

Field

Meaning

Example / rule

event_date

When the note says the event or decision happened.

Explicit date in the text; highest priority when clear.

document_date

Date associated with the source document.

File metadata or front matter; retain provenance.

modified_at

Filesystem last-modified time.

Useful fallback, not proof of event date.

ingested_at

When MemoTrail indexed the content.

System-generated timestamp.

date_confidence

Reliability of the selected event/document date.

high / medium / low, or numeric score.

4.1 Ranking strategy

Start with hybrid retrieval and a transparent weighted score. Tune weights using a small evaluation set rather than assuming one formula is universally best.

final_score =    0.50 * semantic_score  + 0.25 * keyword_score  + 0.15 * temporal_fit  + 0.10 * source_qualitytemporal_fit:  - Strong boost when the chunk falls inside an explicit requested date range.  - Mild recency preference only when the question implies “latest” or “recent”.  - No recency boost for questions asking what happened in a past period.  - Never use time score to rescue a semantically irrelevant chunk.

These weights are initial placeholders. Normalize component scores and evaluate alternatives. For explicit date filters, filter candidates before ranking instead of relying only on a date score.

## 5. Data Model

5.1 SQLite tables

Table

Important columns

Purpose

documents

id, path, filename, content_hash, file_type, title, document_date, modified_at, ingested_at, status

One row per source file.

chunks

id, document_id, chunk_index, text, heading, page_number, event_date, date_confidence

Canonical chunk metadata and text.

decision_records

id, project, entity, decision_text, chosen_option, alternatives, rationale, event_date, confidence, source_chunk_id

Extracted decision candidates with provenance.

decision_links

id, from_decision_id, to_decision_id, relation_type, confidence

Possible supersedes/revises/confirms relationships.

ingestion_jobs

id, started_at, finished_at, status, files_processed, error_summary

Track indexing runs and failures.

5.2 Vector-store metadata

{  "chunk_id": "chunk_...",  "document_id": "doc_...",  "source_path": "notes/project-x.md",  "title": "Database selection",  "event_date": "2026-03-06",  "document_date": "2026-03-06",  "modified_at": "2026-03-07T10:30:00+05:30",  "project": "Project X",  "section": "Database decision",  "file_type": "md"}

Keep the full canonical text and relational metadata in SQLite; store vectors and searchable metadata in ChromaDB. Avoid depending on the vector database as the only source of truth.

## 6. API Design

Method

Endpoint

Purpose

GET

/health

Check application and storage status.

POST

/ingest/folder

Start indexing a user-selected local folder.

POST

/ingest/file

Index one uploaded file.

GET

/ingest/jobs/{job_id}

Check ingestion progress and errors.

POST

/search

Run hybrid retrieval with optional date/source filters.

POST

/ask

Generate a cited answer from retrieved context.

GET

/decisions

List decision records with project/date filters.

GET

/decisions/{decision_id}/timeline

Return linked decisions in chronological order.

POST

/reindex/{document_id}

Reprocess a specific document.

6.1 Example request: ask

POST /ask{  "question": "Why did I choose ChromaDB for Project X?",  "date_from": "2026-03-01",  "date_to": "2026-03-31",  "project": "Project X",  "answer_mode": "decision_history"}

6.2 Example response shape

{  "answer": "The notes indicate that ChromaDB was selected ...",  "coverage": "supported",  "sources": [    {      "source_path": "notes/project-x.md",      "event_date": "2026-03-06",      "chunk_id": "chunk_123",      "excerpt": "..."    }  ],  "timeline": [],  "limitations": []}

## 7. Suggested Repository Structure

memotrail/├── app/│   ├── main.py                 # FastAPI entry point│   ├── config.py               # Settings and paths│   ├── api/│   │   ├── routes_ingest.py│   │   ├── routes_search.py│   │   └── routes_decisions.py│   ├── ingestion/│   │   ├── scanner.py│   │   ├── parsers.py│   │   ├── normalize.py│   │   ├── metadata.py│   │   └── chunker.py│   ├── retrieval/│   │   ├── embeddings.py│   │   ├── vector_store.py│   │   ├── keyword_search.py│   │   ├── fusion.py│   │   └── reranker.py│   ├── decisions/│   │   ├── extractor.py│   │   ├── linker.py│   │   └── timeline.py│   ├── generation/│   │   ├── prompts.py│   │   └── answerer.py│   ├── storage/│   │   ├── database.py│   │   └── repositories.py│   └── schemas/├── ui/│   └── streamlit_app.py├── data/│   ├── sqlite/│   ├── chroma/│   └── cache/├── tests/│   ├── test_ingestion.py│   ├── test_retrieval.py│   ├── test_temporal_filters.py│   └── test_citations.py├── evaluation/│   ├── questions.json│   └── run_eval.py├── .env.example├── .gitignore├── pyproject.toml└── README.md

## 8. Technology Stack

Layer

MVP choice

Reason

Language

Python 3.11+

Strong ecosystem for parsing, RAG, and APIs.

Backend

FastAPI + Pydantic

Typed request/response contracts and clean API boundaries.

UI

Streamlit

Fastest route to a usable prototype.

Metadata DB

SQLite

Simple local relational store; no separate server.

Vector DB

ChromaDB

Local persistent vector storage and metadata filtering.

Embeddings

bge-small-en or another compact sentence-transformer

Local embedding generation; benchmark quality and speed.

Keyword retrieval

rank_bm25

Simple lexical retrieval for exact terms and names.

LLM

Ollama with a locally available model; API adapter optional

Supports local-first operation; quality depends on hardware/model.

Parsing

PyMuPDF, python-docx, Markdown/TXT readers

Local extraction from common personal knowledge formats.

Testing

pytest

Unit and integration tests.

Packaging

venv/uv and optionally Docker

Repeatable setup; Docker is optional for a local MVP.

## 9. Security, Privacy, and Reliability

Process files locally by default; do not transmit source text to external APIs unless the user explicitly enables that mode.

Make the LLM provider configurable and clearly indicate whether a query leaves the device.

Restrict ingestion to user-selected directories; prevent path traversal and accidental indexing of system folders.

Do not execute scripts, macros, or embedded content found inside documents.

Set file-size, page-count, and processing-time limits; handle malformed files without crashing the entire job.

Keep original files read-only; store indexes and derived data in MemoTrail's own data directory.

Provide a delete-index operation that removes derived chunks/vectors while leaving source files untouched.

Avoid logging full personal note contents; log identifiers, timings, and errors instead.

Treat LLM-extracted decisions as untrusted candidates and validate every displayed claim against source chunks.

Back up the SQLite database and vector-store directory together; document recovery steps.

## 10. Evaluation Plan

Create a small hand-labelled evaluation set before tuning retrieval. Use synthetic or non-sensitive sample notes initially.

Metric

What it measures

How to evaluate

Recall@5

Whether a relevant source appears in the top five results.

For each test question, label relevant chunk IDs and calculate hit rate.

MRR

How high the first relevant result appears.

Average reciprocal rank of the first relevant chunk.

Citation accuracy

Whether citations support the answer.

Manually verify each cited excerpt against the generated claim.

Temporal accuracy

Whether the answer uses the correct period and event date.

Test explicit dates, relative dates, and conflicting file/event dates.

Faithfulness

Whether the answer stays within retrieved evidence.

Human review; optionally use an LLM judge as a secondary signal.

Decision-link accuracy

Whether revisions and confirmations are correctly linked.

Label decision pairs as revises/confirms/unrelated and compare.

10.1 Minimum test cases

A question with an explicit date range.

A question asking for the latest decision.

A question asking what was decided before a later change.

Two notes that disagree or describe a changed preference.

A note with no explicit date but a filesystem modified date.

A question whose answer is absent from all indexed sources.

An exact technical term that BM25 should retrieve.

A semantic paraphrase that vector search should retrieve.

A file updated after initial indexing.

A deleted or moved source file.

## 11. MVP Build Phases

Phase

Deliverable

Completion criteria

## 1. Foundation

Project setup, SQLite schema, local UI, folder selection.

Can select files and see supported/unsupported file status.

## 2. Ingestion

Parsing, normalization, metadata, chunking, incremental hashes.

New and changed files are indexed; unchanged files are skipped.

## 3. Retrieval

Embeddings, ChromaDB, BM25, fusion, date filters.

Search returns relevant chunks with source and date metadata.

## 4. Grounded Q&A

LLM answer generation, citations, no-evidence fallback.

Answers cite retrieved sources; unsupported questions abstain.

## 5. Decision timeline

Decision extraction, grouping, revision links, timeline UI.

Can show a sourced chronological history for a small test project.

## 6. Evaluation & polish

Evaluation dataset, metrics, error handling, README/demo.

Measured retrieval results and documented limitations.

## 12. MVP Acceptance Criteria

A user can index a local folder containing Markdown, TXT, and PDF files.

The system can answer a question using both semantic and keyword retrieval.

The user can constrain a query to a date range.

Every factual answer includes source file references and excerpts.

The system distinguishes event date from file modification and ingestion dates.

The user can view a chronological decision timeline with links to original evidence.

The system does not invent a reason when no source records that reason.

Re-indexing skips unchanged files and updates modified files.

A small evaluation report records Recall@5, MRR, temporal accuracy, and citation accuracy.

## 13. Key Risks and Mitigations

Risk

Why it matters

Mitigation

Incorrect date inference

A wrong date can produce a false timeline.

Store date provenance/confidence; prefer explicit event dates; show uncertainty.

False decision links

The app may claim the user changed their mind when they did not.

Use conservative linking; require evidence; expose “possible revision”.

Poor retrieval on small notes

Short notes may lack context or exact wording.

Use hybrid retrieval, metadata filters, and source-aware chunking.

LLM hallucination

The answer may add a reason not present in notes.

Strict context-only prompt, citations, validation, and abstention.

Local model performance

Small hardware may limit response speed or quality.

Make model configurable; keep retrieval independent of generation.

Sensitive content exposure

Personal notes may contain private information.

Local-first defaults, explicit external-provider opt-in, minimal logs.

## 14. Recommended MVP Scope

Keep the first release narrow: one user, one local folder, Markdown/TXT/PDF ingestion, SQLite metadata, ChromaDB + BM25 hybrid retrieval, date filters, cited answers, and a basic decision timeline. Start with manual decision extraction triggered during indexing or on demand. Add automatic contradiction detection, browser imports, chat exports, multi-device sync, and integrations only after the core retrieval quality is measured.

## 15. Example User Journey

The user selects a folder containing project notes and learning logs.

MemoTrail indexes files and displays how many documents and chunks were processed.

The user asks: “What did I decide about the vector database in March?”

MemoTrail filters to March, retrieves relevant notes with hybrid search, and assembles a dated timeline.

The answer explains the recorded choice and rationale, with links to the exact source excerpts.

If the notes do not record a reason, MemoTrail explicitly says that no reason was found.

End of document
