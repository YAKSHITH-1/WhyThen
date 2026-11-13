# Project Alpha Architecture Decisions

Date: 2026-03-06

## Vector Database Selection

Today we evaluated vector database solutions for Project Alpha.
We compared ChromaDB with FAISS and Qdrant.

We decided to choose ChromaDB instead of FAISS.
The rationale is that ChromaDB provides built-in SQLite metadata persistence and client-side filtering out of the box, whereas FAISS requires manual index serialization and does not natively manage document metadata.

Next steps: Set up the embedding pipeline with sentence-transformers.

