import json
from pathlib import Path
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, field_validator
from app.config import settings
from app.storage.repositories import DocumentRepository, ChunkRepository
from app.retrieval.vector_store import vector_store

SETTINGS_FILE = Path("data/settings.json")


class SettingsPayload(BaseModel):
    ollama_base_url: str = Field(default="http://localhost:11434")
    llm_model: str = Field(default="llama3.2")
    embedding_model: str = Field(default="all-MiniLM-L6-v2")
    knowledge_base_dir: str = Field(default="sample_notes")
    upload_dir: str = Field(default="data/uploads")
    top_k: int = Field(default=5, ge=1, le=50)
    timezone: str = Field(default="UTC")
    chunk_size: int = Field(default=500, ge=100, le=2000)
    chunk_overlap: int = Field(default=80, ge=0, le=500)
    semantic_weight: float = Field(default=0.50, ge=0.0, le=1.0)
    keyword_weight: float = Field(default=0.30, ge=0.0, le=1.0)
    temporal_weight: float = Field(default=0.20, ge=0.0, le=1.0)
    relevance_threshold: float = Field(default=0.20, ge=0.0, le=1.0)

    @field_validator("chunk_overlap")
    @classmethod
    def validate_overlap(cls, v: int, info) -> int:
        chunk_size = info.data.get("chunk_size", 500)
        if v >= chunk_size:
            raise ValueError(f"chunk_overlap ({v}) must be strictly less than chunk_size ({chunk_size})")
        return v


class SettingsService:
    def __init__(self, file_path: Path = SETTINGS_FILE):
        self.file_path = file_path
        self.doc_repo = DocumentRepository()
        self.chunk_repo = ChunkRepository()

    def get_settings(self) -> SettingsPayload:
        if self.file_path.exists():
            try:
                data = json.loads(self.file_path.read_text(encoding="utf-8"))
                return SettingsPayload(**data)
            except Exception:
                pass

        # Defaults from config
        return SettingsPayload(
            ollama_base_url=settings.OLLAMA_BASE_URL,
            llm_model=settings.LLM_MODEL,
            embedding_model=settings.EMBEDDING_MODEL,
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
        )

    def save_settings(self, payload: SettingsPayload) -> Dict[str, Any]:
        old_settings = self.get_settings()
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        self.file_path.write_text(payload.model_dump_json(indent=2), encoding="utf-8")

        # Update in-memory config object
        settings.OLLAMA_BASE_URL = payload.ollama_base_url
        settings.LLM_MODEL = payload.llm_model
        settings.EMBEDDING_MODEL = payload.embedding_model
        settings.CHUNK_SIZE = payload.chunk_size
        settings.CHUNK_OVERLAP = payload.chunk_overlap

        reindex_required = False
        reindex_reason = None

        if self.doc_repo.count() > 0:
            if old_settings.embedding_model != payload.embedding_model:
                reindex_required = True
                reindex_reason = f"Embedding model changed from '{old_settings.embedding_model}' to '{payload.embedding_model}'."
            elif (
                old_settings.chunk_size != payload.chunk_size
                or old_settings.chunk_overlap != payload.chunk_overlap
            ):
                reindex_required = True
                reindex_reason = f"Chunking boundaries changed (size: {payload.chunk_size}, overlap: {payload.chunk_overlap})."

        return {
            "status": "saved",
            "reindex_required": reindex_required,
            "reindex_reason": reindex_reason,
            "settings": payload.model_dump(),
        }

    def reindex_all(self) -> Dict[str, Any]:
        """Full re-indexing of all registered documents using current settings."""
        from app.services.ingest_service import ingest_service
        docs = self.doc_repo.list_all(limit=1000)

        # 1. Reset ChromaDB collection
        vector_store.client.delete_collection("whythen_chunks")
        vector_store.init_client()

        reindexed_count = 0
        total_chunks = 0
        errors = []

        for doc in docs:
            file_path = Path(doc.path)
            if file_path.exists():
                try:
                    chunks = ingest_service._ingest_single_file(file_path)
                    total_chunks += chunks
                    reindexed_count += 1
                except Exception as e:
                    errors.append(f"{doc.filename}: {e}")
            else:
                errors.append(f"{doc.filename}: Source file missing on disk")

        return {
            "reindexed_documents": reindexed_count,
            "total_chunks": total_chunks,
            "errors": errors,
        }


settings_service = SettingsService()
