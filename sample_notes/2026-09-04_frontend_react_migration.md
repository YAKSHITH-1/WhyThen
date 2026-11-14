# Architecture Decision Record: Frontend Framework Migration

Date: 2026-09-04
Author: Engineering Lead
Project: WhyThen

## Supersedes: Streamlit In-Process UI
## Initial Choice: React + TypeScript + Vite + Tailwind CSS

Following user feedback on our internal alpha, the Streamlit prototype proved inadequate for production use:
1. Every slider change or message send caused full-page recalculations.
2. Building an interactive vertical decision timeline with status badges and collapsible rationale drawers was nearly impossible within Streamlit's linear widget model.
3. Streamlit combined the web server and business logic into one process, preventing clean separation of concerns and blocking independent frontend testing.

We decided to supersede the Streamlit prototype and adopt a modern decoupled frontend stack:
- Framework: React 18/19 with TypeScript.
- Build Tool: Vite with rapid hot module reloading and fast production bundling.
- Styling: Tailwind CSS with shadcn/ui minimal aesthetic.
- Routing: React Router for clean URL navigation (`/`, `/ask`, `/timeline`, `/sources`, `/settings`).
- HTTP Client: Centralized Axios client configured with a 60-second timeout for local Ollama LLM inference.
- Icons: Lucide React.

### Rationale
- Decoupled REST APIs: FastAPI exclusively handles document parsing, vector indexing, BM25 retrieval, and LLM synthesis under `/api/*`.
- Modern User Experience: Fluid conversational chat, asynchronous background job progress indicators, interactive citation drawers, and zero flickering.
- Standalone Production Serving: In production, FastAPI serves the compiled React SPA directly via a fallback catch-all handler (`frontend/dist/index.html`).
