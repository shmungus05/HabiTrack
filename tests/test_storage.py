"""
tests/test_storage.py: Unit tests for SQLite storage manager and concurrency.
"""

import threading
import sqlite3
import json
import uuid
from pathlib import Path
import pytest
import pandas as pd
from wayfinder.core.models import (
    Astronaut,
    AssistantAuditLog,
    CalibrationStatus,
    SymptomReport,
    HealthEvent,
    SeverityLevel,
    UncertaintyLevel,
    ReviewStatus,
    FlightRule,
    ChecklistStep,
    SeverityTrigger,
)


def test_storage_initialization(temp_db):
    """Verifies that all tables and default metadata are seeded cleanly."""
    astronauts = temp_db.list_astronauts()
    assert len(astronauts) >= 1
    assert astronauts[0].astronaut_id == "ASTRO-01"
    assert astronauts[0].callsign == "CDR M. Vance"


def test_astronaut_crud(temp_db):
    """Verifies astronaut profile insertion and retrieval."""
    new_astro = Astronaut(
        astronaut_id="ASTRO-02",
        callsign="FE-1 J. Doe",
        mission_id="ISS-EXP-71",
        crew_role="Flight Engineer",
        baseline_calibrated_at="2026-03-02T00:00:00Z",
        baseline_parameters='{"resting_hr": 60.0}',
    )
    temp_db.insert_astronaut(new_astro)
    retrieved = temp_db.get_astronaut("ASTRO-02")
    assert retrieved is not None
    assert retrieved.callsign == "FE-1 J. Doe"
    assert retrieved.baseline_parameters == '{"resting_hr": 60.0}'


def test_measurements_batch_insert_and_query(temp_db):
    """Verifies bulk measurement insertion and time-range filtering."""
    df = pd.DataFrame({
        "stream_id": ["stream_eda_co2", "stream_eda_co2", "stream_eda_co2"],
        "astronaut_id": [None, None, None],
        "timestamp": [
            "2026-07-01T00:00:00Z",
            "2026-07-01T00:01:00Z",
            "2026-07-01T00:02:00Z",
        ],
        "value": [2.5, 3.1, 4.8],
        "quality_status": ["VALID", "VALID", "VALID"],
        "is_synthetic": [False, False, False],
    })
    count = temp_db.insert_measurements_df(df)
    assert count == 3

    queried = temp_db.get_measurements_df(
        stream_ids=["stream_eda_co2"],
        start_time="2026-07-01T00:01:00Z",
        end_time="2026-07-01T00:02:00Z",
    )
    assert len(queried) == 2
    assert queried.iloc[0]["value"] == 3.1
    assert queried.iloc[1]["value"] == 4.8


def test_symptom_report_lifecycle(temp_db, sample_symptom):
    """Verifies logging and listing symptom reports."""
    temp_db.insert_symptom_report(sample_symptom)
    reports = temp_db.list_symptom_reports("ASTRO-01")
    assert len(reports) == 1
    assert reports[0].report_id == "SYM-001"
    assert reports[0].severity == 3
    assert reports[0].symptom_code == "HEADACHE"


def test_health_event_review_update(temp_db, sample_symptom):
    """Verifies creating health events and updating clinical review status."""
    temp_db.insert_symptom_report(sample_symptom)
    event = HealthEvent(
        event_id="EVT-001",
        astronaut_id="ASTRO-01",
        event_type="ENVIRONMENTAL_SPIKE_COOCCURRENCE",
        severity_level=SeverityLevel.INVESTIGATE,
        start_time="2026-07-01T00:00:00Z",
        end_time="2026-07-01T02:00:00Z",
        contributing_stream_ids='["stream_eda_co2", "stream_sim_hr"]',
        symptom_report_id="SYM-001",
        rationale="Cabin CO2 exceeded 4.5 mmHg with coincident headache report.",
        uncertainty_level=UncertaintyLevel.LOW,
        review_status=ReviewStatus.PENDING,
    )
    temp_db.insert_health_event(event)

    events = temp_db.list_health_events("ASTRO-01")
    assert len(events) == 1
    assert events[0].review_status == ReviewStatus.PENDING

    # Review acknowledgment
    temp_db.update_health_event_review(
        event_id="EVT-001",
        review_status=ReviewStatus.ACKNOWLEDGED,
        review_notes="Flight Surgeon reviewed; instructed crew member to inspect Node 3 scrubber.",
    )

    updated_events = temp_db.list_health_events("ASTRO-01")
    assert updated_events[0].review_status == ReviewStatus.ACKNOWLEDGED
    assert "scrubber" in updated_events[0].review_notes


def test_concurrent_multithread_access(temp_db):
    """Verifies that multiple worker threads can write and read simultaneously without locking errors."""
    def worker(thread_idx: int):
        df = pd.DataFrame({
            "stream_id": ["stream_sim_hr"],
            "astronaut_id": ["ASTRO-01"],
            "timestamp": [f"2026-07-01T0{thread_idx}:00:00Z"],
            "value": [70.0 + thread_idx],
            "quality_status": ["VALID"],
            "is_synthetic": [True],
        })
        temp_db.insert_measurements_df(df)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    res = temp_db.get_measurements_df(stream_ids=["stream_sim_hr"])
    assert len(res) == 5


def test_schema_migration_from_v1(tmp_path):
    """Verifies that running ensure_initialized on a V1 schema adds V2 columns without data loss."""
    import sqlite3
    from wayfinder.core.storage import StorageManager

    db_path = str(tmp_path / "v1_legacy.db")
    # Initialize legacy V1 astronauts table with only 6 columns
    conn = sqlite3.connect(db_path)
    conn.execute("""
    CREATE TABLE astronauts (
        astronaut_id TEXT PRIMARY KEY,
        callsign TEXT NOT NULL,
        mission_id TEXT NOT NULL,
        crew_role TEXT NOT NULL,
        baseline_calibrated_at TIMESTAMP,
        baseline_parameters TEXT
    );
    """)
    conn.execute("""
    INSERT INTO astronauts (astronaut_id, callsign, mission_id, crew_role, baseline_calibrated_at, baseline_parameters)
    VALUES ('ASTRO-99', 'Old Timer', 'EXP-01', 'Veteran', '2020-01-01T00:00:00Z', '{"legacy": true}');
    """)
    conn.commit()
    conn.close()

    # Now run ensure_initialized
    mgr = StorageManager(db_path=db_path)
    mgr.ensure_initialized()

    # Verify column existence
    with mgr.get_connection() as c:
        cols = {row["name"] for row in c.execute("PRAGMA table_info(astronauts);").fetchall()}
        expected_cols = {
            "astronaut_id", "callsign", "mission_id", "crew_role",
            "baseline_calibrated_at", "baseline_parameters",
            "resting_hr", "resting_rmssd", "resting_spo2", "resting_temp",
            "circadian_phase_shift_hours", "baseline_window_days", "calibration_status",
        }
        assert expected_cols.issubset(cols)

    # Verify existing V1 record preserved with correct defaults
    retrieved = mgr.get_astronaut("ASTRO-99")
    assert retrieved is not None
    assert retrieved.callsign == "Old Timer"
    assert retrieved.resting_hr == 65.0
    assert retrieved.resting_rmssd == 55.0
    assert retrieved.resting_spo2 == 98.0
    assert retrieved.resting_temp == 37.0
    assert retrieved.circadian_phase_shift_hours == 0.0
    assert retrieved.baseline_window_days == 7
    assert retrieved.calibration_status == CalibrationStatus.CALIBRATING


def test_authoritative_cohort_seeding(temp_db):
    """Verifies pre-seeding of the 3 authoritative cohort astronaut profiles and stream_sim_hrv."""
    astronauts = {a.astronaut_id: a for a in temp_db.list_astronauts()}
    assert "ASTRO-01" in astronauts
    assert "ASTRO-02" in astronauts
    assert "ASTRO-03" in astronauts

    a1 = astronauts["ASTRO-01"]
    assert a1.callsign == "CDR M. Vance"
    assert a1.crew_role == "Commander"
    assert a1.resting_hr == 65.0
    assert a1.resting_rmssd == 55.0
    assert a1.resting_spo2 == 98.0
    assert a1.resting_temp == 37.0
    assert a1.circadian_phase_shift_hours == 0.0
    assert a1.baseline_window_days == 7
    assert a1.calibration_status == CalibrationStatus.CALIBRATING

    a2 = astronauts["ASTRO-02"]
    assert a2.callsign == "FE-1 Dr. S. Patel"
    assert a2.crew_role == "Flight Engineer"
    assert a2.resting_hr == 52.0
    assert a2.resting_rmssd == 75.0
    assert a2.resting_spo2 == 98.5
    assert a2.resting_temp == 36.8
    assert a2.circadian_phase_shift_hours == -1.0
    assert a2.baseline_window_days == 7
    assert a2.calibration_status == CalibrationStatus.CALIBRATING

    a3 = astronauts["ASTRO-03"]
    assert a3.callsign == "MS-1 K. Lindgren"
    assert a3.crew_role == "Mission Specialist"
    assert a3.resting_hr == 72.0
    assert a3.resting_rmssd == 38.0
    assert a3.resting_spo2 == 97.8
    assert a3.resting_temp == 37.1
    assert a3.circadian_phase_shift_hours == 1.5
    assert a3.baseline_window_days == 7
    assert a3.calibration_status == CalibrationStatus.CALIBRATING

    # Check HRV stream registration
    with temp_db.get_connection() as conn:
        row = conn.execute("SELECT * FROM telemetry_streams WHERE stream_id = 'stream_sim_hrv';").fetchone()
        assert row is not None
        assert row["metric_name"] == "rmssd"
        assert row["metric_category"] == "PHYSIOLOGICAL"
        assert row["unit"] == "ms"
        assert row["nominal_min"] == 15.0
        assert row["nominal_max"] == 140.0


def test_astronaut_crud_all_13_columns(temp_db):
    """Verifies insert_astronaut and get_astronaut persist and retrieve all 13 columns."""
    custom_astro = Astronaut(
        astronaut_id="ASTRO-04",
        callsign="PLT T. Jones",
        mission_id="ISS-EXP-71",
        crew_role="Pilot",
        baseline_calibrated_at="2026-06-01T12:00:00Z",
        baseline_parameters='{"custom": true}',
        resting_hr=58.0,
        resting_rmssd=82.0,
        resting_spo2=99.0,
        resting_temp=36.7,
        circadian_phase_shift_hours=-2.5,
        baseline_window_days=14,
        calibration_status=CalibrationStatus.CALIBRATED,
    )
    temp_db.insert_astronaut(custom_astro)

    retrieved = temp_db.get_astronaut("ASTRO-04")
    assert retrieved is not None
    assert retrieved.astronaut_id == "ASTRO-04"
    assert retrieved.callsign == "PLT T. Jones"
    assert retrieved.mission_id == "ISS-EXP-71"
    assert retrieved.crew_role == "Pilot"
    assert retrieved.baseline_calibrated_at == "2026-06-01T12:00:00Z"
    assert retrieved.baseline_parameters == '{"custom": true}'
    assert retrieved.resting_hr == 58.0
    assert retrieved.resting_rmssd == 82.0
    assert retrieved.resting_spo2 == 99.0
    assert retrieved.resting_temp == 36.7
    assert retrieved.circadian_phase_shift_hours == -2.5
    assert retrieved.baseline_window_days == 14
    assert retrieved.calibration_status == CalibrationStatus.CALIBRATED
    assert isinstance(retrieved.calibration_status, CalibrationStatus)


def test_get_measurements_df_astronaut_filtering(temp_db):
    """Verifies get_measurements_df filters correctly when astronaut_ids is provided."""
    df = pd.DataFrame({
        "stream_id": ["stream_sim_hr", "stream_sim_hr", "stream_eda_co2"],
        "astronaut_id": ["ASTRO-01", "ASTRO-02", None],
        "timestamp": [
            "2026-07-01T00:00:00Z",
            "2026-07-01T00:00:00Z",
            "2026-07-01T00:00:00Z",
        ],
        "value": [65.0, 52.0, 3.2],
        "quality_status": ["VALID", "VALID", "VALID"],
        "is_synthetic": [True, True, False],
    })
    temp_db.insert_measurements_df(df)

    # Filter for ASTRO-01: should return ASTRO-01 and environmental (None), but NOT ASTRO-02
    res_a1 = temp_db.get_measurements_df(
        stream_ids=["stream_sim_hr", "stream_eda_co2"],
        astronaut_ids=["ASTRO-01"],
    )
    assert len(res_a1) == 2
    assert set(res_a1["astronaut_id"].dropna()) == {"ASTRO-01"}
    assert "ASTRO-02" not in res_a1["astronaut_id"].values

    # Filter for ASTRO-02
    res_a2 = temp_db.get_measurements_df(
        stream_ids=["stream_sim_hr"],
        astronaut_ids=["ASTRO-02"],
    )
    assert len(res_a2) == 1
    assert res_a2.iloc[0]["astronaut_id"] == "ASTRO-02"

    # Filter for both ASTRO-01 and ASTRO-02
    res_both = temp_db.get_measurements_df(
        stream_ids=["stream_sim_hr"],
        astronaut_ids=["ASTRO-01", "ASTRO-02"],
    )
    assert len(res_both) == 2
    assert set(res_both["astronaut_id"]) == {"ASTRO-01", "ASTRO-02"}

    # Empty astronaut_ids returns empty df
    res_empty = temp_db.get_measurements_df(
        stream_ids=["stream_sim_hr"],
        astronaut_ids=[],
    )
    assert len(res_empty) == 0


def test_v3_schema_created_on_fresh_database(temp_db):
    """WAYFINDER-V3-002 Acceptance Test: fresh DB gains vector, archetype and audit tables."""
    expected_columns = {
        "research_vectors": {
            "chunk_id": "TEXT",
            "doc_id": "TEXT",
            "title": "TEXT",
            "authors": "TEXT",
            "report_identifier": "TEXT",
            "section_heading": "TEXT",
            "content": "TEXT",
            "doi_citation": "TEXT",
            "source_repository": "TEXT",
            "embedding": "BLOB",
            "embedding_model": "TEXT",
            "corpus_type": "TEXT",
            "rule_id": "TEXT",
            "sha256_hash": "TEXT",
        },
        "event_archetype_vectors": {
            "archetype_id": "TEXT",
            "description": "TEXT",
            "embedding": "BLOB",
        },
        "assistant_audit_logs": {
            "log_id": "TEXT",
            "event_id": "TEXT",
            "astronaut_id": "TEXT",
            "query_text": "TEXT",
            "retrieval_mode": "TEXT",
            "generation_mode": "TEXT",
            "response_text": "TEXT",
            "cited_doc_ids": "TEXT",
            "tripwire_triggered": "BOOLEAN",
            "latency_ms": "REAL",
            "created_at": "TIMESTAMP",
            "trace_id": "TEXT",
            "flight_rule_cited": "TEXT",
            "rule_sha256": "TEXT",
            "stt_confidence": "REAL",
            "stt_duration_sec": "REAL",
            "tripwire_match_term": "TEXT",
            "provider_used": "TEXT",
        },
    }
    primary_keys = {
        "research_vectors": "chunk_id",
        "event_archetype_vectors": "archetype_id",
        "assistant_audit_logs": "log_id",
    }

    with temp_db.get_connection() as conn:
        tables = {
            row["name"]
            for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table';").fetchall()
        }
        assert set(expected_columns).issubset(tables), f"Missing V3 tables: {set(expected_columns) - tables}"

        for table, expected in expected_columns.items():
            actual = {
                row["name"]: row["type"]
                for row in conn.execute(f"PRAGMA table_info({table});").fetchall()
            }
            assert actual == expected, f"{table} columns mismatch: {actual}"

        for table, pk_column in primary_keys.items():
            pk_cols = [
                row["name"]
                for row in conn.execute(f"PRAGMA table_info({table});").fetchall()
                if row["pk"] == 1
            ]
            assert pk_cols == [pk_column], f"{table} primary key mismatch: {pk_cols}"

        health_events_cols = {
            row["name"]: row["type"]
            for row in conn.execute("PRAGMA table_info(health_events);").fetchall()
        }
        assert health_events_cols.get("peak_deviation_sigma") == "REAL"

        indexes = {
            row["name"]
            for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'index';").fetchall()
        }
        assert {"idx_vectors_doc", "idx_audit_astronaut"}.issubset(indexes), indexes


def test_assistant_audit_log_constraints_and_defaults(temp_db):
    """WAYFINDER-V3-002 Acceptance Test: audit log enforces mode CHECKs and tripwire default."""
    insert_sql = """
    INSERT INTO assistant_audit_logs (
        log_id, event_id, astronaut_id, query_text, retrieval_mode,
        generation_mode, response_text, cited_doc_ids, tripwire_triggered,
        latency_ms, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """
    with temp_db.get_connection() as conn:
        conn.execute(insert_sql, (
            "LOG-001", None, None, "CO2 headache evidence",
            "HYBRID_RRF", "EXTRACTIVE_FALLBACK", "Evidence summary",
            '["HRR-CO2-001"]', 0, 12.5, "2026-07-01T00:00:00Z",
        ))
        row = conn.execute(
            "SELECT tripwire_triggered FROM assistant_audit_logs WHERE log_id = 'LOG-001';"
        ).fetchone()
        assert row["tripwire_triggered"] == 0

    invalid_modes = [
        ("BAD-RETRIEVAL", "INVALID_MODE", "EXTRACTIVE_FALLBACK"),
        ("BAD-GENERATION", "HYBRID_RRF", "TEMPLATE_ONLY"),
    ]
    for log_id, retrieval_mode, generation_mode in invalid_modes:
        with pytest.raises(sqlite3.IntegrityError):
            with temp_db.get_connection() as conn:
                conn.execute(insert_sql, (
                    log_id, None, None, "invalid mode",
                    retrieval_mode, generation_mode, "n/a",
                    "[]", 0, 1.0, "2026-07-01T00:00:00Z",
                ))


def test_v3_migration_on_v2_database_is_idempotent(tmp_path):
    """WAYFINDER-V3-002 Acceptance Test: V2 DB gains V3 schema without data loss on repeated init."""
    from wayfinder.core.storage import StorageManager

    db_path = str(tmp_path / "v2_mission.db")
    conn = sqlite3.connect(db_path)
    conn.executescript("""
    CREATE TABLE astronauts (
        astronaut_id TEXT PRIMARY KEY,
        callsign TEXT NOT NULL,
        mission_id TEXT NOT NULL,
        crew_role TEXT NOT NULL,
        baseline_calibrated_at TIMESTAMP,
        baseline_parameters TEXT,
        resting_hr REAL DEFAULT 65.0,
        resting_rmssd REAL DEFAULT 55.0,
        resting_spo2 REAL DEFAULT 98.0,
        resting_temp REAL DEFAULT 37.0,
        circadian_phase_shift_hours REAL DEFAULT 0.0,
        baseline_window_days INTEGER DEFAULT 7,
        calibration_status TEXT DEFAULT 'CALIBRATING'
    );
    CREATE TABLE health_events (
        event_id TEXT PRIMARY KEY,
        astronaut_id TEXT NOT NULL REFERENCES astronauts(astronaut_id),
        event_type TEXT NOT NULL,
        severity_level TEXT NOT NULL CHECK(severity_level IN ('INFO', 'OBSERVE', 'INVESTIGATE')),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        contributing_stream_ids TEXT NOT NULL,
        symptom_report_id TEXT REFERENCES symptom_reports(report_id),
        rationale TEXT NOT NULL,
        uncertainty_level TEXT NOT NULL CHECK(uncertainty_level IN ('LOW', 'MODERATE', 'HIGH')),
        review_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(review_status IN ('PENDING', 'ACKNOWLEDGED', 'RESOLVED')),
        review_notes TEXT
    );
    INSERT INTO astronauts (astronaut_id, callsign, mission_id, crew_role)
    VALUES ('ASTRO-99', 'V2 Veteran', 'ISS-EXP-70', 'Commander');
    INSERT INTO health_events (
        event_id, astronaut_id, event_type, severity_level, start_time, end_time,
        contributing_stream_ids, symptom_report_id, rationale, uncertainty_level
    ) VALUES (
        'EVT-V2-LEGACY', 'ASTRO-99', 'ENVIRONMENTAL_SPIKE_COOCCURRENCE', 'OBSERVE',
        '2026-06-01T00:00:00Z', '2026-06-01T02:00:00Z', 'stream_eda_co2', NULL,
        'Pre-existing V2 event retained across migration.', 'MODERATE'
    );
    """)
    conn.commit()
    conn.close()

    mgr = StorageManager(db_path=db_path)
    mgr.ensure_initialized()
    mgr.ensure_initialized()

    with mgr.get_connection() as c:
        cols = {
            row["name"]: row["type"]
            for row in c.execute("PRAGMA table_info(health_events);").fetchall()
        }
        assert cols.get("peak_deviation_sigma") == "REAL"

        rows = c.execute(
            "SELECT event_id, rationale, peak_deviation_sigma FROM health_events;"
        ).fetchall()
        assert len(rows) == 1
        assert rows[0]["event_id"] == "EVT-V2-LEGACY"
        assert rows[0]["rationale"] == "Pre-existing V2 event retained across migration."
        assert rows[0]["peak_deviation_sigma"] is None

        tables = {
            row["name"]
            for row in c.execute("SELECT name FROM sqlite_master WHERE type = 'table';").fetchall()
        }
        assert {"research_vectors", "event_archetype_vectors", "assistant_audit_logs"}.issubset(tables)

    assert mgr.get_astronaut("ASTRO-99").callsign == "V2 Veteran"


def test_fresh_database_seeds_research_vectors_and_archetypes(temp_db):
    """WAYFINDER-V3-003: a fresh database is cold-start ready with bundled vectors."""
    with temp_db.get_connection() as conn:
        chunks = conn.execute("SELECT * FROM research_vectors;").fetchall()
        archetypes = conn.execute("SELECT * FROM event_archetype_vectors;").fetchall()

    assert len(chunks) == 13
    assert len(archetypes) == 4
    assert {row["archetype_id"] for row in archetypes} == {
        "ARCHETYPE_CO2_HYPERCAPNIA_VITAL_SHIFT",
        "ARCHETYPE_AUTONOMIC_WORKOUT_FATIGUE",
        "ARCHETYPE_THERMAL_ENVIRONMENTAL_STRESS",
        "ARCHETYPE_GENERIC_PHYSIOLOGICAL_EXCURSION",
    }
    for row in chunks:
        assert len(row["embedding"]) == 384 * 4
        assert row["embedding_model"] == "all-minilm"


def test_seed_research_vectors_is_idempotent(temp_db):
    """WAYFINDER-V3-003: repeated initialization never duplicates vector rows."""
    temp_db.seed_research_vectors_if_empty()
    temp_db.seed_research_vectors_if_empty()
    temp_db.ensure_initialized()

    with temp_db.get_connection() as conn:
        chunk_count = conn.execute("SELECT COUNT(*) FROM research_vectors;").fetchone()[0]
        archetype_count = conn.execute("SELECT COUNT(*) FROM event_archetype_vectors;").fetchone()[0]

    assert chunk_count == 13
    assert archetype_count == 4


def test_seed_asset_contains_384_dimension_float_vectors():
    """WAYFINDER-V3-003: the checked-in seed asset matches the 384-d contract."""
    seed_path = Path(__file__).resolve().parents[1] / "data" / "research_embeddings_seed.json"
    payload = json.loads(seed_path.read_text(encoding="utf-8"))

    assert len(payload["chunks"]) == 13
    assert len(payload["archetypes"]) == 4
    for item in payload["chunks"]:
        assert len(item["embedding"]) == 384
        assert all(isinstance(value, float) for value in item["embedding"])
    for item in payload["archetypes"]:
        assert len(item["embedding"]) == 384


def test_get_health_event_returns_typed_event_or_none(temp_db):
    """WAYFINDER-V3-003: get_health_event returns a typed model or None."""
    event = HealthEvent(
        event_id="EVT-LOOKUP-1",
        astronaut_id="ASTRO-01",
        event_type="MULTI_SIGNAL_CONCORDANCE",
        severity_level=SeverityLevel.INVESTIGATE,
        start_time="2026-07-08T02:00:00Z",
        end_time="2026-07-08T02:30:00Z",
        contributing_stream_ids="stream_eda_co2,stream_sim_hr,stream_sim_hrv",
        rationale="Temporal co-occurrence across environment, autonomic tone, and crew report.",
        uncertainty_level=UncertaintyLevel.LOW,
        peak_deviation_sigma=2.8,
    )
    temp_db.insert_health_event(event)

    loaded = temp_db.get_health_event("EVT-LOOKUP-1")
    assert loaded is not None
    assert loaded.event_id == "EVT-LOOKUP-1"
    assert loaded.severity_level is SeverityLevel.INVESTIGATE
    assert loaded.peak_deviation_sigma == pytest.approx(2.8)
    assert temp_db.get_health_event("EVT-MISSING") is None


def test_insert_assistant_audit_log_allows_nullable_scope(temp_db):
    """WAYFINDER-V3-003: audit logs persist with null event/astronaut scope."""
    log = AssistantAuditLog(
        log_id=str(uuid.uuid4()),
        event_id=None,
        astronaut_id=None,
        query_text="CO2 headache literature search",
        retrieval_mode="LEXICAL_BM25",
        generation_mode="EXTRACTIVE_FALLBACK",
        response_text="Extractive evidence summary.",
        cited_doc_ids='["HRR-CO2-001"]',
        tripwire_triggered=True,
        latency_ms=3.5,
        created_at="2026-07-08T03:00:00Z",
    )
    temp_db.insert_assistant_audit_log(log)

    with temp_db.get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM assistant_audit_logs WHERE log_id = ?;", (log.log_id,)
        ).fetchone()

    assert row is not None
    assert row["event_id"] is None
    assert row["astronaut_id"] is None
    assert row["tripwire_triggered"] == 1
    assert row["latency_ms"] == pytest.approx(3.5)


def test_flight_rules_table_and_crud(temp_db):
    """TICK-01: Verifies flight rules table creation and CRUD operations."""
    rule = FlightRule(
        rule_id="FR-ECLSS-001",
        title="Elevated Cabin Carbon Dioxide Mitigation",
        subsystem="ECLSS / CDRA",
        revision_date="2026-04-15",
        severity_trigger=SeverityTrigger.INVESTIGATE,
        condition_threshold="P_CO2 >= 4.0 mmHg for > 30 min",
        verbatim_text="# FR-ECLSS-001 Verbatim Content",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        checklist_steps=[
            ChecklistStep(
                step_number=1,
                action="Transition CDRA Bed Selector to DUAL-BED HIGH-FLOW",
                target_subsystem="CDRA-ECLSS",
                verification="Telemetry CDRA_STATE == 0x04",
                caution_warning="Ensure vacuum desorb valve V12 is open before switching",
            ),
            ChecklistStep(
                step_number=2,
                action="Verify cabin ventilation fans running at nominal rate",
                target_subsystem="NOD2-VENT",
                verification="Flow rate >= 55 CFM",
                caution_warning="High acoustic noise (>62 dBA)",
            ),
        ],
        reference_docs=["NASA-STD-3001 Vol 2", "SSP 50260 Section 4.2"],
    )
    temp_db.insert_flight_rule(rule)

    loaded = temp_db.get_flight_rule("FR-ECLSS-001")
    assert loaded is not None
    assert loaded.rule_id == "FR-ECLSS-001"
    assert loaded.title == "Elevated Cabin Carbon Dioxide Mitigation"
    assert loaded.subsystem == "ECLSS / CDRA"
    assert loaded.severity_trigger == SeverityTrigger.INVESTIGATE
    assert len(loaded.checklist_steps) == 2
    assert loaded.checklist_steps[0].step_number == 1
    assert loaded.checklist_steps[0].target_subsystem == "CDRA-ECLSS"
    assert len(loaded.reference_docs) == 2
    assert loaded.sha256_hash == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

    # Test filtering
    filtered_subsystem = temp_db.list_flight_rules(subsystem="ECLSS / CDRA")
    assert len(filtered_subsystem) == 1
    assert filtered_subsystem[0].rule_id == "FR-ECLSS-001"

    filtered_empty = temp_db.list_flight_rules(subsystem="NON_EXISTENT")
    assert len(filtered_empty) == 0

    filtered_severity = temp_db.list_flight_rules(severity="INVESTIGATE")
    assert len(filtered_severity) == 1


def test_assistant_audit_log_persists_extended_telemetry(temp_db):
    """TICK-01: Verifies audit log persistence with the 7 new telemetry columns."""
    log_id = str(uuid.uuid4())
    log = AssistantAuditLog(
        log_id=log_id,
        event_id=None,
        astronaut_id="ASTRO-01",
        query_text="Check hypercapnia flight rule",
        retrieval_mode="HYBRID_RRF",
        generation_mode="EXTRACTIVE_FALLBACK",
        response_text="Latched rule FR-ECLSS-001",
        cited_doc_ids="FR-ECLSS-001",
        tripwire_triggered=False,
        latency_ms=12.4,
        created_at="2026-11-14T12:00:00Z",
        trace_id="trace-test-uuid-123",
        flight_rule_cited="FR-ECLSS-001",
        rule_sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        stt_confidence=0.96,
        stt_duration_sec=3.2,
        tripwire_match_term=None,
        provider_used="extractive-synthesizer",
    )
    temp_db.insert_assistant_audit_log(log)

    with temp_db.get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM assistant_audit_logs WHERE log_id = ?;", (log_id,)
        ).fetchone()

    assert row is not None
    assert row["trace_id"] == "trace-test-uuid-123"
    assert row["flight_rule_cited"] == "FR-ECLSS-001"
    assert row["rule_sha256"] == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    assert row["stt_confidence"] == pytest.approx(0.96)
    assert row["stt_duration_sec"] == pytest.approx(3.2)
    assert row["tripwire_match_term"] is None
    assert row["provider_used"] == "extractive-synthesizer"


def test_research_vectors_and_audit_migrations(temp_db):
    """TICK-01: Verifies non-destructive ALTER TABLE migration columns."""
    with temp_db.get_connection() as conn:
        vector_cols = {row["name"] for row in conn.execute("PRAGMA table_info(research_vectors);").fetchall()}
        audit_cols = {row["name"] for row in conn.execute("PRAGMA table_info(assistant_audit_logs);").fetchall()}

    assert "corpus_type" in vector_cols
    assert "rule_id" in vector_cols
    assert "sha256_hash" in vector_cols

    assert "trace_id" in audit_cols
    assert "flight_rule_cited" in audit_cols
    assert "rule_sha256" in audit_cols
    assert "stt_confidence" in audit_cols
    assert "stt_duration_sec" in audit_cols
    assert "tripwire_match_term" in audit_cols
    assert "provider_used" in audit_cols
