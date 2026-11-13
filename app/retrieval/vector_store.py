from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.config import settings
from app.schemas.chunk import ChunkRecord

COLLECTION_NAME = "whythen_chunks"


class VectorStore:
    def __init__(self, persist_dir: Optional[Path] = None):
        self._persist_dir = persist_dir
        self.init_client()

    @property
    def persist_dir(self) -> Path:
        return self._persist_dir if self._persist_dir is not None else settings.CHROMA_DIR

    def init_client(self) -> None:
        self.persist_dir.mkdir(parents=True, exist_ok=True)
        self.client = chromadb.PersistentClient(
            path=str(self.persist_dir),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

    def upsert_chunks(
        self, chunks: List[ChunkRecord], embeddings: List[List[float]]
    ) -> None:
        if not chunks:
            return

        ids = [c.id for c in chunks]
        documents = [c.text for c in chunks]
        metadatas = [
            {
                "chunk_id": c.id,
                "document_id": c.document_id,
                "chunk_index": c.chunk_index,
                "heading": c.heading or "",
                "event_date": c.event_date or "",
                "date_confidence": c.date_confidence,
                "source_path": c.source_path,
                "title": c.title or "",
            }
            for c in chunks
        ]

        self.collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )

    def delete_by_document_id(self, document_id: str) -> None:
        self.collection.delete(where={"document_id": document_id})

    def search(
        self,
        query_embedding: List[float],
        limit: int = 20,
        where_filter: Optional[Dict[str, Any]] = None,
    ) -> List[Tuple[str, float]]:
        """
        Search nearest neighbors using cosine similarity.
        Returns list of (chunk_id, similarity_score) where similarity_score is in [0, 1].
        """
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=limit,
            where=where_filter,
            include=["metadatas", "distances"],
        )

        output: List[Tuple[str, float]] = []
        if not results or not results["ids"] or not results["ids"][0]:
            return output

        ids = results["ids"][0]
        distances = results["distances"][0] if results.get("distances") else [0.0] * len(ids)

        for chunk_id, dist in zip(ids, distances):
            # ChromaDB cosine distance ranges from 0 (identical) to 2 (opposite).
            # Convert cosine distance to similarity in [0, 1]
            sim = max(0.0, min(1.0, 1.0 - dist))
            output.append((chunk_id, sim))

        return output


vector_store = VectorStore()

