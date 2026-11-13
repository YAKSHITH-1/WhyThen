from typing import List, Dict, Optional
from app.schemas.chunk import SourceCitation, ChunkRecord
from app.schemas.query import SearchQuery, AskRequest, AskResponse
from app.storage.repositories import ChunkRepository
from app.retrieval.vector_store import vector_store
from app.retrieval.embeddings import embed_query
from app.retrieval.fusion import reciprocal_rank_fusion
from app.retrieval.reranker import TemporalReranker
from app.generation.answerer import answer_generator


class SearchService:
    def __init__(self):
        self.chunk_repo = ChunkRepository()
        self.reranker = TemporalReranker()

    def search(self, query: SearchQuery) -> List[SourceCitation]:
        # 1. Dense retrieval
        query_emb = embed_query(query.text)
        dense_results = vector_store.search(
            query_embedding=query_emb,
            limit=query.limit * 2,
        )
        dense_scores_map = dict(dense_results)

        # 2. Sparse lexical retrieval (SQLite FTS5 BM25)
        sparse_chunks = self.chunk_repo.search_fts(
            query=query.text,
            limit=query.limit * 2,
            date_from=query.date_from,
            date_to=query.date_to,
        )
        sparse_results = [(c.id, score) for c, score in sparse_chunks]
        sparse_scores_map = dict(sparse_results)

        # 3. Reciprocal Rank Fusion (RRF)
        fused_candidates = reciprocal_rank_fusion(dense_results, sparse_results)
        candidate_ids = [cid for cid, _ in fused_candidates[: query.limit * 2]]

        # 4. Fetch full chunk objects & apply hard temporal filter if explicit date bounds requested
        chunks_map: Dict[str, ChunkRecord] = {}
        for cid in candidate_ids:
            chunk = self.chunk_repo.get_by_id(cid)
            if chunk:
                # Filter out chunks whose event date violates explicit date bounds
                if query.date_from and chunk.event_date and chunk.event_date < query.date_from:
                    continue
                if query.date_to and chunk.event_date and chunk.event_date > query.date_to:
                    continue
                chunks_map[cid] = chunk

        # 5. Temporal reranking
        ranked_citations = self.reranker.rerank(
            chunks=chunks_map,
            dense_scores=dense_scores_map,
            sparse_scores=sparse_scores_map,
            date_from=query.date_from,
            date_to=query.date_to,
            limit=query.limit,
        )

        return ranked_citations

    def ask(self, request: AskRequest) -> AskResponse:
        search_query = SearchQuery(
            text=request.question,
            date_from=request.date_from,
            date_to=request.date_to,
            project=request.project,
            limit=5,
        )
        citations = self.search(search_query)
        return answer_generator.generate_answer(request.question, citations)


search_service = SearchService()

