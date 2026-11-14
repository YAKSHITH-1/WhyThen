import pytest
from app.decisions.timeline import decision_builder
from app.schemas.chunk import ChunkRecord


def test_decision_timeline_relationship_classification():
    # 1. July record: Explicitly supersedes previous static reranking
    july_chunk = ChunkRecord(
        id="july_chunk_01",
        document_id="doc_temporal",
        chunk_index=0,
        heading="## Supersedes: Static Similarity Reranking",
        text="We decided to supersede pure similarity ranking with Time-Aware Normalized Reranking.",
        event_date="2026-07-25",
        source_path="sample_notes/2026-07-25_temporal_reranking.md",
    )
    rel_july = decision_builder._classify_relation(july_chunk.heading, july_chunk.text)
    assert rel_july == "supersedes", f"Expected 'supersedes', but got '{rel_july}'"

    # 2. October record: Unfinished plans containing 'instead of' must NOT be classified as revises
    oct_chunk = ChunkRecord(
        id="oct_chunk_01",
        document_id="doc_sprint",
        chunk_index=0,
        heading="## Unfinished Plans & Pending Decisions",
        text="1. Server-Sent Events (SSE) Streaming: Real-time token streaming for LLM answers instead of synchronous REST POST /ask.",
        event_date="2026-10-30",
        source_path="sample_notes/2026-10-30_sprint_review_unfinished_plans.md",
    )
    rel_oct = decision_builder._classify_relation(oct_chunk.heading, oct_chunk.text)
    assert rel_oct == "unfinished_plan", f"Expected 'unfinished_plan', but got '{rel_oct}'"

    # 3. April record: Explicitly confirms previous choice
    apr_chunk = ChunkRecord(
        id="apr_chunk_01",
        document_id="doc_benchmarks",
        chunk_index=0,
        heading="## Confirms: ChromaDB for MVP with LanceDB as Future Phase 2 Candidate",
        text="We decided to confirm ChromaDB for the MVP release because switching to LanceDB would delay timeline.",
        event_date="2026-04-15",
        source_path="sample_notes/2026-04-15_database_benchmarks_revision.md",
    )
    rel_apr = decision_builder._classify_relation(apr_chunk.heading, apr_chunk.text)
    assert rel_apr == "confirms", f"Expected 'confirms', but got '{rel_apr}'"

    # 4. March record: Explicitly revises retrieval strategy
    mar_chunk = ChunkRecord(
        id="mar_chunk_01",
        document_id="doc_hybrid",
        chunk_index=0,
        heading="## Revises: Pure Dense Vector Search",
        text="We decided to revise our retrieval strategy by introducing Hybrid Search combining vectors and BM25.",
        event_date="2026-03-20",
        source_path="sample_notes/2026-03-20_hybrid_search_bm25.md",
    )
    rel_mar = decision_builder._classify_relation(mar_chunk.heading, mar_chunk.text)
    assert rel_mar == "revises", f"Expected 'revises', but got '{rel_mar}'"

    # 5. January record: Initial baseline choice
    jan_chunk = ChunkRecord(
        id="jan_chunk_01",
        document_id="doc_db",
        chunk_index=0,
        heading="## Initial Choice: Local SQLite + ChromaDB",
        text="We decided to choose embedded SQLite and ChromaDB instead of PostgreSQL or cloud services.",
        event_date="2026-01-15",
        source_path="sample_notes/2026-01-15_database_architecture.md",
    )
    rel_jan = decision_builder._classify_relation(jan_chunk.heading, jan_chunk.text)
    assert rel_jan == "initial_choice", f"Expected 'initial_choice', but got '{rel_jan}'"


def test_timeline_builder_does_not_infer_relation_from_order_alone():
    # If a note made in October is an initial choice for a new sub-project, it should NOT become a revision just because it is later
    new_tech_chunk = ChunkRecord(
        id="oct_new_tech",
        document_id="doc_new",
        chunk_index=0,
        heading="## Initial Choice: Voice Dictation Tool",
        text="We decided to choose Whisper.cpp for offline transcription.",
        event_date="2026-10-31",
        source_path="sample_notes/2026-10-31_voice.md",
    )
    rel = decision_builder._classify_relation(new_tech_chunk.heading, new_tech_chunk.text)
    assert rel == "initial_choice"
