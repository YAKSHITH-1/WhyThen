import pytest
from pathlib import Path
import tempfile
import shutil
from app.config import settings
from app.storage.database import DatabaseManager
from app.retrieval.vector_store import VectorStore


@pytest.fixture
def temp_env(tmp_path):
    """Set up temporary database and chroma directories for isolated testing."""
    test_db_path = tmp_path / "test_whythen.db"
    test_chroma_path = tmp_path / "test_chroma"

    old_db = settings.SQLITE_PATH
    old_chroma = settings.CHROMA_DIR

    settings.SQLITE_PATH = test_db_path
    settings.CHROMA_DIR = test_chroma_path

    from app.storage.database import db_manager
    from app.retrieval.vector_store import vector_store

    db_manager.initialize()
    vector_store.init_client()

    yield {
        "tmp_path": tmp_path,
        "db_mgr": db_manager,
        "v_store": vector_store,
    }

    settings.SQLITE_PATH = old_db
    settings.CHROMA_DIR = old_chroma
    vector_store.init_client()

