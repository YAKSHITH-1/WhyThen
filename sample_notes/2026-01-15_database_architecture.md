# Architecture Decision Record: Database & Storage Strategy

Date: 2026-01-15
Author: Architecture Team
Project: WhyThen

## Initial Choice: Local SQLite + ChromaDB

Today we evaluated persistent storage architectures for WhyThen. The application requires two distinct storage capabilities:
1. Structured metadata storage for document inventory, parsing hashes, chunk records, and job tracking.
2. High-dimensional vector storage for dense semantic embedding similarity search.

We evaluated three architectural candidates:
- Candidate A: Centralized PostgreSQL with pgvector extension.
- Candidate B: Cloud vector database (Pinecone / Weaviate Cloud).
- Candidate C: Embedded local SQLite combined with embedded ChromaDB.

We decided to choose embedded SQLite and ChromaDB instead of PostgreSQL or cloud services.

### Rationale
- Zero Infrastructure Friction: Users can run WhyThen locally without installing Docker, running background daemons, or managing database credentials.
- Total Privacy: Zero network egress. User notes and document vectors never leave the user's local workstation.
- Performance: SQLite delivers sub-millisecond local reads and robust ACID guarantees with WAL mode enabled.
- Simplicity: ChromaDB provides built-in SQLite persistence and client-side metadata filtering without requiring external server processes.

### Next Steps
Implement database migration runners, repository interfaces, and set up embedding generation with sentence-transformers.
