from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class DocumentStatus(str, Enum):
    INDEXED = "indexed"
    MODIFIED = "modified"
    REMOVED = "removed"
    FAILED = "failed"


class DocumentRecord(BaseModel):
    id: str
    path: str
    filename: str
    content_hash: str
    file_type: str
    title: Optional[str] = None
    document_date: Optional[str] = None  # ISO format string or YYYY-MM-DD
    modified_at: datetime
    ingested_at: datetime = Field(default_factory=datetime.now)
    status: DocumentStatus = DocumentStatus.INDEXED

