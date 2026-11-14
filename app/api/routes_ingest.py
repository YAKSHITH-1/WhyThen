import uuid
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Query, status
from pydantic import BaseModel

from app.services.ingest_service import ingest_service
from app.storage.repositories import DocumentRepository, JobRepository
from app.security import validate_safe_directory, sanitize_upload_filename, validate_file_size, SecurityError

router = APIRouter(prefix="/ingest", tags=["Ingestion"])


class IngestFolderRequest(BaseModel):
    folder_path: str


class IngestJobResponse(BaseModel):
    job_id: str
    status: str
    message: str


@router.post("/folder", response_model=IngestJobResponse, status_code=status.HTTP_202_ACCEPTED)
def ingest_folder(req: IngestFolderRequest, background_tasks: BackgroundTasks):
    try:
        # Validate safe directory and sandboxing
        safe_path = validate_safe_directory(req.folder_path)
    except SecurityError as e:
        raise HTTPException(status_code=400, detail=f"Security violation: {e}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    job_id = str(uuid.uuid4())
    job_repo = JobRepository()
    job_repo.create_job(job_id=job_id, job_type="folder", target_path=str(safe_path))

    # Dispatch to background tasks pool (runs off event loop in threadpool)
    background_tasks.add_task(ingest_service.ingest_folder_async, job_id, safe_path)

    return IngestJobResponse(
        job_id=job_id,
        status="pending",
        message="Folder ingestion dispatched to background worker.",
    )


@router.post("/upload", response_model=IngestJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_files(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided for upload.")

    uploads_dir = Path("data/uploads").resolve()
    uploads_dir.mkdir(parents=True, exist_ok=True)

    saved_paths: List[Path] = []
    try:
        for f in files:
            sanitized_name = sanitize_upload_filename(f.filename or "upload.txt")
            dest_path = uploads_dir / sanitized_name

            # Read content with size check
            content = await f.read()
            validate_file_size(len(content))

            dest_path.write_bytes(content)
            saved_paths.append(dest_path)
    except SecurityError as e:
        # Clean up already saved files in this batch on error
        for p in saved_paths:
            if p.exists():
                p.unlink()
        raise HTTPException(status_code=400, detail=f"Security violation: {e}")
    except Exception as e:
        for p in saved_paths:
            if p.exists():
                p.unlink()
        raise HTTPException(status_code=400, detail=f"Upload failed: {e}")

    job_id = str(uuid.uuid4())
    job_repo = JobRepository()
    job_repo.create_job(job_id=job_id, job_type="upload", target_path=str(uploads_dir), total_files=len(saved_paths))

    background_tasks.add_task(ingest_service.ingest_uploaded_files, job_id, saved_paths)

    return IngestJobResponse(
        job_id=job_id,
        status="pending",
        message=f"{len(saved_paths)} file(s) uploaded and queued for indexing.",
    )


@router.get("/jobs/{job_id}")
def get_job_status(job_id: str):
    job_repo = JobRepository()
    job = job_repo.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return job


@router.get("/documents")
def list_documents(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    repo = DocumentRepository()
    total = repo.count()
    items = repo.list_all(limit=limit, offset=offset)
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    success = ingest_service.delete_document(doc_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Document '{doc_id}' not found.")
    return {"deleted": True, "id": doc_id}
