import logging
from typing import Dict, Any
from app.storage.repositories import ChunkRepository
from app.retrieval.vector_store import vector_store
from app.retrieval.embeddings import embed_texts

logger = logging.getLogger(__name__)


class ReconciliationService:
    def __init__(self):
        self.chunk_repo = ChunkRepository()

    def reconcile(self) -> Dict[str, Any]:
        """
        Audit SQLite as the authoritative source of truth against ChromaDB.
        1. Backfill any SQLite chunks where vector_synced = 0.
        2. Delete orphaned vectors in ChromaDB that no longer exist in SQLite.
        """
        reconciled_count = 0
        purged_count = 0

        try:
            # 1. Backfill unsynced chunks
            unsynced = self.chunk_repo.get_unsynced_chunks()
            if unsynced:
                logger.info(f"Reconciling {len(unsynced)} unsynced chunks into ChromaDB...")
                texts = [c.text for c in unsynced]
                embeddings = embed_texts(texts)
                vector_store.upsert_chunks(unsynced, embeddings)
                self.chunk_repo.mark_vector_synced([c.id for c in unsynced])
                reconciled_count = len(unsynced)

            # 2. Check for orphaned vectors in ChromaDB
            all_sqlite_ids = self.chunk_repo.get_all_chunk_ids()
            # Fetch IDs currently in ChromaDB collection
            chroma_data = vector_store.collection.get(include=[])
            chroma_ids = set(chroma_data.get("ids", []))

            orphans = list(chroma_ids - all_sqlite_ids)
            if orphans:
                logger.info(f"Purging {len(orphans)} orphaned vectors from ChromaDB...")
                vector_store.collection.delete(ids=orphans)
                purged_count = len(orphans)

            status = "repaired" if (reconciled_count > 0 or purged_count > 0) else "clean"
            return {
                "status": status,
                "reconciled_chunks": reconciled_count,
                "purged_orphans": purged_count,
            }
        except Exception as e:
            logger.error(f"Reconciliation error: {e}")
            return {
                "status": "error",
                "error": str(e),
                "reconciled_chunks": reconciled_count,
                "purged_orphans": purged_count,
            }


reconciliation_service = ReconciliationService()
