# Architecture Decision Record: Temporal Metadata & Reranking

Date: 2026-07-25
Author: Search & Intelligence Team
Project: WhyThen

## Supersedes: Static Similarity Reranking

Prior to this decision, search results were ranked purely by semantic and lexical similarity scores. However, in personal decision tracking, the time dimension is essential:
- A user asking "What did we decide about the database?" wants the most recent and authoritative decision, not an obsolete proposal from 6 months ago.
- When a user specifies a date range (e.g. "Decisions made between March and May 2026"), chunks outside that window must be excluded, while chunks closest to the target window should receive a relevance boost.

We decided to supersede pure similarity ranking with Time-Aware Normalized Reranking:
- Tri-Partite Scoring Formula:
  $$\text{Final Score} = 0.50 \cdot \text{Semantic Score} + 0.30 \cdot \text{Lexical Score} + 0.20 \cdot \text{Temporal Score}$$
- Temporal Fit Decay: An exponential half-life decay function measuring days between the extracted event date and the target query date.
- Hard Date Boundary Filtering: Chunks with confirmed dates outside the user's `date_from` or `date_to` bounds are strictly filtered before reranking.
- Regex Event Date Extraction: Parser extracts event dates from markdown headers (`Date: YYYY-MM-DD`, `## YYYY-MM-DD`, `Decision on YYYY-MM-DD`) with fallback to document file modification timestamps.
