from datetime import datetime
from app.schemas.document import DocumentRecord, DocumentStatus
from app.schemas.chunk import ChunkRecord
from app.storage.repositories import DocumentRepository, ChunkRepository


def test_document_and_chunk_crud(temp_env):
    db_mgr = temp_env["db_mgr"]
    doc_repo = DocumentRepository(db_mgr)
    chunk_repo = ChunkRepository(db_mgr)

    doc = DocumentRecord(
        id="doc_1",
        path="/notes/test.md",
        filename="test.md",
        content_hash="hash_123",
        file_type=".md",
        title="Test Document",
        document_date="2026-03-01",
        modified_at=datetime.now(),
        ingested_at=datetime.now(),
        status=DocumentStatus.INDEXED,
    )
    doc_repo.upsert(doc)

    retrieved_doc = doc_repo.get_by_path("/notes/test.md")
    assert retrieved_doc is not None
    assert retrieved_doc.id == "doc_1"
    assert retrieved_doc.title == "Test Document"

    chunks = [
        ChunkRecord(
            id="doc_1_c0",
            document_id="doc_1",
            chunk_index=0,
            text="We selected ChromaDB for metadata persistence.",
            heading="Database",
            event_date="2026-03-01",
            date_confidence="high",
            source_path="/notes/test.md",
            title="Test Document",
        )
    ]
    chunk_repo.insert_batch(chunks)

    # Verify FTS5 search works with BM25
    fts_results = chunk_repo.search_fts("ChromaDB persistence")
    assert len(fts_results) == 1
    found_chunk, score = fts_results[0]
    assert found_chunk.id == "doc_1_c0"
    assert "ChromaDB" in found_chunk.text

