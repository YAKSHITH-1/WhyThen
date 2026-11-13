import streamlit as st
from datetime import date
from pathlib import Path
from app.services.ingest_service import ingest_service
from app.services.search_service import search_service
from app.services.decision_service import decision_service
from app.storage.repositories import DocumentRepository
from app.schemas.query import SearchQuery, AskRequest

st.set_page_config(
    page_title="WhyThen | Personal Memory Assistant",
    page_icon="🧭",
    layout="wide",
)

st.title("🧭 WhyThen")
st.caption("A Local-First, Time-Aware Personal Memory & Decision History Assistant")

# Sidebar: Ingestion & Status
with st.sidebar:
    st.header("📂 Knowledge Base")
    folder_input = st.text_input(
        "Notes Directory Path",
        value=str(Path("sample_notes").resolve()),
        help="Local directory containing Markdown, TXT, or PDF files",
    )

    col1, col2 = st.columns(2)
    with col1:
        if st.button("🚀 Index Notes", use_container_width=True):
            if folder_input and Path(folder_input).exists():
                with st.spinner("Indexing folder..."):
                    result = ingest_service.ingest_folder(folder_input)
                st.success(
                    f"Processed: {result['processed_files']} | Unchanged: {result['unchanged_files']} | Chunks: {result['total_chunks_indexed']}"
                )
                if result["errors"]:
                    st.warning(f"Errors: {', '.join(result['errors'])}")
            else:
                st.error("Directory does not exist.")

    with col2:
        if st.button("🔄 Refresh List", use_container_width=True):
            st.rerun()

    st.divider()
    st.subheader("📄 Indexed Documents")
    doc_repo = DocumentRepository()
    all_docs = doc_repo.list_all()

    if all_docs:
        for doc in all_docs:
            with st.expander(f"{doc.filename} ({doc.document_date or 'No date'})"):
                st.caption(f"Path: {doc.path}")
                st.caption(f"Type: {doc.file_type} | Status: {doc.status.value}")
    else:
        st.info("No documents indexed yet.")

# Main Tabs
tab_ask, tab_decisions, tab_search = st.tabs(["💬 Ask WhyThen", "⏳ Decision Timeline", "🔍 Search Explorer"])

# Tab 1: Grounded Q&A
with tab_ask:
    st.markdown("### Ask a Question About Your Past Choices & Notes")
    st.caption("Answers are strictly grounded in your notes with verifiable citations.")

    col_q, col_d1, col_d2 = st.columns([3, 1, 1])
    with col_q:
        question = st.text_input(
            "Question",
            placeholder="e.g. Why did I choose ChromaDB instead of FAISS?",
        )
    with col_d1:
        date_from = st.date_input("From Date", value=None)
    with col_d2:
        date_to = st.date_input("To Date", value=None)

    if st.button("🔍 Get Grounded Answer", type="primary"):
        if not question:
            st.warning("Please enter a question.")
        else:
            req = AskRequest(
                question=question,
                date_from=date_from.strftime("%Y-%m-%d") if date_from else None,
                date_to=date_to.strftime("%Y-%m-%d") if date_to else None,
            )
            with st.spinner("Searching and synthesizing answer..."):
                resp = search_service.ask(req)

            # Coverage Badge
            badge_color = {
                "supported": "🟢 Supported by Notes",
                "partial": "🟡 Partially Supported",
                "no_evidence_found": "🟠 No Supporting Evidence Found",
            }.get(resp.coverage, "⚪")

            st.markdown(f"**Coverage Status:** {badge_color}")

            # Answer Container
            st.info(resp.answer)

            # Citations
            if resp.sources:
                st.subheader("📚 Verified Citations")
                for src in resp.sources:
                    with st.expander(f"[{src.chunk_id}] {src.title or Path(src.source_path).name} (Date: {src.event_date or 'None'})"):
                        st.caption(f"File: {src.source_path} | Heading: {src.heading or 'None'}")
                        st.text(src.excerpt)

# Tab 2: Decision History Timeline
with tab_decisions:
    st.markdown("### Chronological Decision History")
    st.caption("Reconstruct what was chosen, when, why, and whether a later note revised or superseded it.")

    topic = st.text_input("Decision Topic or Entity", placeholder="e.g. Database, Auth, Frontend Framework")
    if st.button("⏳ Reconstruct Timeline"):
        if not topic:
            st.warning("Please enter a topic.")
        else:
            with st.spinner("Analyzing chronological decision chain..."):
                t_resp = decision_service.get_decision_timeline(topic)

            st.markdown(f"#### Summary for '{t_resp.topic}'")
            st.write(t_resp.summary)

            if t_resp.timeline:
                for item in t_resp.timeline:
                    st.markdown("---")
                    st.markdown(f"**📅 Date:** `{item.event_date or 'Unspecified'}` | **Relation:** `{item.status_or_relation.upper()}`")
                    st.markdown(f"**Decision:** {item.decision}")
                    if item.rationale:
                        st.markdown(f"**Rationale:** {item.rationale}")

                    if item.citations:
                        for cit in item.citations:
                            st.caption(f"🔗 Source: `{Path(cit.source_path).name}` [{cit.chunk_id}]")
            else:
                st.info("No decision records found for this topic.")

# Tab 3: Search Explorer
with tab_search:
    st.markdown("### Hybrid Search (ChromaDB + SQLite FTS5 BM25)")
    search_text = st.text_input("Query", placeholder="Enter keywords or phrases...")
    if st.button("Run Hybrid Search"):
        if search_text:
            s_query = SearchQuery(text=search_text, limit=10)
            results = search_service.search(s_query)
            st.write(f"Found {len(results)} ranked chunks:")
            for r in results:
                with st.expander(f"Score: {r.score} | {Path(r.source_path).name} (Date: {r.event_date})"):
                    st.caption(f"Section: {r.heading} | Chunk ID: {r.chunk_id}")
                    st.text(r.excerpt)

