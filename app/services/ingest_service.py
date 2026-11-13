from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List
import uuid

from app.storage.database import db_manager
from app.storage.repositories import DocumentRepository, ChunkRepository
from app.retrieval.vector_store import vector_store
from app.retrieval.embeddings import embed_texts
from app.ingestion.scanner import FileScanner, compute_sha256
from app.ingestion.parsers import parse_document
from app.ingestion.normalize import normalize_text, extract_title
from app.ingestion.metadata import extract_frontmatter_date, format_iso_date
from app.ingestion.chunker import create_chunks_for_document
from app.schemas.document import DocumentRecord, DocumentStatus


class IngestService:
    def __init__(self):
        db_manager.initialize()
        self.doc_repo = DocumentRepository()
        self.chunk_repo = ChunkRepository()
        self.scanner = FileScanner(self.doc_repo)

    def ingest_folder(self, folder_path: str | Path) -> Dict[str, Any]:
        """Scan and index all new or modified documents in a directory."""
        new_files, modified_files, unchanged_files, removed_docs = self.scanner.scan_folder(folder_path)

        files_to_process = new_files + modified_files
        processed_count = 0
        total_chunks = 0
        errors: List[str] = []

        # Process removed documents
        for doc in removed_docs:
            self.chunk_repo.delete_by_document_id(doc.id)
            vector_store.delete_by_document_id(doc.id)
            self.doc_repo.delete(doc.id)

        # Process new and modified documents
        for file_path in files_to_process:
            try:
                chunks_created = self._ingest_single_file(file_path)
                total_chunks += chunks_created
                processed_count += 1
            except Exception as e:
                errors.append(f"{file_path.name}: {str(e)}")

        return {
            "processed_files": processed_count,
            "unchanged_files": len(unchanged_files),
            "removed_files": len(removed_docs),
            "total_chunks_indexed": total_chunks,
            "errors": errors,
        }

    def _ingest_single_file(self, file_path: Path) -> int:
        abs_path = str(file_path.resolve())
        content_hash = compute_sha256(file_path)
        mtime = datetime.fromtimestamp(file_path.stat().st_mtime)

        # Parse document
        pages = parse_document(file_path)
        if not pages:
            return 0

        # Extract title and document date from first page/text
        first_content = pages[0][1]
        title = extract_title(first_content, file_path.name)
        doc_date = extract_frontmatter_date(first_content) or format_iso_date(mtime)

        # Check if updating existing document or creating new
        existing_doc = self.doc_repo.get_by_path(abs_path)
        doc_id = existing_doc.id if existing_doc else str(uuid.uuid4())

        # If modifying, delete old chunks from SQLite and Chroma
        if existing_doc:
            self.chunk_repo.delete_by_document_id(doc_id)
            vector_store.delete_by_document_id(doc_id)

        doc_record = DocumentRecord(
            id=doc_id,
            path=abs_path,
            filename=file_path.name,
            content_hash=content_hash,
            file_type=file_path.suffix.lower(),
            title=title,
            document_date=doc_date,
            modified_at=mtime,
            ingested_at=datetime.now(),
            status=DocumentStatus.INDEXED,
        )
        self.doc_repo.upsert(doc_record)

        # Generate chunks
        chunks = create_chunks_for_document(
            document_id=doc_id,
            parsed_pages=pages,
            source_path=abs_path,
            title=title,
            document_date=doc_date,
        )

        if not chunks:
            return 0

        # Insert chunks to SQLite (and automatically into chunks_fts via triggers)
        self.chunk_repo.insert_batch(chunks)

        # Generate embeddings and upsert to ChromaDB
        texts = [c.text for c in chunks]
        embeddings = embed_texts(texts)
        vector_store.upsert_chunks(chunks, embeddings)

        return len(chunks)


ingest_service = IngestService()

