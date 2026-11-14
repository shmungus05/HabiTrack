"""
wayfinder.ui.views.research: Offline NASA scientific literature browser using SQLite FTS5.
"""

from pathlib import Path
import streamlit as st

from wayfinder.core.storage import StorageManager
from wayfinder.core.rag import search_knowledge, synthesize_with_ollama, index_research_corpus
from wayfinder.core.models import ResearchDocument


def render_research_view(storage_manager: StorageManager) -> None:
    """Renders the offline scientific evidence retrieval browser."""
    st.markdown('<h2 style="font-weight: 900; letter-spacing: -0.03em;">NASA Spaceflight Evidence Browser</h2>', unsafe_allow_html=True)
    st.markdown(
        '<p style="color: #94a3b8; font-size: 0.95rem; margin-bottom: 1.5rem;">'
        'Offline full-text search (SQLite FTS5 BM25) across curated NASA Human Research Roadmap (HRR) and '
        'Open Science Data Repository (OSDR) spaceflight health publications.'
        '</p>',
        unsafe_allow_html=True,
    )

    # 1. Quick suggestion chips
    st.markdown('<div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 0.5rem; font-weight: 600;">QUICK QUERIES:</div>', unsafe_allow_html=True)
    chip_col1, chip_col2, chip_col3, chip_col4 = st.columns(4)
    
    preset_query = None
    with chip_col1:
        if st.button("CO2 Headache Risk"):
            preset_query = "CO2 headache"
    with chip_col2:
        if st.button("Sleep Debt & Fatigue"):
            preset_query = "sleep loss fatigue"
    with chip_col3:
        if st.button("Cardiovascular Fluid Shift"):
            preset_query = "cardiovascular microgravity fluid"
    with chip_col4:
        if st.button("Radiation Biomarkers"):
            preset_query = "radiation biomarkers endothelial"

    # 2. Search Input Box
    default_text = preset_query if preset_query else "CO2 headache"
    search_query = st.text_input(
        "Search Scientific Literature",
        value=default_text,
        placeholder="e.g. elevated carbon dioxide, cephalad fluid shift, sleep loss...",
    )

    if not search_query.strip():
        st.info("Enter search terms to query the offline NASA research corpus.")
        return

    # 3. Execute FTS5 Search
    results = search_knowledge(search_query, storage_manager, max_results=5)

    # Reindex helper if 0 results
    if not results:
        st.warning("No scientific literature documents matched your query.")
        if st.button("Re-index Research Corpus"):
            corpus_path = Path(__file__).parent.parent.parent.parent / "data" / "research_corpus"
            if corpus_path.exists():
                count = index_research_corpus(corpus_path, storage_manager)
                st.success(f"Indexed {count} research sections.")
                st.rerun()
        return

    st.markdown(f'<div style="color: #38bdf8; font-weight: 700; margin: 1rem 0;">Found {len(results)} Curated NASA Evidence Cards</div>', unsafe_allow_html=True)

    # 4. Optional Ollama Synthesis
    ollama_summary = synthesize_with_ollama(search_query, results)
    if ollama_summary:
        st.markdown(
            f"""
            <div style="background: #172554; border: 1px solid #1e40af; border-radius: 20px; padding: 1.2rem; margin-bottom: 1.5rem;">
                <div style="font-size: 0.8rem; font-weight: 700; color: #93c5fd; text-transform: uppercase;">Local AI Synthesis (Ollama Llama-3.2)</div>
                <div style="color: #eff6ff; font-size: 0.95rem; line-height: 1.5; margin-top: 0.5rem;">{ollama_summary}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    # 5. Render Structured Research Cards
    for doc in results:
        doi_link = f"https://doi.org/{doc.doi_citation}" if doc.doi_citation else "#"
        st.markdown(
            f"""
            <div style="background: #111827; border: 1px solid #1f2937; border-radius: 24px; padding: 1.8rem; margin-bottom: 1.2rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.6rem;">
                    <div>
                        <span style="background: #0284c722; color: #38bdf8; border: 1px solid #0284c7; padding: 2px 8px; border-radius: 8px; font-size: 0.75rem; font-weight: 600;">
                            {doc.source_repository}
                        </span>
                        <span style="color: #64748b; font-size: 0.8rem; margin-left: 0.5rem;">Doc ID: {doc.doc_id}</span>
                    </div>
                    {f'<a href="{doi_link}" target="_blank" style="color: #38bdf8; font-size: 0.8rem; text-decoration: none;">DOI: {doc.doi_citation} &rarr;</a>' if doc.doi_citation else ''}
                </div>
                <h3 style="font-weight: 800; font-size: 1.2rem; color: #f8fafc; margin: 0.4rem 0;">{doc.title}</h3>
                <h4 style="font-weight: 600; font-size: 0.95rem; color: #94a3b8; margin-bottom: 0.8rem;">Section: {doc.section_heading}</h4>
                <div style="color: #cbd5e1; font-size: 0.95rem; line-height: 1.6; background: #0b0f19; padding: 1rem; border-radius: 16px; border: 1px solid #1e293b;">
                    {doc.content}
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
