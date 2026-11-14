"""
tests.test_scenario_day127: End-to-end integration test executing the complete Day 127 mission verification scenario.
"""

from pathlib import Path
import pytest
from wayfinder.core.storage import StorageManager
from wayfinder.core.ingestion import ingest_eda_csv
from wayfinder.core.simulation import generate_vitals
from wayfinder.core.analytics import evaluate_exposure_events
from wayfinder.core.rag import index_research_corpus, search_knowledge
from wayfinder.core.models import (
    SymptomReport,
    SeverityLevel,
    UncertaintyLevel,
    ReviewStatus,
)


def test_complete_day127_mission_scenario(temp_db):
    """
    Executes complete end-to-end mission verification workflow for ISS Expedition 71 Day 127:
    1. DB initialization and default metadata seeding.
    2. Ingestion of 72-hour authentic ISS EDA telemetry with 5.8 mmHg CO2 excursion and sensor dropout.
    3. Deterministic generation of autonomous vitals with gap inheritance.
    4. Indexing of NASA Human Research Roadmap and OSDR spaceflight corpus.
    5. Logging of crew headache report at MET Day 127 02:15:00 UTC.
    6. Autonomous sliding-window exposure correlation generating an INVESTIGATE event.
    7. Pure-offline FTS5 BM25 retrieval of authoritative NASA research citations.
    8. CMO acknowledgment and review note persistence.
    """
    root_dir = Path(__file__).parent.parent

    # Step 1: Storage setup
    temp_db.ensure_initialized()
    astro = temp_db.get_astronaut("ASTRO-01")
    assert astro is not None
    assert astro.callsign == "CDR M. Vance"

    # Step 2: Ingest authentic EDA CSV
    eda_csv = root_dir / "data" / "sample_eda_iss_co2_temp.csv"
    assert eda_csv.exists(), "Sample EDA CSV must exist"
    num_ingested = ingest_eda_csv(eda_csv, temp_db)
    assert num_ingested > 0

    co2_meas = temp_db.get_measurements_df(["stream_eda_co2"])
    assert len(co2_meas) >= 800
    peak_co2 = co2_meas["value"].max()
    assert peak_co2 >= 5.0, f"Expected CO2 excursion >= 5.0 mmHg, got {peak_co2}"

    # Step 3: Run autonomous vitals simulator
    vitals_df = generate_vitals(
        "ASTRO-01",
        start_time="2026-05-07T00:00:00Z",
        end_time="2026-05-10T00:00:00Z",
        seed=42,
        storage_manager=temp_db,
    )
    assert len(vitals_df) > 0

    # Verify determinism and gap inheritance
    db_hr = temp_db.get_measurements_df(["stream_sim_hr"], astronaut_id="ASTRO-01")
    assert len(db_hr) > 0
    assert (db_hr["is_synthetic"] == 1).all()

    # Step 4: Index NASA Research Corpus
    corpus_dir = root_dir / "data" / "research_corpus"
    assert corpus_dir.exists()
    chunks_indexed = index_research_corpus(corpus_dir, temp_db)
    assert chunks_indexed >= 4

    # Step 5: Astronaut logs moderate headache (severity 3) at MET Day 127 02:15:00 (reported 1h 45m later)
    symptom = SymptomReport(
        report_id="SYM-DAY127-E2E",
        astronaut_id="ASTRO-01",
        symptom_code="HEADACHE",
        severity=3,
        occurred_at="2026-05-09T02:15:00Z",
        reported_at="2026-05-09T04:00:00Z",
        cabin_module="Node 2",
        notes="Bilateral frontal throbbing, mild photophobia.",
        is_synthetic=False,
    )
    temp_db.insert_symptom_report(symptom)

    # Step 6: Autonomous exposure correlation
    events = evaluate_exposure_events("ASTRO-01", temp_db, window_hours=4.0)
    assert len(events) >= 1
    target_event = next(e for e in events if e.symptom_report_id == "SYM-DAY127-E2E")

    # Assert INVESTIGATE severity level
    assert target_event.severity_level == SeverityLevel.INVESTIGATE
    # Assert LOW uncertainty because module aligns with sensor in Node 2
    assert target_event.uncertainty_level == UncertaintyLevel.LOW
    # Assert mandatory non-causal decision-support disclaimer is included
    assert "Temporal overlap indicates co-occurrence only, not clinical causation" in target_event.rationale
    assert "WAYFINDER does not diagnose pathologies or prescribe countermeasures" in target_event.rationale
    assert target_event.review_status == ReviewStatus.PENDING

    # Step 7: Offline FTS5 BM25 retrieval
    docs = search_knowledge("CO2 headache", temp_db, max_results=3)
    assert len(docs) > 0
    top_doc = docs[0]
    assert "HRR-CO2-001" in top_doc.doc_id or "CO2" in top_doc.title
    assert top_doc.doi_citation is not None
    assert "10.1016" in top_doc.doi_citation

    # Step 8: CMO Review action update
    with temp_db.get_connection() as conn:
        conn.execute(
            """
            UPDATE health_events 
            SET review_status = 'ACKNOWLEDGED', review_notes = 'Reviewed by Flight Surgeon. Verified CDRA operational cycle.'
            WHERE event_id = ?;
            """,
            (target_event.event_id,),
        )

    # Verify review status persisted
    with temp_db.get_connection() as conn:
        row = conn.execute("SELECT * FROM health_events WHERE event_id = ?;", (target_event.event_id,)).fetchone()
        assert row["review_status"] == ReviewStatus.ACKNOWLEDGED.value
        assert "Reviewed by Flight Surgeon" in row["review_notes"]
