from typing import List, Dict, Optional, Tuple
from app.schemas.chunk import ChunkRecord, SourceCitation


class TemporalReranker:
    def __init__(
        self,
        semantic_weight: float = 0.50,
        keyword_weight: float = 0.25,
        temporal_weight: float = 0.15,
        source_quality_weight: float = 0.10,
    ):
        self.semantic_weight = semantic_weight
        self.keyword_weight = keyword_weight
        self.temporal_weight = temporal_weight
        self.source_quality_weight = source_quality_weight

    def calculate_temporal_fit(
        self,
        event_date: Optional[str],
        date_from: Optional[str],
        date_to: Optional[str],
        confidence: str,
    ) -> float:
        if not date_from and not date_to:
            return 0.5  # Neutral when no date range specified

        if not event_date:
            return 0.2  # Penalty for undated content when temporal query requested

        # Check if event_date falls inside requested range
        in_range = True
        if date_from and event_date < date_from:
            in_range = False
        if date_to and event_date > date_to:
            in_range = False

        if in_range:
            conf_multiplier = 1.0 if confidence == "high" else (0.8 if confidence == "medium" else 0.6)
            return 1.0 * conf_multiplier
        else:
            return 0.0

    def rerank(
        self,
        chunks: Dict[str, ChunkRecord],
        dense_scores: Dict[str, float],
        sparse_scores: Dict[str, float],
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        limit: int = 10,
    ) -> List[SourceCitation]:
        # Normalize sparse scores to [0, 1]
        max_sparse = max(sparse_scores.values()) if sparse_scores else 1.0
        min_sparse = min(sparse_scores.values()) if sparse_scores else 0.0
        sparse_range = max_sparse - min_sparse if max_sparse > min_sparse else 1.0

        ranked_citations: List[SourceCitation] = []

        for chunk_id, chunk in chunks.items():
            if date_from and chunk.event_date and chunk.event_date < date_from:
                continue
            if date_to and chunk.event_date and chunk.event_date > date_to:
                continue

            sem_score = dense_scores.get(chunk_id, 0.0)
            raw_sparse = sparse_scores.get(chunk_id, 0.0)
            norm_sparse = (raw_sparse - min_sparse) / sparse_range if chunk_id in sparse_scores else 0.0

            # Guard: Never allow temporal or source quality to elevate semantically/lexically irrelevant chunks
            base_relevance = 0.65 * sem_score + 0.35 * norm_sparse
            if base_relevance < 0.20 and (sem_score < 0.25 and norm_sparse < 0.10):
                continue

            temporal_fit = self.calculate_temporal_fit(
                chunk.event_date, date_from, date_to, chunk.date_confidence
            )

            # Source quality metric (length check, structured heading presence)
            quality = 0.5
            if chunk.heading:
                quality += 0.3
            if len(chunk.text.split()) >= 30:
                quality += 0.2

            final_score = (
                self.semantic_weight * sem_score
                + self.keyword_weight * norm_sparse
                + self.temporal_weight * temporal_fit
                + self.source_quality_weight * quality
            )

            excerpt = chunk.text
            if len(excerpt) > 400:
                excerpt = excerpt[:400] + "..."

            ranked_citations.append(
                SourceCitation(
                    chunk_id=chunk.id,
                    source_path=chunk.source_path,
                    title=chunk.title,
                    heading=chunk.heading,
                    event_date=chunk.event_date,
                    excerpt=excerpt,
                    score=round(final_score, 4),
                )
            )

        ranked_citations.sort(key=lambda c: c.score, reverse=True)
        return ranked_citations[:limit]

