from typing import List
from pydantic import BaseModel
from app.schemas.document import DocumentRecord


class DashboardSummaryResponse(BaseModel):
    total_documents: int
    total_chunks: int
    active_llm_model: str
    embedding_model: str
    storage_location: str
    storage_size_bytes: int
    recent_documents: List[DocumentRecord]
    ollama_status: str
