from typing import Optional
from pydantic import BaseModel, Field


class ChunkRecord(BaseModel):
    id: str
    document_id: str
    chunk_index: int
    text: str
    heading: Optional[str] = None
    page_number: Optional[int] = None
    event_date: Optional[str] = None  # YYYY-MM-DD if explicitly detected
    date_confidence: str = "low"  # "high", "medium", "low"
    source_path: str = ""
    title: Optional[str] = None


class SourceCitation(BaseModel):
    chunk_id: str
    source_path: str
    title: Optional[str] = None
    heading: Optional[str] = None
    event_date: Optional[str] = None
    document_date: Optional[str] = None
    excerpt: str
    score: float = 0.0

