from pathlib import Path
from app.services.ingest_service import IngestService
from app.services.search_service import SearchService
from app.services.decision_service import DecisionService
from app.schemas.query import SearchQuery, AskRequest


def test_end_to_end_search_and_qa(temp_env):
    ingest_svc = IngestService()
    search_svc = SearchService()
    decision_svc = DecisionService()

    notes_dir = Path("sample_notes").resolve()
    assert notes_dir.exists()

    # Ingest sample notes
    res = ingest_svc.ingest_folder(notes_dir)
    assert res["processed_files"] >= 2
    assert res["total_chunks_indexed"] >= 2

    # Test 1: Exact keyword + semantic search for ChromaDB
    query = SearchQuery(text="Why did we choose ChromaDB instead of FAISS?")
    search_results = search_svc.search(query)
    assert len(search_results) > 0
    top_hit = search_results[0]
    assert "ChromaDB" in top_hit.excerpt

    # Test 2: Temporal Filtering (requesting only March 2026 notes)
    query_march = SearchQuery(
        text="database choice",
        date_from="2026-03-01",
        date_to="2026-03-31",
    )
    march_results = search_svc.search(query_march)
    assert len(march_results) > 0
    for r in march_results:
        if r.event_date:
            assert "2026-03" in r.event_date

    # Test 3: Grounded Q&A with Answer Generator
    ask_req = AskRequest(question="Why did I choose ChromaDB instead of FAISS?")
    ask_resp = search_svc.ask(ask_req)
    assert ask_resp.coverage in ["supported", "partial"]
    assert len(ask_resp.sources) > 0

    # Test 4: Strict Abstention when evidence is not in notes
    ask_unrelated = AskRequest(question="What is the secret recipe for chocolate cake?")
    unrelated_resp = search_svc.ask(ask_unrelated)
    assert unrelated_resp.coverage == "no_evidence_found"
    assert "no supporting record" in unrelated_resp.answer.lower()

    # Test 5: Reconstruct Chronological Decision Timeline
    timeline_resp = decision_svc.get_decision_timeline("Database")
    assert timeline_resp.topic == "Database"
    assert len(timeline_resp.timeline) >= 1

