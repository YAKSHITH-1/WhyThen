import hashlib
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Tuple
from app.config import settings
from app.schemas.document import DocumentRecord, DocumentStatus
from app.storage.repositories import DocumentRepository


def compute_sha256(file_path: Path) -> str:
    hasher = hashlib.sha256()
    with file_path.open("rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


class FileScanner:
    def __init__(self, doc_repo: DocumentRepository):
        self.doc_repo = doc_repo

    def scan_folder(
        self, folder_path: Path | str
    ) -> Tuple[List[Path], List[Path], List[Path], List[DocumentRecord]]:
        """
        Scan directory for supported documents.
        Returns:
            new_files: Files not yet in the index
            modified_files: Files whose hash or mtime changed
            unchanged_files: Files already indexed and unchanged
            removed_docs: Indexed documents that no longer exist on disk
        """
        folder = Path(folder_path).resolve()
        if not folder.exists() or not folder.is_dir():
            raise FileNotFoundError(f"Folder not found: {folder}")

        existing_docs = {d.path: d for d in self.doc_repo.list_all()}
        found_paths = set()

        new_files: List[Path] = []
        modified_files: List[Path] = []
        unchanged_files: List[Path] = []

        uploads_dir = Path("data/uploads").resolve()

        for ext in settings.SUPPORTED_EXTENSIONS:
            for file_path in folder.rglob(f"*{ext}"):
                if not file_path.is_file():
                    continue

                # Exclude internal managed uploads directory to prevent duplicate indexing
                if uploads_dir.exists() and uploads_dir in file_path.resolve().parents:
                    continue

                abs_path_str = str(file_path.resolve())
                found_paths.add(abs_path_str)

                current_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)

                if abs_path_str not in existing_docs:
                    new_files.append(file_path)
                else:
                    existing_doc = existing_docs[abs_path_str]
                    current_hash = compute_sha256(file_path)
                    if existing_doc.content_hash != current_hash:
                        modified_files.append(file_path)
                    else:
                        unchanged_files.append(file_path)

        # Detect removed documents that were previously in this folder
        folder_str = str(folder)
        removed_docs: List[DocumentRecord] = [
            doc
            for path, doc in existing_docs.items()
            if path.startswith(folder_str) and path not in found_paths
        ]

        return new_files, modified_files, unchanged_files, removed_docs

