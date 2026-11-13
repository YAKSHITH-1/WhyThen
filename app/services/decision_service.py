from typing import Optional, List
from app.schemas.decision import DecisionTimelineResponse
from app.storage.repositories import ChunkRepository
from app.retrieval.vector_store import vector_store
from app.retrieval.embeddings import embed_query
from app.decisions.timeline import decision_builder


class DecisionService:
    def __init__(self):
        self.chunk_repo = ChunkRepository()

    def get_decision_timeline(
        self,
        topic: str,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> DecisionTimelineResponse:
        # Retrieve candidate chunks related to the topic
        query_emb = embed_query(topic)
        dense_results = vector_store.search(query_embedding=query_emb, limit=15)
        fts_chunks = self.chunk_repo.search_fts(query=topic, limit=15)

        candidate_ids = set([cid for cid, _ in dense_results] + [c.id for c, _ in fts_chunks])

        chunks = []
        for cid in candidate_ids:
            chunk = self.chunk_repo.get_by_id(cid)
            if chunk:
                # Filter by date if requested
                if date_from and chunk.event_date and chunk.event_date < date_from:
                    continue
                if date_to and chunk.event_date and chunk.event_date > date_to:
                    continue
                chunks.append(chunk)

        return decision_builder.build_timeline(topic, chunks)


decision_service = DecisionService()

