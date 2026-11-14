"""
tests/test_vectors.py: Persistence and retrieval tests for the embedded vector store.

Covers WAYFINDER-V3-004 (storage contracts) and WAYFINDER-V3-008 (matrix search,
RRF calibration, and archetype resolution).
"""

import numpy as np
import pytest

from wayfinder.core.embeddings import EMBEDDING_DIMENSION, embed_text
from wayfinder.core.storage import StorageManager


def test_research_vector_blobs_round_trip_as_float32(temp_db):
    """WAYFINDER-V3-004: every persisted BLOB decodes to a 384-d float32 vector."""
    rows = temp_db.list_all_vector_chunks()

    assert len(rows) == 13
    for row in rows:
        vector = np.frombuffer(row["embedding"], dtype=np.float32)
        assert vector.shape == (EMBEDDING_DIMENSION,)
        assert np.isfinite(vector).all()
        assert float(np.linalg.norm(vector)) == pytest.approx(1.0, abs=1e-5)


def test_archetype_vectors_are_seeded_with_unit_norm(temp_db):
    """WAYFINDER-V3-004: all four canonical archetype vectors decode cleanly."""
    with temp_db.get_connection() as conn:
        rows = conn.execute("SELECT * FROM event_archetype_vectors;").fetchall()

    assert len(rows) == 4
    for row in rows:
        vector = np.frombuffer(row["embedding"], dtype=np.float32)
        assert vector.shape == (EMBEDDING_DIMENSION,)
        assert float(np.linalg.norm(vector)) == pytest.approx(1.0, abs=1e-5)


def test_list_all_vector_chunks_is_deterministic(temp_db):
    """WAYFINDER-V3-004: chunk ordering is stable for matrix row/index alignment."""
    first = [row["chunk_id"] for row in temp_db.list_all_vector_chunks()]
    second = [row["chunk_id"] for row in temp_db.list_all_vector_chunks()]

    assert first == second
    assert first[0].startswith("HRR-CO2-001_")
    assert len(set(first)) == len(first)


def test_missing_seed_asset_does_not_crash_startup(tmp_path):
    """WAYFINDER-V3-004: a missing seed file degrades to an empty vector store."""
    storage = StorageManager(db_path=str(tmp_path / "empty-seed.db"))
    storage.ensure_initialized()

    with storage.get_connection() as conn:
        conn.execute("DELETE FROM research_vectors;")
        conn.execute("DELETE FROM event_archetype_vectors;")

    storage.seed_research_vectors_if_empty(seed_path=tmp_path / "does-not-exist.json")

    assert storage.list_all_vector_chunks() == []
    with storage.get_connection() as conn:
        archetypes = conn.execute("SELECT COUNT(*) FROM event_archetype_vectors;").fetchone()[0]
    assert archetypes == 0


def test_deterministic_encoder_is_stable_and_normalized():
    """WAYFINDER-V3-004: the shared encoder is reproducible and unit-normalized."""
    first = embed_text("cabin carbon dioxide headache")
    second = embed_text("cabin carbon dioxide headache")

    assert first.dtype == np.float32
    assert np.array_equal(first, second)
    assert float(np.linalg.norm(first)) == pytest.approx(1.0, abs=1e-6)
    assert not np.array_equal(first, embed_text("radiation biomarker surveillance"))


def test_dense_search_returns_ranked_chunk_ids(temp_db):
    """WAYFINDER-V3-005: dense search returns cosine-ranked chunk IDs."""
    from wayfinder.core.rag import VectorStoreManager

    store = VectorStoreManager(temp_db)
    results = store.search_dense(embed_text("cabin carbon dioxide headache"), top_k=3)

    assert len(results) == 3
    assert results[0][0].startswith("HRR-CO2-001_")
    assert 0.0 < results[0][1] <= 1.0
    assert all(isinstance(score, float) for _, score in results)


def test_dense_search_is_safe_on_empty_store(tmp_path):
    """WAYFINDER-V3-005: an unseeded store never crashes dense search."""
    from wayfinder.core.rag import VectorStoreManager
    from wayfinder.core.storage import StorageManager

    storage = StorageManager(db_path=str(tmp_path / "empty-vectors.db"))
    storage.ensure_initialized()
    with storage.get_connection() as conn:
        conn.execute("DELETE FROM research_vectors;")

    store = VectorStoreManager(storage)
    assert store.corpus_matrix.shape == (0, EMBEDDING_DIMENSION)
    assert store.search_dense(embed_text("anything"), top_k=5) == []


def test_hybrid_rrf_scores_top_document_near_100_percent(temp_db):
    """WAYFINDER-V3-006: a document ranked first by both modalities scores ~100%."""
    from wayfinder.core.rag import VectorStoreManager, index_research_corpus

    index_research_corpus("data/research_corpus", temp_db)
    store = VectorStoreManager(temp_db)
    evidence, mode = store.search_hybrid_rrf(
        "cabin CO2 headache", embed_text("cabin CO2 headache"), top_k=5
    )

    assert mode == "HYBRID_RRF"
    assert evidence[0].doc_id == "HRR-CO2-001"
    assert evidence[0].relevance_pct == pytest.approx(100.0, abs=0.01)
    assert evidence[0].rrf_score == pytest.approx(2.0 / 61.0, abs=1e-6)


def test_hybrid_rrf_single_modality_caps_at_fifty_percent(temp_db):
    """WAYFINDER-V3-006: lexical-only fallback uses the 1/61 normalization."""
    from wayfinder.core.rag import VectorStoreManager, index_research_corpus

    index_research_corpus("data/research_corpus", temp_db)
    store = VectorStoreManager(temp_db)
    evidence, mode = store.search_hybrid_rrf("cabin CO2 headache", None, top_k=5)

    assert mode == "LEXICAL_BM25"
    assert evidence[0].doc_id == "HRR-CO2-001"
    assert evidence[0].relevance_pct == pytest.approx(100.0, abs=0.01)
    assert all(item.relevance_pct <= 100.0 for item in evidence)


def _make_event(streams: str):
    from wayfinder.core.models import (
        HealthEvent,
        SeverityLevel,
        UncertaintyLevel,
    )

    return HealthEvent(
        event_id="EVT-ARCH-TEST",
        astronaut_id="ASTRO-01",
        event_type="MULTI_SIGNAL_CONCORDANCE",
        severity_level=SeverityLevel.OBSERVE,
        start_time="2026-07-08T02:00:00Z",
        end_time="2026-07-08T02:30:00Z",
        contributing_stream_ids=streams,
        rationale="Temporal co-occurrence only.",
        uncertainty_level=UncertaintyLevel.MODERATE,
    )


@pytest.mark.parametrize(
    ("streams", "expected"),
    [
        (
            "stream_eda_co2,stream_sim_hr,stream_sim_hrv",
            "ARCHETYPE_CO2_HYPERCAPNIA_VITAL_SHIFT",
        ),
        ("stream_eda_co2,stream_sim_hr", "ARCHETYPE_CO2_HYPERCAPNIA_VITAL_SHIFT"),
        ("stream_eda_co2,stream_sim_hrv", "ARCHETYPE_CO2_HYPERCAPNIA_VITAL_SHIFT"),
        ("stream_sim_hr,stream_sim_hrv", "ARCHETYPE_AUTONOMIC_WORKOUT_FATIGUE"),
        ("stream_eda_temp", "ARCHETYPE_THERMAL_ENVIRONMENTAL_STRESS"),
        ("stream_eda_temp,stream_eda_pressure", "ARCHETYPE_THERMAL_ENVIRONMENTAL_STRESS"),
        ("stream_eda_co2", "ARCHETYPE_GENERIC_PHYSIOLOGICAL_EXCURSION"),
        ("stream_sim_hrv", "ARCHETYPE_GENERIC_PHYSIOLOGICAL_EXCURSION"),
        ('["stream_eda_co2", "stream_sim_hr"]', "ARCHETYPE_CO2_HYPERCAPNIA_VITAL_SHIFT"),
        ("stream_sim_hr", "ARCHETYPE_GENERIC_PHYSIOLOGICAL_EXCURSION"),
    ],
)
def test_resolve_archetype_id_across_stream_combinations(streams, expected):
    """WAYFINDER-V3-007: stream tokenization never character-splits identifiers."""
    from wayfinder.core.assistant import resolve_archetype_id

    assert resolve_archetype_id(_make_event(streams)) == expected


def test_get_archetype_vector_returns_384d_float32(temp_db):
    """WAYFINDER-V3-007: canonical archetype vectors are dot-product ready."""
    from wayfinder.core.assistant import get_archetype_vector

    vector = get_archetype_vector(temp_db, "ARCHETYPE_CO2_HYPERCAPNIA_VITAL_SHIFT")

    assert vector.shape == (EMBEDDING_DIMENSION,)
    assert vector.dtype == np.float32
    assert float(np.linalg.norm(vector)) == pytest.approx(1.0, abs=1e-5)


def test_dense_search_latency_under_point_two_milliseconds(tmp_path):
    """WAYFINDER-V3-008: 500-chunk dot-product search stays under 0.2 ms."""
    import time

    from wayfinder.core.rag import VectorStoreManager
    from wayfinder.core.storage import StorageManager

    storage = StorageManager(db_path=str(tmp_path / "latency-vectors.db"))
    storage.ensure_initialized()
    rng = np.random.default_rng(7)
    with storage.get_connection() as conn:
        conn.execute("DELETE FROM research_vectors;")
        rows = []
        for index in range(500):
            vector = rng.normal(size=EMBEDDING_DIMENSION).astype(np.float32)
            vector /= np.linalg.norm(vector)
            rows.append(
                (
                    f"chunk-{index:03d}",
                    "DOC-SYNTHETIC",
                    "Synthetic",
                    None,
                    None,
                    "Section",
                    "Synthetic passage content.",
                    None,
                    "Synthetic Repository",
                    vector.tobytes(),
                    "all-minilm",
                )
            )
        conn.executemany(
            """
            INSERT INTO research_vectors (
                chunk_id, doc_id, title, authors, report_identifier,
                section_heading, content, doi_citation, source_repository,
                embedding, embedding_model
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            rows,
        )

    store = VectorStoreManager(storage)
    query = embed_text("cabin carbon dioxide headache")
    for _ in range(10):
        store.search_dense(query, top_k=5)

    started = time.perf_counter()
    for _ in range(1000):
        store.search_dense(query, top_k=5)
    elapsed_ms = (time.perf_counter() - started) * 1000.0

    assert elapsed_ms / 1000.0 < 0.2


def test_hybrid_rrf_document_in_one_modality_capped_at_fifty_percent(tmp_path):
    """WAYFINDER-V3-008: a document present in a single modality caps at 50%."""
    from wayfinder.core.rag import VectorStoreManager
    from wayfinder.core.storage import StorageManager

    storage = StorageManager(db_path=str(tmp_path / "single-modality.db"))
    storage.ensure_initialized()
    dense_vector = embed_text("dense semantic phrase").tobytes()
    other_vector = embed_text("unrelated tactile pressure").tobytes()

    with storage.get_connection() as conn:
        conn.execute("DELETE FROM research_vectors;")
        conn.execute("DELETE FROM research_knowledge_fts;")
        conn.execute(
            """
            INSERT INTO research_knowledge_fts
            (doc_id, title, section_heading, content, doi_citation, source_repository)
            VALUES ('TXT-ONLY', 'Lexical Only', 'Lexical Section',
                    'zzzlexical unique token passage', NULL, 'Synthetic');
            """
        )
        conn.executemany(
            """
            INSERT INTO research_vectors
            (chunk_id, doc_id, title, authors, report_identifier, section_heading,
             content, doi_citation, source_repository, embedding, embedding_model)
            VALUES (?, ?, ?, NULL, NULL, ?, ?, NULL, 'Synthetic', ?, 'all-minilm');
            """,
            [
                (
                    "TXT-ONLY_c1",
                    "TXT-ONLY",
                    "Lexical Only",
                    "Lexical Section",
                    "zzzlexical unique token passage",
                    other_vector,
                ),
                (
                    "VEC-ONLY_c1",
                    "VEC-ONLY",
                    "Dense Only",
                    "Dense Section",
                    "Dense semantic phrase passage",
                    dense_vector,
                ),
                (
                    "VEC-TWO_c1",
                    "VEC-TWO",
                    "Dense Only Two",
                    "Dense Section Two",
                    "Dense semantic phrase passage variant",
                    embed_text("dense semantic phrase variant").tobytes(),
                ),
            ],
        )

    store = VectorStoreManager(storage)
    evidence, mode = store.search_hybrid_rrf(
        "zzzlexical", embed_text("dense semantic phrase"), top_k=2
    )

    assert mode == "HYBRID_RRF"
    assert {item.doc_id for item in evidence} == {"TXT-ONLY", "VEC-ONLY"}
    assert all(item.relevance_pct == pytest.approx(50.0, abs=1e-6) for item in evidence)


def test_hybrid_rrf_orders_dual_modality_hits_above_single_modality_hits(temp_db):
    """WAYFINDER-V3-008: RRF sums ranks across modalities, not raw scores."""
    from wayfinder.core.rag import VectorStoreManager, index_research_corpus

    index_research_corpus("data/research_corpus", temp_db)
    store = VectorStoreManager(temp_db)
    query = "cabin CO2 headache physiological susceptibility"
    evidence, mode = store.search_hybrid_rrf(query, embed_text(query), top_k=5)

    assert mode == "HYBRID_RRF"
    scores = [item.rrf_score for item in evidence]
    assert scores == sorted(scores, reverse=True)
    assert evidence[0].relevance_pct >= evidence[-1].relevance_pct
    assert all(0.0 <= item.relevance_pct <= 100.0 for item in evidence)
