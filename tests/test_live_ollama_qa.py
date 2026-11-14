import pytest
from app.services.search_service import search_service
from app.schemas.query import AskRequest


def test_live_ollama_qa_five_queries():
    queries = [
        "Why was BM25 hybrid search added to dense vector retrieval in March 2026?",
        "What memory benchmark observations were made regarding ChromaDB on April 15, 2026?",
        "What unfinished plans and pending decisions are scheduled for post-MVP?",
        "What were the limitations of the in-process Streamlit interface noted in February 2026?",
        "Why did the architecture team decide on 100% offline air-gapped operation without cloud authentication?",
    ]

    results = []
    for idx, question in enumerate(queries, 1):
        req = AskRequest(question=question)
        response = search_service.ask(req)

        print(f"\n========================================================")
        print(f"QUERY {idx}: {question}")
        print(f"COVERAGE: {response.coverage}")
        print(f"CITATIONS REFERENCED: {len(response.sources)}")
        for src in response.sources:
            print(f"   -> [{src.chunk_id}] {src.title} | {src.heading} ({src.event_date})")
        print(f"ANSWER:\n{response.answer}")
        print(f"========================================================\n")

        # Verify that response is grounded and citations are returned
        assert response.coverage in ("supported", "partial"), f"Query '{question}' yielded {response.coverage}"
        assert len(response.sources) > 0
        assert len(response.answer) > 30
        results.append((question, response.coverage, len(response.sources)))

    assert len(results) == 5


def test_live_ollama_unsupported_query_abstention():
    # Query with zero evidence in notes
    req = AskRequest(question="What quantum computing algorithms are used in WhyThen?")
    response = search_service.ask(req)

    print(f"\n========================================================")
    print(f"ABSTENTION TEST: {req.question}")
    print(f"COVERAGE: {response.coverage}")
    print(f"ANSWER: {response.answer}")
    print(f"========================================================\n")

    # Verify honest abstention when no evidence exists
    assert response.coverage == "no_evidence_found"
    assert "no supporting record" in response.answer.lower() or "no evidence" in response.answer.lower()
