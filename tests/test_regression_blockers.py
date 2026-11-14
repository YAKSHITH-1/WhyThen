from pathlib import Path
import tempfile
import pytest
from fastapi.testclient import TestClient
from app.api.main import app
from app.storage.database import db_manager
from app.storage.repositories import DocumentRepository, ChunkRepository, JobRepository
from app.services.reconciliation_service import reconciliation_service
from app.security import validate_safe_directory, sanitize_upload_filename, SecurityError

client = TestClient(app)


def test_b01_api_route_prefixes():
    """Verify all routes are accessible under the /api prefix."""
    # Health checks
    r_health_root = client.get("/health")
    assert r_health_root.status_code == 200
    assert r_health_root.json()["status"] in ["ok", "degraded"]

    r_health_api = client.get("/api/health")
    assert r_health_api.status_code == 200
    assert r_health_api.json()["database"] == "connected"

    # Dashboard summary
    r_dash = client.get("/api/dashboard/summary")
    assert r_dash.status_code == 200
    data = r_dash.json()
    assert "total_documents" in data
    assert "total_chunks" in data
    assert "active_llm_model" in data

    # Settings
    r_settings = client.get("/api/settings")
    assert r_settings.status_code == 200
    assert "chunk_size" in r_settings.json()

    # Documents listing
    r_docs = client.get("/api/ingest/documents")
    assert r_docs.status_code == 200
    assert "items" in r_docs.json()

    # Search
    r_search = client.post("/api/search", json={"text": "database"})
    assert r_search.status_code == 200
    assert isinstance(r_search.json(), list)

    # Decisions timeline
    r_dec = client.get("/api/decisions/timeline?topic=Database")
    assert r_dec.status_code == 200
    assert r_dec.json()["topic"] == "Database"


def test_b02_and_b03_async_ingest_and_upload():
    """Verify asynchronous job creation (202 Accepted) and upload endpoint."""
    notes_dir = str(Path("sample_notes").resolve())

    # Folder async ingest
    r_folder = client.post("/api/ingest/folder", json={"folder_path": notes_dir})
    assert r_folder.status_code == 202
    job_data = r_folder.json()
    assert "job_id" in job_data
    assert job_data["status"] == "pending"

    # Poll job status
    job_id = job_data["job_id"]
    r_job = client.get(f"/api/ingest/jobs/{job_id}")
    assert r_job.status_code == 200
    assert r_job.json()["id"] == job_id

    # Test multipart upload
    sample_content = b"# Test Upload Note\n\nDate: 2026-05-01\n\nTesting file upload."
    files = {"files": ("test_upload_note.md", sample_content, "text/markdown")}
    r_upload = client.post("/api/ingest/upload", files=files)
    assert r_upload.status_code == 202
    upload_job = r_upload.json()
    assert "job_id" in upload_job


def test_b04_security_and_sandboxing():
    """Verify filesystem sandboxing rejects system roots and traversal."""
    # Attempting to scan a non-existent or root path
    with pytest.raises(SecurityError):
        validate_safe_directory("C:/Windows/System32")

    with pytest.raises(SecurityError):
        validate_safe_directory("C:/")

    # Sanitize upload filename
    malicious_name = "../../malicious.exe"
    with pytest.raises(SecurityError):
        sanitize_upload_filename(malicious_name)

    safe_name = sanitize_upload_filename("my-project-notes.md")
    assert safe_name.endswith("my-project-notes.md")
    assert not safe_name.startswith("..")

    # Path traversal attempt via API
    r_bad_path = client.post("/api/ingest/folder", json={"folder_path": "C:/Windows"})
    assert r_bad_path.status_code == 400
    assert "Security violation" in r_bad_path.json()["detail"]


def test_b05_storage_atomicity_and_reconciliation():
    """Verify vector_synced column and startup reconciliation routine."""
    with db_manager.get_connection() as conn:
        cols = [r["name"] for r in conn.execute("PRAGMA table_info(chunks)").fetchall()]
        assert "vector_synced" in cols

    res = reconciliation_service.reconcile()
    assert "status" in res
    assert res["status"] in ["clean", "repaired"]


def test_b06_settings_persistence_and_validation():
    """Verify settings save, validation, and retrieval."""
    # Invalid overlap >= chunk_size
    r_invalid = client.post(
        "/api/settings",
        json={"chunk_size": 200, "chunk_overlap": 250},
    )
    assert r_invalid.status_code == 422 or r_invalid.status_code == 400

    # Valid settings update
    valid_payload = {
        "ollama_base_url": "http://localhost:11434",
        "llm_model": "llama3.2",
        "embedding_model": "all-MiniLM-L6-v2",
        "knowledge_base_dir": "sample_notes",
        "upload_dir": "data/uploads",
        "top_k": 5,
        "timezone": "UTC",
        "chunk_size": 500,
        "chunk_overlap": 80,
        "semantic_weight": 0.50,
        "keyword_weight": 0.30,
        "temporal_weight": 0.20,
        "relevance_threshold": 0.20,
    }
    r_valid = client.post("/api/settings", json=valid_payload)
    assert r_valid.status_code == 200
    assert r_valid.json()["status"] == "saved"


def test_b07_spa_fallback_and_api_isolation():
    """Verify invalid /api/* requests return 404 and are not swallowed by catch-all."""
    r_api_404 = client.get("/api/nonexistent_endpoint")
    assert r_api_404.status_code == 404
