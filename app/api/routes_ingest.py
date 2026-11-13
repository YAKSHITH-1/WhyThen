from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.ingest_service import ingest_service
from app.storage.repositories import DocumentRepository

router = APIRouter(prefix="/ingest", tags=["Ingestion"])


class IngestFolderRequest(BaseModel):
    folder_path: str


@router.post("/folder")
def ingest_folder(req: IngestFolderRequest):
    try:
        result = ingest_service.ingest_folder(req.folder_path)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/documents")
def list_documents():
    repo = DocumentRepository()
    return repo.list_all()

