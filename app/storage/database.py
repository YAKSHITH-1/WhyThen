import sqlite3
from pathlib import Path
from contextlib import contextmanager
from typing import Generator
from app.config import settings


SCHEMA_SQL = """
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,
    filename TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    file_type TEXT NOT NULL,
    title TEXT,
    document_date TEXT,
    modified_at TEXT NOT NULL,
    ingested_at TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    heading TEXT,
    page_number INTEGER,
    event_date TEXT,
    date_confidence TEXT,
    source_path TEXT NOT NULL,
    title TEXT,
    vector_synced INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_event_date ON chunks(event_date);
CREATE INDEX IF NOT EXISTS idx_documents_path ON documents(path);
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);

-- Full-Text Search (FTS5) table with BM25 support
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5 (
    id UNINDEXED,
    text,
    heading,
    title,
    source_path,
    tokenize = 'porter unicode61'
);

-- Triggers to keep FTS5 synchronized with chunks table
CREATE TRIGGER IF NOT EXISTS trg_chunks_insert AFTER INSERT ON chunks
BEGIN
    INSERT INTO chunks_fts(id, text, heading, title, source_path)
    VALUES (new.id, new.text, coalesce(new.heading, ''), coalesce(new.title, ''), new.source_path);
END;

CREATE TRIGGER IF NOT EXISTS trg_chunks_delete AFTER DELETE ON chunks
BEGIN
    DELETE FROM chunks_fts WHERE id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_chunks_update AFTER UPDATE ON chunks
BEGIN
    DELETE FROM chunks_fts WHERE id = old.id;
    INSERT INTO chunks_fts(id, text, heading, title, source_path)
    VALUES (new.id, new.text, coalesce(new.heading, ''), coalesce(new.title, ''), new.source_path);
END;

CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL DEFAULT 'folder',
    target_path TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL,
    files_processed INTEGER DEFAULT 0,
    total_files INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 0,
    error_summary TEXT
);
"""


class DatabaseManager:
    def __init__(self, db_path: Path | str | None = None):
        self._db_path = Path(db_path) if db_path else None

    @property
    def db_path(self) -> Path:
        return self._db_path if self._db_path is not None else settings.SQLITE_PATH

    def initialize(self) -> None:
        """Create tables, triggers, and indices if they do not exist, and apply column migrations."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self.get_connection() as conn:
            conn.executescript(SCHEMA_SQL)
            self._apply_migrations(conn)

    def _apply_migrations(self, conn: sqlite3.Connection) -> None:
        """Safely ensure new columns exist in existing databases without loss of data."""
        # 1. Check chunks.vector_synced
        chunk_cols = [row["name"] for row in conn.execute("PRAGMA table_info(chunks)").fetchall()]
        if "vector_synced" not in chunk_cols:
            conn.execute("ALTER TABLE chunks ADD COLUMN vector_synced INTEGER DEFAULT 0")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_chunks_vector_synced ON chunks(vector_synced)")

        # 2. Check ingestion_jobs columns
        job_cols = [row["name"] for row in conn.execute("PRAGMA table_info(ingestion_jobs)").fetchall()]
        if "job_type" not in job_cols:
            conn.execute("ALTER TABLE ingestion_jobs ADD COLUMN job_type TEXT NOT NULL DEFAULT 'folder'")
        if "target_path" not in job_cols:
            conn.execute("ALTER TABLE ingestion_jobs ADD COLUMN target_path TEXT")
        if "total_files" not in job_cols:
            conn.execute("ALTER TABLE ingestion_jobs ADD COLUMN total_files INTEGER DEFAULT 0")
        if "total_chunks" not in job_cols:
            conn.execute("ALTER TABLE ingestion_jobs ADD COLUMN total_chunks INTEGER DEFAULT 0")

    @contextmanager
    def get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        conn = sqlite3.connect(str(self.db_path), timeout=5.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA busy_timeout = 5000;")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


db_manager = DatabaseManager()
