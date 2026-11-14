"""
tests/test_api.py: FastAPI application integration tests for WAYFINDER V3.
"""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import wayfinder.api.server as server_module
from wayfinder.api.server import create_app


@pytest.fixture
def api_client(temp_db):
    """Provides a TestClient bound to an isolated temporary database."""
    app = create_app(storage=temp_db)
    with TestClient(app) as client:
        yield client


def test_app_metadata_and_lifespan_storage(api_client, temp_db):
    """WAYFINDER-V3-013: app boots with the injected storage and V3 identity."""
    assert api_client.app.title == "WAYFINDER Mission Health API"
    assert api_client.app.version == "3.0.0"
    assert api_client.app.state.storage is temp_db
    assert api_client.app.state.vector_store is not None


def test_root_returns_diagnostic_json_when_spa_uncompiled(
    api_client, tmp_path, monkeypatch
):
    """WAYFINDER-V3-013: an uncompiled SPA yields a diagnostic JSON guide."""
    monkeypatch.setattr(server_module, "WEB_DIST_DIR", tmp_path / "missing-dist")
    monkeypatch.setattr(server_module, "WEB_INDEX_FILE", tmp_path / "missing-dist" / "index.html")

    response = api_client.get("/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "WAYFINDER V3 API Online"
    assert "npm run build" in payload["message"]


def test_unknown_api_route_returns_json_404(api_client):
    """WAYFINDER-V3-013: the SPA catch-all never swallows /api routes."""
    response = api_client.get("/api/does-not-exist")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")


def test_cors_preflight_allows_cross_origin(api_client):
    """WAYFINDER-V3-013: CORS middleware admits the Vite dev origin."""
    response = api_client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") in {"*", "http://localhost:5173"}


@pytest.fixture
def seeded_api_client(temp_db):
    """TestClient with Day-127-style telemetry, an event, and a symptom report."""
    import pandas as pd

    from wayfinder.core.models import (
        HealthEvent,
        SeverityLevel,
        UncertaintyLevel,
    )

    rows = []
    for minute in range(0, 40, 5):
        timestamp = f"2026-07-08T02:{minute:02d}:00Z"
        rows.extend(
            [
                {
                    "stream_id": "stream_eda_co2",
                    "astronaut_id": None,
                    "timestamp": timestamp,
                    "value": 2.5 + minute / 100.0,
                    "quality_status": "VALID",
                    "is_synthetic": False,
                },
                {
                    "stream_id": "stream_sim_hr",
                    "astronaut_id": "ASTRO-01",
                    "timestamp": timestamp,
                    "value": 65.0 + minute,
                    "quality_status": "VALID",
                    "is_synthetic": True,
                },
                {
                    "stream_id": "stream_sim_hr",
                    "astronaut_id": "ASTRO-02",
                    "timestamp": timestamp,
                    "value": 52.0,
                    "quality_status": "VALID",
                    "is_synthetic": True,
                },
            ]
        )
    temp_db.insert_measurements_df(pd.DataFrame(rows))
    temp_db.insert_health_event(
        HealthEvent(
            event_id="EVT-API-CO2",
            astronaut_id="ASTRO-01",
            event_type="MULTI_SIGNAL_CONCORDANCE",
            severity_level=SeverityLevel.INVESTIGATE,
            start_time="2026-07-08T02:05:00Z",
            end_time="2026-07-08T02:25:00Z",
            contributing_stream_ids="stream_eda_co2,stream_sim_hr,stream_sim_hrv",
            rationale="Temporal co-occurrence only; flight-surgeon verification required.",
            uncertainty_level=UncertaintyLevel.LOW,
            peak_deviation_sigma=2.8,
        )
    )
    temp_db.insert_health_event(
        HealthEvent(
            event_id="EVT-API-INFO",
            astronaut_id="ASTRO-01",
            event_type="ROUTINE_EXERCISE_TRANSIENT",
            severity_level=SeverityLevel.INFO,
            start_time="2026-07-08T14:00:00Z",
            end_time="2026-07-08T15:30:00Z",
            contributing_stream_ids="stream_sim_hr,stream_sim_hrv",
            rationale="Routine countermeasure workout transient.",
            uncertainty_level=UncertaintyLevel.LOW,
        )
    )

    from wayfinder.core.rag import index_research_corpus

    index_research_corpus("data/research_corpus", temp_db)

    app = create_app(storage=temp_db)
    with TestClient(app) as client:
        yield client


def test_health_reports_vector_store_ready(api_client):
    """WAYFINDER-V3-014: /api/health exposes version and vector chunk count."""
    response = api_client.get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["version"] == "3.0.0"
    assert payload["vector_store_chunks"] == 13
    assert payload["ollama_online"] is False


def test_astronaut_endpoints_return_cohort_and_404(api_client):
    """WAYFINDER-V3-014: astronaut listing and lookup are cohort scoped."""
    listing = api_client.get("/api/astronauts")
    assert listing.status_code == 200
    assert {item["astronaut_id"] for item in listing.json()} == {
        "ASTRO-01",
        "ASTRO-02",
        "ASTRO-03",
    }

    profile = api_client.get("/api/astronauts/ASTRO-02")
    assert profile.status_code == 200
    assert profile.json()["resting_hr"] == pytest.approx(52.0)

    assert api_client.get("/api/astronauts/ASTRO-99").status_code == 404


def test_measurements_are_cohort_scoped(seeded_api_client):
    """WAYFINDER-V3-014: telemetry never leaks another astronaut's vitals."""
    response = seeded_api_client.get(
        "/api/telemetry/measurements",
        params={"astronaut_id": "ASTRO-01", "window_hours": 72, "max_points": 1000},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload
    assert {item["stream_id"] for item in payload} == {"stream_eda_co2", "stream_sim_hr"}
    assert all(
        item["astronaut_id"] in {None, "ASTRO-01"} for item in payload
    )
    assert all(item["astronaut_id"] != "ASTRO-02" for item in payload)


def test_measurements_respect_max_points_decimation(seeded_api_client):
    """WAYFINDER-V3-014: LTTB caps each stream at max_points."""
    response = seeded_api_client.get(
        "/api/telemetry/measurements",
        params={"astronaut_id": "ASTRO-01", "window_hours": 72, "max_points": 3},
    )

    assert response.status_code == 200
    by_stream = {}
    for item in response.json():
        by_stream.setdefault(item["stream_id"], 0)
        by_stream[item["stream_id"]] += 1
    assert by_stream
    assert all(count <= 3 for count in by_stream.values())


def test_baselines_return_hourly_envelopes(seeded_api_client):
    """WAYFINDER-V3-014: baseline envelopes expose mu +/- 2 sigma bounds."""
    response = seeded_api_client.get(
        "/api/telemetry/baselines", params={"astronaut_id": "ASTRO-01"}
    )

    assert response.status_code == 200
    payload = response.json()
    assert "stream_sim_hr" in payload
    hour = payload["stream_sim_hr"][0]
    assert hour["hour_bin"] == 2
    assert hour["lower"] < hour["mean"] < hour["upper"]
    assert hour["sample_count"] > 0


def test_events_filter_by_cohort_and_severity(seeded_api_client):
    """WAYFINDER-V3-014: event filters compose cohort and severity scoping."""
    all_events = seeded_api_client.get("/api/events", params={"astronaut_id": "ASTRO-01"})
    assert all_events.status_code == 200
    assert len(all_events.json()) == 2

    investigate = seeded_api_client.get(
        "/api/events", params={"astronaut_id": "ASTRO-01", "severity": "investigate"}
    )
    assert investigate.status_code == 200
    assert [item["event_id"] for item in investigate.json()] == ["EVT-API-CO2"]

    invalid = seeded_api_client.get("/api/events", params={"severity": "CRITICAL"})
    assert invalid.status_code == 422


def test_event_review_updates_and_missing_returns_404(seeded_api_client):
    """WAYFINDER-V3-014: review updates persist, missing events return 404."""
    response = seeded_api_client.post(
        "/api/events/EVT-API-CO2/review",
        json={"review_status": "ACKNOWLEDGED", "review_notes": "Reviewed by CMO."},
    )
    assert response.status_code == 200
    assert response.json()["review_status"] == "ACKNOWLEDGED"
    assert response.json()["review_notes"] == "Reviewed by CMO."

    missing = seeded_api_client.post(
        "/api/events/EVT-MISSING/review",
        json={"review_status": "RESOLVED"},
    )
    assert missing.status_code == 404


def test_symptom_submission_and_validation(seeded_api_client):
    """WAYFINDER-V3-014: structured symptom reports persist and validate severity."""
    created = seeded_api_client.post(
        "/api/symptoms",
        json={
            "astronaut_id": "ASTRO-01",
            "symptom_code": "HEADACHE",
            "severity": 3,
            "cabin_module": "Node 2",
            "notes": "Frontal pressure after CO2 excursion.",
        },
    )
    assert created.status_code == 201
    report = created.json()
    assert report["symptom_code"] == "HEADACHE"
    assert report["severity"] == 3

    listing = seeded_api_client.get("/api/symptoms", params={"astronaut_id": "ASTRO-01"})
    assert listing.status_code == 200
    assert any(item["report_id"] == report["report_id"] for item in listing.json())

    invalid_severity = seeded_api_client.post(
        "/api/symptoms",
        json={"astronaut_id": "ASTRO-01", "symptom_code": "NAUSEA", "severity": 0},
    )
    assert invalid_severity.status_code == 422

    missing_astronaut = seeded_api_client.post(
        "/api/symptoms",
        json={"astronaut_id": "ASTRO-99", "symptom_code": "NAUSEA", "severity": 2},
    )
    assert missing_astronaut.status_code == 404


def _force_offline_ollama(monkeypatch):
    async def _offline(*args, **kwargs):
        return False

    monkeypatch.setattr("wayfinder.core.assistant.is_ollama_available", _offline)


def test_assistant_explain_returns_citations_and_audit_row(
    seeded_api_client, temp_db, monkeypatch
):
    """WAYFINDER-V3-015: 1-click explain cites NASA literature and logs the audit trail."""
    _force_offline_ollama(monkeypatch)

    response = seeded_api_client.post(
        "/api/assistant/explain",
        json={"event_id": "EVT-API-CO2", "astronaut_id": "ASTRO-01"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "EXTRACTIVE_FALLBACK"
    assert payload["event_id"] == "EVT-API-CO2"
    assert payload["astronaut_id"] == "ASTRO-01"
    assert payload["cited_evidence"]
    assert payload["cited_evidence"][0]["doc_id"] == "HRR-CO2-001"
    assert "[HRR-CO2-001:" in payload["scientific_context"]
    assert payload["disclaimer"]
    assert payload["study_caveats"]

    with temp_db.get_connection() as conn:
        logs = conn.execute("SELECT * FROM assistant_audit_logs;").fetchall()
    assert len(logs) == 1
    assert logs[0]["event_id"] == "EVT-API-CO2"
    assert logs[0]["astronaut_id"] == "ASTRO-01"
    assert logs[0]["retrieval_mode"] == "HYBRID_RRF"
    assert logs[0]["generation_mode"] == "EXTRACTIVE_FALLBACK"
    assert "HRR-CO2-001" in logs[0]["cited_doc_ids"]
    assert logs[0]["tripwire_triggered"] == 0


def test_assistant_explain_missing_event_returns_404(seeded_api_client):
    """WAYFINDER-V3-015: unknown events return HTTP 404 without audit noise."""
    response = seeded_api_client.post(
        "/api/assistant/explain",
        json={"event_id": "EVT-MISSING", "astronaut_id": "ASTRO-01"},
    )

    assert response.status_code == 404


def test_assistant_explain_enforces_cohort_ownership(seeded_api_client, temp_db):
    """WAYFINDER-V3-015/019: an event cannot be explained under another cohort."""
    response = seeded_api_client.post(
        "/api/assistant/explain",
        json={"event_id": "EVT-API-CO2", "astronaut_id": "ASTRO-02"},
    )

    assert response.status_code == 404
    with temp_db.get_connection() as conn:
        assert (
            conn.execute("SELECT COUNT(*) FROM assistant_audit_logs;").fetchone()[0] == 0
        )


def test_assistant_rejects_unregistered_astronaut(seeded_api_client):
    """WAYFINDER-V3-015: unknown cohort ids return 404, not an FK integrity error."""
    explain = seeded_api_client.post(
        "/api/assistant/explain",
        json={"event_id": "EVT-API-CO2", "astronaut_id": "ASTRO-99"},
    )
    assert explain.status_code == 404

    query = seeded_api_client.post(
        "/api/assistant/query",
        json={"query": "cabin CO2 headache", "astronaut_id": "ASTRO-99"},
    )
    assert query.status_code == 404


def test_assistant_query_cites_evidence_with_and_without_cohort(
    seeded_api_client, temp_db, monkeypatch
):
    """WAYFINDER-V3-015: ad-hoc research queries work with optional astronaut scoping."""
    _force_offline_ollama(monkeypatch)

    anonymous = seeded_api_client.post(
        "/api/assistant/query",
        json={"query": "cabin CO2 headache", "top_k": 5},
    )
    assert anonymous.status_code == 200
    assert anonymous.json()["cited_evidence"][0]["doc_id"] == "HRR-CO2-001"
    assert anonymous.json()["event_id"] is None

    scoped = seeded_api_client.post(
        "/api/assistant/query",
        json={
            "query": "radiation cardiovascular biomarker",
            "top_k": 3,
            "astronaut_id": "ASTRO-02",
        },
    )
    assert scoped.status_code == 200
    assert scoped.json()["astronaut_id"] == "ASTRO-02"

    with temp_db.get_connection() as conn:
        logs = conn.execute(
            "SELECT * FROM assistant_audit_logs ORDER BY created_at;"
        ).fetchall()
    assert len(logs) == 2
    assert logs[0]["event_id"] is None
    assert logs[0]["astronaut_id"] is None
    assert logs[1]["astronaut_id"] == "ASTRO-02"


def test_assistant_query_rejects_blank_query(seeded_api_client):
    """WAYFINDER-V3-015: blank research queries are rejected."""
    response = seeded_api_client.post("/api/assistant/query", json={"query": "   "})
    assert response.status_code == 422


def test_spa_fallback_serves_compiled_index_for_deep_routes(
    api_client, tmp_path, monkeypatch
):
    """WAYFINDER-V3-016: compiled SPA assets serve index.html on deep routes."""
    dist = tmp_path / "dist"
    dist.mkdir()
    index = dist / "index.html"
    index.write_text("<html><body>WAYFINDER</body></html>", encoding="utf-8")
    (dist / "app.js").write_text("console.log('ok');", encoding="utf-8")

    monkeypatch.setattr(server_module, "WEB_DIST_DIR", dist)
    monkeypatch.setattr(server_module, "WEB_INDEX_FILE", index)

    root = api_client.get("/")
    assert root.status_code == 200
    assert "WAYFINDER" in root.text

    deep = api_client.get("/timeline")
    assert deep.status_code == 200
    assert "WAYFINDER" in deep.text

    asset = api_client.get("/app.js")
    assert asset.status_code == 200
    assert "console.log" in asset.text

    api_missing = api_client.get("/api/nope")
    assert api_missing.status_code == 404
    assert api_missing.headers["content-type"].startswith("application/json")
