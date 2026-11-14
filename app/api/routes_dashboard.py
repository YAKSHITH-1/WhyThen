import os
from pathlib import Path
from fastapi import APIRouter
import httpx
from app.config import settings
from app.storage.repositories import DocumentRepository, ChunkRepository
from app.schemas.dashboard import DashboardSummaryResponse

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def get_dir_size(path: Path) -> int:
    total = 0
    if not path.exists():
        return 0
    if path.is_file():
        return path.stat().st_size
    for entry in path.rglob("*"):
        if entry.is_file():
            total += entry.stat().st_size
    return total


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary():
    doc_repo = DocumentRepository()
    chunk_repo = ChunkRepository()

    total_docs = doc_repo.count()
    total_chunks = chunk_repo.count()
    recent = doc_repo.get_recent(limit=5)

    # Compute total storage size (SQLite DB + Chroma dir + upload dir)
    db_size = get_dir_size(settings.SQLITE_PATH)
    chroma_size = get_dir_size(settings.CHROMA_DIR)
    upload_size = get_dir_size(Path("data/uploads"))
    total_storage = db_size + chroma_size + upload_size

    # Check Ollama status
    ollama_status = "unreachable"
    try:
        with httpx.Client(timeout=1.5) as client:
            res = client.get(f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/tags")
            if res.status_code == 200:
                ollama_status = "connected"
    except Exception:
        pass

    return DashboardSummaryResponse(
        total_documents=total_docs,
        total_chunks=total_chunks,
        active_llm_model=settings.LLM_MODEL,
        embedding_model=settings.EMBEDDING_MODEL,
        storage_location=str(settings.DATA_DIR.resolve()),
        storage_size_bytes=total_storage,
        recent_documents=recent,
        ollama_status=ollama_status,
    )
