from datetime import datetime
from typing import Optional, List, Tuple, Set, Dict, Any
from app.storage.database import DatabaseManager, db_manager
from app.schemas.document import DocumentRecord, DocumentStatus
from app.schemas.chunk import ChunkRecord, SourceCitation


class DocumentRepository:
    def __init__(self, manager: DatabaseManager = db_manager):
        self.manager = manager

    def count(self) -> int:
        with self.manager.get_connection() as conn:
            cursor = conn.execute("SELECT COUNT(*) AS total FROM documents")
            row = cursor.fetchone()
            return row["total"] if row else 0

    def get_by_id(self, doc_id: str) -> Optional[DocumentRecord]:
        with self.manager.get_connection() as conn:
            cursor = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
            row = cursor.fetchone()
            if not row:
                return None
            return self._row_to_doc(row)

    def get_by_path(self, path: str) -> Optional[DocumentRecord]:
        with self.manager.get_connection() as conn:
            cursor = conn.execute("SELECT * FROM documents WHERE path = ?", (path,))
            row = cursor.fetchone()
            if not row:
                return None
            return self._row_to_doc(row)

    def get_by_content_hash(self, content_hash: str) -> Optional[DocumentRecord]:
        with self.manager.get_connection() as conn:
            cursor = conn.execute("SELECT * FROM documents WHERE content_hash = ?", (content_hash,))
            row = cursor.fetchone()
            if not row:
                return None
            return self._row_to_doc(row)

    def list_all(self, limit: int = 100, offset: int = 0) -> List[DocumentRecord]:
        with self.manager.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM documents ORDER BY ingested_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            )
            rows = cursor.fetchall()
            return [self._row_to_doc(r) for r in rows]

    def get_recent(self, limit: int = 5) -> List[DocumentRecord]:
        with self.manager.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM documents ORDER BY ingested_at DESC LIMIT ?", (limit,)
            )
            rows = cursor.fetchall()
            return [self._row_to_doc(r) for r in rows]

    def upsert(self, doc: DocumentRecord) -> None:
        with self.manager.get_connection() as conn:
            conn.execute(
                """
                INSERT INTO documents (
                    id, path, filename, content_hash, file_type, title,
                    document_date, modified_at, ingested_at, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(path) DO UPDATE SET
                    content_hash=excluded.content_hash,
                    title=excluded.title,
                    document_date=excluded.document_date,
                    modified_at=excluded.modified_at,
                    ingested_at=excluded.ingested_at,
                    status=excluded.status
                """,
                (
                    doc.id,
                    doc.path,
                    doc.filename,
                    doc.content_hash,
                    doc.file_type,
                    doc.title,
                    doc.document_date,
                    doc.modified_at.isoformat(),
                    doc.ingested_at.isoformat(),
                    doc.status.value,
                ),
            )

    def delete(self, doc_id: str) -> None:
        with self.manager.get_connection() as conn:
            conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))

    def _row_to_doc(self, row: Any) -> DocumentRecord:
        return DocumentRecord(
            id=row["id"],
            path=row["path"],
            filename=row["filename"],
            content_hash=row["content_hash"],
            file_type=row["file_type"],
            title=row["title"],
            document_date=row["document_date"],
            modified_at=datetime.fromisoformat(row["modified_at"]),
            ingested_at=datetime.fromisoformat(row["ingested_at"]),
            status=DocumentStatus(row["status"]),
        )


class ChunkRepository:
    def __init__(self, manager: DatabaseManager = db_manager):
        self.manager = manager

    def count(self) -> int:
        with self.manager.get_connection() as conn:
            cursor = conn.execute("SELECT COUNT(*) AS total FROM chunks")
            row = cursor.fetchone()
            return row["total"] if row else 0

    def insert_batch(self, chunks: List[ChunkRecord], vector_synced: bool = False) -> None:
        if not chunks:
            return
        with self.manager.get_connection() as conn:
            conn.executemany(
                """
                INSERT INTO chunks (
                    id, document_id, chunk_index, text, heading,
                    page_number, event_date, date_confidence, source_path, title, vector_synced
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        c.id,
                        c.document_id,
                        c.chunk_index,
                        c.text,
                        c.heading,
                        c.page_number,
                        c.event_date,
                        c.date_confidence,
                        c.source_path,
                        c.title,
                        1 if vector_synced else 0,
                    )
                    for c in chunks
                ],
            )

    def mark_vector_synced(self, chunk_ids: List[str]) -> None:
        if not chunk_ids:
            return
        with self.manager.get_connection() as conn:
            placeholders = ",".join("?" for _ in chunk_ids)
            conn.execute(
                f"UPDATE chunks SET vector_synced = 1 WHERE id IN ({placeholders})",
                chunk_ids,
            )

    def get_unsynced_chunks(self) -> List[ChunkRecord]:
        with self.manager.get_connection() as conn:
            cursor = conn.execute("SELECT * FROM chunks WHERE vector_synced = 0")
            rows = cursor.fetchall()
            return [self._row_to_chunk(r) for r in rows]

    def get_all_chunk_ids(self) -> Set[str]:
        with self.manager.get_connection() as conn:
            cursor = conn.execute("SELECT id FROM chunks")
            rows = cursor.fetchall()
            return {r["id"] for r in rows}

    def delete_by_document_id(self, document_id: str) -> None:
        with self.manager.get_connection() as conn:
            conn.execute("DELETE FROM chunks WHERE document_id = ?", (document_id,))

    def get_by_id(self, chunk_id: str) -> Optional[ChunkRecord]:
        with self.manager.get_connection() as conn:
            cursor = conn.execute("SELECT * FROM chunks WHERE id = ?", (chunk_id,))
            row = cursor.fetchone()
            if not row:
                return None
            return self._row_to_chunk(row)

    def search_fts(
        self,
        query: str,
        limit: int = 20,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> List[Tuple[ChunkRecord, float]]:
        cleaned_words = [
            "".join(c for c in word if c.isalnum() or c in ("-", "_"))
            for word in query.split()
        ]
        cleaned_query = " ".join(f'"{w}"' for w in cleaned_words if w)
        if not cleaned_query:
            return []

        sql = """
            SELECT c.*, bm25(chunks_fts) AS bm25_rank
            FROM chunks_fts f
            JOIN chunks c ON f.id = c.id
            WHERE chunks_fts MATCH ?
        """
        params: list = [cleaned_query]

        if date_from:
            sql += " AND (c.event_date >= ? OR c.event_date IS NULL)"
            params.append(date_from)
        if date_to:
            sql += " AND (c.event_date <= ? OR c.event_date IS NULL)"
            params.append(date_to)

        sql += " ORDER BY bm25_rank ASC LIMIT ?"
        params.append(limit)

        with self.manager.get_connection() as conn:
            cursor = conn.execute(sql, params)
            rows = cursor.fetchall()
            results = []
            for row in rows:
                chunk = self._row_to_chunk(row)
                score = -float(row["bm25_rank"])
                results.append((chunk, score))
            return results

    def list_chronological_chunks(
        self,
        query: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        limit: int = 50,
    ) -> List[ChunkRecord]:
        sql = "SELECT * FROM chunks WHERE 1=1"
        params: list = []

        if date_from:
            sql += " AND event_date >= ?"
            params.append(date_from)
        if date_to:
            sql += " AND event_date <= ?"
            params.append(date_to)

        sql += " ORDER BY event_date ASC NULLS LAST, chunk_index ASC LIMIT ?"
        params.append(limit)

        with self.manager.get_connection() as conn:
            cursor = conn.execute(sql, params)
            rows = cursor.fetchall()
            return [self._row_to_chunk(r) for r in rows]

    def _row_to_chunk(self, row: Any) -> ChunkRecord:
        return ChunkRecord(
            id=row["id"],
            document_id=row["document_id"],
            chunk_index=row["chunk_index"],
            text=row["text"],
            heading=row["heading"],
            page_number=row["page_number"],
            event_date=row["event_date"],
            date_confidence=row["date_confidence"],
            source_path=row["source_path"],
            title=row["title"],
        )


class JobRepository:
    def __init__(self, manager: DatabaseManager = db_manager):
        self.manager = manager

    def create_job(
        self,
        job_id: str,
        job_type: str = "folder",
        target_path: Optional[str] = None,
        total_files: int = 0,
    ) -> None:
        now_iso = datetime.now().isoformat()
        with self.manager.get_connection() as conn:
            conn.execute(
                """
                INSERT INTO ingestion_jobs (
                    id, job_type, target_path, started_at, status, files_processed, total_files, total_chunks
                ) VALUES (?, ?, ?, ?, 'pending', 0, ?, 0)
                """,
                (job_id, job_type, target_path, now_iso, total_files),
            )

    def update_progress(
        self,
        job_id: str,
        files_processed: int,
        total_chunks: int,
        status: str = "running",
    ) -> None:
        with self.manager.get_connection() as conn:
            conn.execute(
                """
                UPDATE ingestion_jobs
                SET files_processed = ?, total_chunks = ?, status = ?
                WHERE id = ?
                """,
                (files_processed, total_chunks, status, job_id),
            )

    def complete_job(self, job_id: str, files_processed: int, total_chunks: int) -> None:
        now_iso = datetime.now().isoformat()
        with self.manager.get_connection() as conn:
            conn.execute(
                """
                UPDATE ingestion_jobs
                SET files_processed = ?, total_chunks = ?, status = 'completed', finished_at = ?
                WHERE id = ?
                """,
                (files_processed, total_chunks, now_iso, job_id),
            )

    def fail_job(self, job_id: str, error_summary: str) -> None:
        now_iso = datetime.now().isoformat()
        with self.manager.get_connection() as conn:
            conn.execute(
                """
                UPDATE ingestion_jobs
                SET status = 'failed', finished_at = ?, error_summary = ?
                WHERE id = ?
                """,
                (now_iso, error_summary, job_id),
            )

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self.manager.get_connection() as conn:
            cursor = conn.execute("SELECT * FROM ingestion_jobs WHERE id = ?", (job_id,))
            row = cursor.fetchone()
            if not row:
                return None
            return {
                "id": row["id"],
                "job_type": row["job_type"],
                "target_path": row["target_path"],
                "started_at": row["started_at"],
                "finished_at": row["finished_at"],
                "status": row["status"],
                "files_processed": row["files_processed"],
                "total_files": row["total_files"],
                "total_chunks": row["total_chunks"],
                "error_summary": row["error_summary"],
            }
