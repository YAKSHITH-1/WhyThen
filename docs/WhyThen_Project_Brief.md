# MemoTrail

A time-aware personal memory assistant

**PROJECT BRIEF**


## 1. The Idea

MemoTrail is a local-first assistant that helps users search their personal notes and project history over time. Instead of only finding information, it helps reconstruct what the user decided, when they decided it, why they chose it, and whether they later changed their mind.

## 2. Problem Statement

People store useful information across scattered notes, learning logs, and project documents. Over time, they forget where a decision was recorded, what reasoning led to it, or whether a later note changed the original plan. Traditional file search relies on exact keywords, while basic document-chat tools may overlook dates and the relationship between decisions recorded in different files.

MemoTrail aims to solve this by providing time-aware, evidence-backed search across a user's own knowledge base, with clear source references and an honest response when the available notes do not contain the answer.

## 3. Example Questions It Answers

What did I decide about this project last month?

Why did I choose ChromaDB instead of FAISS?

Did I later change that decision?

What was I planning to work on next?

Which tasks or ideas did I leave unfinished?

## 4. MVP — First Version

The MVP will focus on one core workflow: index a folder of personal notes, ask a question about the past, and receive an answer supported by dated source excerpts.

Import local Markdown, TXT, and PDF files from a folder selected by the user.

Extract text and useful metadata, including source path and available dates.

Create searchable chunks and embeddings; maintain a keyword index.

Use hybrid retrieval (semantic search + BM25) with date filters.

Generate answers grounded in retrieved notes, showing source files, dates, and excerpts.

Provide a basic chronological decision history for related choices and later revisions.

Re-index only new or modified files.

Process data locally by default.

## 5. Out of Scope for MVP

No email or calendar integrations, web scraping, cloud sync, mobile app, multi-user support, or autonomous task execution. These can be considered only after the core search and timeline features work reliably.

## 6. Suggested Tech Stack

Backend

Python + FastAPI

Frontend

Streamlit

Metadata storage

SQLite

Vector search

ChromaDB

Keyword search

BM25 (rank_bm25)

Embeddings

Sentence Transformers

LLM

Ollama with a locally available model

## 7. What Makes the Project Worth Building?

The project goes beyond a basic document chatbot by focusing on temporal retrieval and decision history. It demonstrates practical engineering skills in file processing, metadata design, hybrid RAG, retrieval evaluation, and source-grounded generation. Its value should be demonstrated through measured retrieval and citation quality—not by claiming that the idea has no competitors.

## 8. MVP Success Criteria

A user can index a folder and search its contents without manually preparing the files.

Date-based questions retrieve information from the correct period.

Answers include verifiable source references and excerpts.

The system says when it cannot find supporting information.

A decision timeline shows dated evidence for a choice and any detected later revision.
