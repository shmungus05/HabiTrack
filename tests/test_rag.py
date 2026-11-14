"""
tests.test_rag: Unit tests for offline research corpus indexing and SQLite FTS5 BM25 retrieval.
"""

import os
from pathlib import Path
import pytest
from wayfinder.core.rag import index_research_corpus, search_knowledge, synthesize_with_ollama


def test_index_and_search_research_corpus(temp_db):
    temp_db.ensure_initialized()
    corpus_dir = Path(__file__).parent.parent / "data" / "research_corpus"
    assert corpus_dir.exists(), "Research corpus directory must exist"

    # Index the corpus
    num_indexed = index_research_corpus(corpus_dir, temp_db)
    assert num_indexed >= 4, f"Expected at least 4 chunks, got {num_indexed}"

    # Search for CO2 and headache
    results_co2 = search_knowledge("CO2 headache", temp_db, max_results=3)
    assert len(results_co2) > 0
    top_doc = results_co2[0]
    assert "HRR-CO2-001" in top_doc.doc_id or "CO2" in top_doc.title
    assert top_doc.doi_citation is not None
    assert "10.1016" in top_doc.doi_citation

    # Search for cardiovascular / fluid shift
    results_cardio = search_knowledge("fluid shift microgravity", temp_db, max_results=2)
    assert len(results_cardio) > 0
    assert any("fluid" in doc.content.lower() for doc in results_cardio)

    # Empty search handles gracefully
    assert search_knowledge("", temp_db) == []
    assert search_knowledge("   ", temp_db) == []


def test_synthesize_with_ollama_offline_fallback(temp_db):
    temp_db.ensure_initialized()
    # Call with non-existent port to guarantee offline condition
    fallback = synthesize_with_ollama(
        "What causes headache in space?",
        retrieved_docs=[],
        base_url="http://127.0.0.1:59999",
        timeout_sec=0.2,
    )
    assert fallback is None


def test_hybrid_search_with_corpus_type_filter(temp_db):
    """TICK-03: Verifies hybrid search filtering on corpus_type ('FLIGHT_RULE' vs 'RESEARCH')."""
    from wayfinder.core.rag import VectorStoreManager, index_research_corpus
    from wayfinder.core.flight_rules import seed_flight_rules
    import numpy as np

    temp_db.ensure_initialized()
    corpus_dir = Path(__file__).parent.parent / "data" / "research_corpus"
    index_research_corpus(corpus_dir, temp_db)
    seed_flight_rules(temp_db)

    store = VectorStoreManager(temp_db)
    dummy_query_vector = np.ones(384, dtype=np.float32)

    # Search filtered strictly to FLIGHT_RULE
    flight_results, mode = store.search_hybrid_rrf(
        "hypercapnia CDRA", query_vector=dummy_query_vector, top_k=5, corpus_type="FLIGHT_RULE"
    )
    assert len(flight_results) > 0
    assert all("FR-" in r.doc_id for r in flight_results)

    # Search filtered strictly to RESEARCH
    research_results, mode = store.search_hybrid_rrf(
        "CO2 headache", query_vector=dummy_query_vector, top_k=5, corpus_type="RESEARCH"
    )
    assert len(research_results) > 0
    assert all("FR-" not in r.doc_id for r in research_results)


def test_index_research_corpus_preserves_flight_rules(temp_db):
    """TICK-03: Verifies re-indexing research corpus does not wipe flight rules in FTS5."""
    from wayfinder.core.rag import index_research_corpus
    from wayfinder.core.flight_rules import seed_flight_rules

    temp_db.ensure_initialized()
    seed_flight_rules(temp_db)

    corpus_dir = Path(__file__).parent.parent / "data" / "research_corpus"
    index_research_corpus(corpus_dir, temp_db)

    with temp_db.get_connection() as conn:
        fr_rows = conn.execute(
            "SELECT COUNT(*) as c FROM research_knowledge_fts WHERE source_repository = 'NASA Flight Rules';"
        ).fetchone()["c"]
    assert fr_rows == 3
