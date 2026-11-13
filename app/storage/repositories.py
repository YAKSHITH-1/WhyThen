from datetime import datetime
from typing import Optional, List, Tuple
from app.storage.database import DatabaseManager, db_manager
from app.schemas.document import DocumentRecord, DocumentStatus
from app.schemas.chunk import ChunkRecord, SourceCitation


class DocumentRepository:
    def __init__(self, manager: DatabaseManager = db_manager):
        self.manager = manager

    def get_by_path(self, path: str) -> Optional[DocumentRecord]:
        with self.manager.get_connection() as conn:
            cursor = conn.execute("SELECT * FROM documents WHERE path = ?", (path,))
            row = cursor.fetchone()
            if not row:
                return None
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

    def list_all(self) -> List[DocumentRecord]:
        with self.manager.get_connection() as conn:
            cursor = conn.execute("SELECT * FROM documents ORDER BY ingested_at DESC")
            rows = cursor.fetchall()
            return [
                DocumentRecord(
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
                for row in rows
            ]

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


class ChunkRepository:
    def __init__(self, manager: DatabaseManager = db_manager):
        self.manager = manager

    def insert_batch(self, chunks: List[ChunkRecord]) -> None:
        if not chunks:
            return
        with self.manager.get_connection() as conn:
            conn.executemany(
                """
                INSERT INTO chunks (
                    id, document_id, chunk_index, text, heading,
                    page_number, event_date, date_confidence, source_path, title
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    )
                    for c in chunks
                ],
            )

    def delete_by_document_id(self, document_id: str) -> None:
        with self.manager.get_connection() as conn:
            conn.execute("DELETE FROM chunks WHERE document_id = ?", (document_id,))

    def get_by_id(self, chunk_id: str) -> Optional[ChunkRecord]:
        with self.manager.get_connection() as conn:
            cursor = conn.execute("SELECT * FROM chunks WHERE id = ?", (chunk_id,))
            row = cursor.fetchone()
            if not row:
                return None
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

    def search_fts(
        self,
        query: str,
        limit: int = 20,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> List[Tuple[ChunkRecord, float]]:
        """Search full text using SQLite FTS5 with native BM25 scoring."""
        # Sanitize query for FTS5 (escape special syntax characters like quotes, colons)
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
                chunk = ChunkRecord(
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
                # SQLite bm25() returns negative values where lower (more negative) is better.
                # Invert it so higher is better for rank fusion.
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
        """Fetch chunks in chronological order of their event_date for decision reconstruction."""
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
            return [
                ChunkRecord(
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
                for row in rows
            ]

