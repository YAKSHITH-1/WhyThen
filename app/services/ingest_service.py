import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
import uuid
import logging

from app.storage.database import db_manager
from app.storage.repositories import DocumentRepository, ChunkRepository, JobRepository
from app.retrieval.vector_store import vector_store
from app.retrieval.embeddings import embed_texts
from app.ingestion.scanner import FileScanner, compute_sha256
from app.ingestion.parsers import parse_document
from app.ingestion.normalize import normalize_text, extract_title
from app.ingestion.metadata import extract_frontmatter_date, format_iso_date
from app.ingestion.chunker import create_chunks_for_document
from app.schemas.document import DocumentRecord, DocumentStatus

logger = logging.getLogger(__name__)


class IngestService:
    def __init__(self):
        db_manager.initialize()
        self.doc_repo = DocumentRepository()
        self.chunk_repo = ChunkRepository()
        self.job_repo = JobRepository()
        self.scanner = FileScanner(self.doc_repo)

    def ingest_folder(self, folder_path: str | Path) -> Dict[str, Any]:
        """Synchronous scan and index (useful for CLI/tests)."""
        new_files, modified_files, unchanged_files, removed_docs = self.scanner.scan_folder(folder_path)

        files_to_process = new_files + modified_files
        processed_count = 0
        total_chunks = 0
        errors: List[str] = []

        # Process removed documents
        for doc in removed_docs:
            self.delete_document(doc.id)

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

    def ingest_folder_async(self, job_id: str, folder_path: str | Path) -> None:
        """Asynchronous folder ingestion background worker."""
        try:
            new_files, modified_files, unchanged_files, removed_docs = self.scanner.scan_folder(folder_path)
            files_to_process = new_files + modified_files
            total_files = len(files_to_process) + len(removed_docs)
            self.job_repo.update_progress(job_id, files_processed=0, total_chunks=0, status="running")

            # Process removed documents
            for doc in removed_docs:
                self.delete_document(doc.id)

            processed_count = 0
            total_chunks = 0
            errors: List[str] = []

            for file_path in files_to_process:
                try:
                    chunks_created = self._ingest_single_file(file_path)
                    total_chunks += chunks_created
                    processed_count += 1
                    self.job_repo.update_progress(job_id, files_processed=processed_count, total_chunks=total_chunks)
                except Exception as e:
                    errors.append(f"{file_path.name}: {str(e)}")

            if errors:
                error_summary = "; ".join(errors)
                self.job_repo.fail_job(job_id, error_summary=error_summary)
            else:
                self.job_repo.complete_job(job_id, files_processed=processed_count, total_chunks=total_chunks)
        except Exception as e:
            logger.error(f"Ingest folder background job {job_id} failed: {e}")
            self.job_repo.fail_job(job_id, error_summary=str(e))

    def ingest_uploaded_files(self, job_id: str, file_paths: List[Path]) -> None:
        """Asynchronous uploaded files ingestion background worker."""
        try:
            self.job_repo.update_progress(job_id, files_processed=0, total_chunks=0, status="running")
            processed_count = 0
            total_chunks = 0
            errors: List[str] = []

            for file_path in file_paths:
                try:
                    chunks_created = self._ingest_single_file(file_path)
                    total_chunks += chunks_created
                    processed_count += 1
                    self.job_repo.update_progress(job_id, files_processed=processed_count, total_chunks=total_chunks)
                except Exception as e:
                    errors.append(f"{file_path.name}: {str(e)}")

            if errors:
                error_summary = "; ".join(errors)
                self.job_repo.fail_job(job_id, error_summary=error_summary)
            else:
                self.job_repo.complete_job(job_id, files_processed=processed_count, total_chunks=total_chunks)
        except Exception as e:
            logger.error(f"Ingest upload background job {job_id} failed: {e}")
            self.job_repo.fail_job(job_id, error_summary=str(e))

    def delete_document(self, doc_id: str) -> bool:
        """Cascading deletion of a document across SQLite, ChromaDB, and managed uploads folder."""
        doc = self.doc_repo.get_by_id(doc_id)
        if not doc:
            return False

        # 1. Delete chunks from SQLite and ChromaDB
        self.chunk_repo.delete_by_document_id(doc_id)
        vector_store.delete_by_document_id(doc_id)

        # 2. If physical file is in managed uploads directory, delete it
        uploads_dir = Path("data/uploads").resolve()
        file_path = Path(doc.path).resolve()
        if uploads_dir.exists() and uploads_dir in file_path.parents and file_path.exists():
            try:
                os.remove(file_path)
            except Exception as e:
                logger.warning(f"Failed to remove uploaded physical file {file_path}: {e}")

        # 3. Delete document record from SQLite
        self.doc_repo.delete(doc_id)
        return True

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

        # Insert chunks to SQLite with vector_synced = 0 initially
        self.chunk_repo.insert_batch(chunks, vector_synced=False)

        # Generate embeddings and upsert to ChromaDB
        texts = [c.text for c in chunks]
        embeddings = embed_texts(texts)
        vector_store.upsert_chunks(chunks, embeddings)

        # Upon successful ChromaDB upsert, mark vector_synced = 1
        self.chunk_repo.mark_vector_synced([c.id for c in chunks])

        return len(chunks)


ingest_service = IngestService()
