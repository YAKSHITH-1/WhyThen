# Architecture Decision Record: Hybrid Retrieval Strategy

Date: 2026-03-20
Author: Search & Retrieval Team
Project: WhyThen

## Revises: Pure Dense Vector Search

In our initial prototype, retrieval relied exclusively on dense sentence embeddings (`all-MiniLM-L6-v2`) via ChromaDB cosine similarity.

During internal testing, pure dense retrieval failed on several critical query patterns:
1. Exact acronyms (e.g. "ADR-04", "FTS5", "WAL", "API").
2. Specific alphanumeric identifiers, error codes, and function names.
3. Date mentions embedded in text where embeddings mapped to broad temporal concepts rather than specific numbers.

We decided to revise our retrieval strategy by introducing Hybrid Search:
- Dense Vector Retrieval: SentenceTransformers embeddings (`all-MiniLM-L6-v2`) in ChromaDB.
- Lexical Keyword Search: SQLite native FTS5 full-text search with BM25 ranking.
- Rank Fusion: Reciprocal Rank Fusion (RRF with constant $k=60$) combining ranks from dense and lexical candidate lists.

### Rationale
- High Precision & Recall: BM25 guarantees that rare keywords, technical jargon, and filenames are never missed, while dense embeddings capture synonymy and conceptual similarity.
- Zero Additional Dependencies: SQLite's built-in FTS5 module eliminates the need for Lucene, Elasticsearch, or additional search daemons.
