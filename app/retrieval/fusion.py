from typing import List, Dict, Tuple
from app.schemas.chunk import ChunkRecord


def reciprocal_rank_fusion(
    dense_results: List[Tuple[str, float]],
    sparse_results: List[Tuple[str, float]],
    k: int = 60,
) -> List[Tuple[str, float]]:
    """
    Combine dense vector results and sparse lexical results via RRF.
    Each list is [(chunk_id, score), ...].
    Returns ranked [(chunk_id, rrf_score), ...].
    """
    scores: Dict[str, float] = {}

    for rank, (chunk_id, _) in enumerate(dense_results):
        scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (k + rank + 1)

    for rank, (chunk_id, _) in enumerate(sparse_results):
        scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (k + rank + 1)

    sorted_results = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    return sorted_results

