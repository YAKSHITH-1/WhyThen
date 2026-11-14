# Architecture Decision Record: Initial Frontend Interface

Date: 2026-02-10
Author: Frontend Team
Project: WhyThen

## Initial Choice: In-Process Streamlit Dashboard

To validate the core retrieval mechanics and prompt engineering during early development, we needed a rapid graphical interface.

We evaluated two alternatives:
- Option A: Single-page application using React + TypeScript and REST APIs.
- Option B: Python-based in-process Streamlit interface.

We decided to choose Streamlit for the initial proof-of-concept phase.

### Rationale
- Immediate Iteration: Streamlit allows data science and Python engineers to write UI components directly alongside RAG retrieval code in Python.
- Fast Feedback: Avoids frontend build tooling, CORS configuration, and TypeScript contract overhead during early algorithm experimentation.

### Limitations Noted
- Full Page Reruns: Streamlit re-executes the entire Python script on user interactions, causing UI lag and flickering during multi-turn chats.
- State Persistence: Managing complex state machines (e.g. background job progress, multi-file uploads, and interactive timeline drawers) is fragile within Streamlit session state.
- Component Flexibility: Custom card layouts, interactive citation sidebars, and accessible dialogs are severely restricted.

We noted that if the MVP requires multi-tab navigation, custom citation sidebars, and responsive layouts, we will revise this choice in favor of a decoupled React frontend.
