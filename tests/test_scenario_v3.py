"""
tests/test_scenario_v3.py: Expedition 71 Day 120-134 mission scenario E2E
verification for WAYFINDER-V3-025.

Reuses the authoritative 14-day mission harness from `tests/test_scenario_v2.py`
and adds the V3 retrieval + assistant workflow:

- Day 127 Commander Vance cabin P_CO2 excursion (5.8 mmHg absolute, ≈2.8 mmHg
  above ambient) with the coincident autonomic shift.
- Tripartite concordance produces exactly one INVESTIGATE Health Event.
- 1-click `/api/assistant/explain` returns citation-grounded NASA evidence.
- The interaction is persisted in `assistant_audit_logs`.
- A causal generative response is intercepted by the epistemic guardrail and
  persisted with `tripwire_triggered = 1`.
"""

import json

import pytest
from fastapi.testclient import TestClient

import wayfinder.core.assistant as assistant_module
from wayfinder.api.server import create_app
from wayfinder.core.analytics import evaluate_exposure_events
from wayfinder.core.assistant import MANDATORY_DISCLAIMER
from wayfinder.core.baselines import (
    compute_circadian_hourly_bins,
    evaluate_measurement_deviations,
)
from wayfinder.core.models import SeverityLevel
from wayfinder.core.rag import index_research_corpus
from wayfinder.core.storage import StorageManager
from tests.test_scenario_v2 import (
    EXCURSION_CO2_MMHG,
    EXCURSION_MODULE,
    EXCURSION_TIMESTAMP,
    MISSION_START,
    provision_14day_mission_environment,
)


@pytest.fixture(scope="module")
def mission_environment(tmp_path_factory):
    """Provisions the 14-day Expedition 71 scenario once for the module."""
    db_path = tmp_path_factory.mktemp("wayfinder-v3-scenario") / "expedition71.db"
    storage = StorageManager(db_path=str(db_path))
    storage.ensure_initialized()
    provision_14day_mission_environment(storage)
    index_research_corpus("data/research_corpus", storage)

    events = evaluate_exposure_events("ASTRO-01", storage, window_hours=4.0)
    investigate = [
        event
        for event in events
        if event.severity_level == SeverityLevel.INVESTIGATE
    ]
    assert len(investigate) == 1, (
        f"Expected exactly 1 INVESTIGATE event, got {len(investigate)}"
    )
    return storage, investigate[0]


@pytest.fixture
def scenario_client(mission_environment):
    """TestClient bound to the provisioned mission database."""
    storage, event = mission_environment
    with TestClient(create_app(storage=storage)) as client:
        yield client, storage, event


def _audit_count(storage: StorageManager) -> int:
    with storage.get_connection() as conn:
        return int(conn.execute("SELECT COUNT(*) FROM assistant_audit_logs;").fetchone()[0])


def _latest_audit_row(storage: StorageManager):
    with storage.get_connection() as conn:
        return conn.execute(
            "SELECT * FROM assistant_audit_logs ORDER BY rowid DESC LIMIT 1;"
        ).fetchone()


def _force_offline_ollama(monkeypatch):
    async def _offline(*_args, **_kwargs):
        return False

    monkeypatch.setattr(assistant_module, "is_ollama_available", _offline)


class _CausalResponse:
    status_code = 200

    def __init__(self, payload: dict):
        self._payload = payload

    def json(self) -> dict:
        return self._payload

    def raise_for_status(self) -> None:
        return None


class _CausalAsyncClient:
    """Fake Ollama client that returns a prohibited causal narrative."""

    def __init__(self, *_args, **_kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, _url):
        return _CausalResponse({})

    async def post(self, _url, json=None):
        return _CausalResponse(
            {
                "response": json_module_dumps(
                    {
                        "headline": "Cabin CO2 caused Commander Vance's headache",
                        "observed_dynamics": "Elevated CO2 caused the acute headache.",
                        "scientific_context": "Prescribe supplemental oxygen.",
                        "study_caveats": [],
                    }
                )
            }
        )


def json_module_dumps(payload: dict) -> str:
    """Small indirection keeps the fake client body readable above."""
    return json.dumps(payload)


def test_day127_mission_environment_and_concordance(mission_environment):
    """WAYFINDER-V3-025: Day 127 excursion, vital shift, and tripartite event."""
    storage, event = mission_environment

    # --- Dataset scope: 3-person Expedition 71 cohort -----------------------
    astronauts = {item.astronaut_id for item in storage.list_astronauts()}
    assert astronauts == {"ASTRO-01", "ASTRO-02", "ASTRO-03"}

    # --- Day 127 cabin P_CO2 excursion -------------------------------------
    excursion = storage.get_measurements_df(
        stream_ids=["stream_eda_co2"],
        start_time=EXCURSION_TIMESTAMP,
        end_time=EXCURSION_TIMESTAMP,
    )
    assert len(excursion) == 1
    peak_co2 = float(excursion["value"].iloc[0])
    assert peak_co2 == pytest.approx(EXCURSION_CO2_MMHG, rel=1e-3)

    ambient = storage.get_measurements_df(
        stream_ids=["stream_eda_co2"],
        start_time=MISSION_START,
        end_time="2026-07-07T23:59:59Z",
    )
    ambient_median = float(ambient["value"].median())
    # The ticket narrates the excursion as a 2.8 mmHg rise; the harness models
    # a 5.8 mmHg absolute peak over a ~2.7-3.0 mmHg ambient cabin atmosphere.
    assert peak_co2 - ambient_median == pytest.approx(2.8, abs=0.35)
    assert EXCURSION_MODULE == "Node 2"

    # --- Coincident autonomic shift at 02:15 UTC ---------------------------
    astronaut = storage.get_astronaut("ASTRO-01")
    assert astronaut is not None
    baseline_frame = storage.get_measurements_df(
        stream_ids=["stream_sim_hr", "stream_sim_hrv"],
        start_time="2026-07-01T00:00:00Z",
        end_time="2026-07-08T02:00:00Z",
        astronaut_id="ASTRO-01",
    )
    baseline_bins = compute_circadian_hourly_bins(
        baseline_frame,
        astronaut,
        evaluation_time=EXCURSION_TIMESTAMP,
        window_days=7,
    )
    excursion_vitals = storage.get_measurements_df(
        stream_ids=["stream_sim_hr", "stream_sim_hrv"],
        start_time=EXCURSION_TIMESTAMP,
        end_time=EXCURSION_TIMESTAMP,
        astronaut_id="ASTRO-01",
    )
    deviations = evaluate_measurement_deviations(
        excursion_vitals, baseline_bins, astronaut
    )
    z_hr = float(
        deviations[deviations["stream_id"] == "stream_sim_hr"]["z_score"].iloc[0]
    )
    z_rmssd = float(
        deviations[deviations["stream_id"] == "stream_sim_hrv"]["z_score"].iloc[0]
    )
    assert z_hr >= 2.2, f"Expected Z_HR >= +2.2, got {z_hr:+.2f}"
    assert z_rmssd <= -2.1, f"Expected Z_RMSSD <= -2.1, got {z_rmssd:+.2f}"

    # --- Tripartite concordance -------------------------------------------
    assert event.astronaut_id == "ASTRO-01"
    assert event.severity_level == SeverityLevel.INVESTIGATE
    assert event.symptom_report_id == "SYM-DAY127-E2E"
    assert "stream_eda_co2" in event.contributing_stream_ids
    assert "stream_sim_hr" in event.contributing_stream_ids
    assert "stream_sim_hrv" in event.contributing_stream_ids
    assert "Temporal overlap indicates co-occurrence only" in event.rationale
    assert "WAYFINDER does not diagnose pathologies" in event.rationale

    stored = storage.get_health_event(event.event_id)
    assert stored is not None
    assert stored.severity_level == SeverityLevel.INVESTIGATE

    # --- Cohort isolation --------------------------------------------------
    for other in ("ASTRO-02", "ASTRO-03"):
        other_events = evaluate_exposure_events(other, storage, window_hours=4.0)
        assert not [
            candidate
            for candidate in other_events
            if candidate.severity_level == SeverityLevel.INVESTIGATE
        ]


def test_one_click_explain_returns_citations_and_persists_audit(
    scenario_client, monkeypatch
):
    """WAYFINDER-V3-025: 1-click explain cites HRR-CO2-001 and logs the audit."""
    client, storage, event = scenario_client
    _force_offline_ollama(monkeypatch)

    before = _audit_count(storage)
    response = client.post(
        "/api/assistant/explain",
        json={"event_id": event.event_id, "astronaut_id": "ASTRO-01"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "EXTRACTIVE_FALLBACK"
    assert payload["event_id"] == event.event_id
    assert payload["astronaut_id"] == "ASTRO-01"
    assert payload["headline"]
    assert payload["observed_dynamics"].strip()
    assert payload["study_caveats"]
    assert payload["disclaimer"] == MANDATORY_DISCLAIMER
    assert payload["tripwire_triggered"] is False
    assert payload["latency_ms"] >= 0.0

    cited = payload["cited_evidence"]
    assert cited, "Explain must return at least one cited passage"
    assert "HRR-CO2-001" in {item["doc_id"] for item in cited}
    assert all(item["excerpt"].strip() for item in cited)
    assert all(0.0 <= item["relevance_pct"] <= 100.0 for item in cited)
    assert any(item["doi_citation"] for item in cited)

    assert _audit_count(storage) == before + 1
    audit = _latest_audit_row(storage)
    assert audit["event_id"] == event.event_id
    assert audit["astronaut_id"] == "ASTRO-01"
    assert audit["retrieval_mode"] in {"HYBRID_RRF", "DENSE_COSINE", "LEXICAL_BM25"}
    assert audit["generation_mode"] == "EXTRACTIVE_FALLBACK"
    assert "HRR-CO2-001" in audit["cited_doc_ids"]
    assert audit["tripwire_triggered"] == 0
    assert audit["latency_ms"] >= 0.0


def test_epistemic_guardrail_tripwire_is_persisted(scenario_client, monkeypatch):
    """WAYFINDER-V3-025: causal generative text is intercepted and flagged."""
    client, storage, event = scenario_client
    monkeypatch.setattr(
        assistant_module.httpx, "AsyncClient", _CausalAsyncClient, raising=True
    )

    before = _audit_count(storage)
    response = client.post(
        "/api/assistant/explain",
        json={"event_id": event.event_id, "astronaut_id": "ASTRO-01"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["tripwire_triggered"] is True
    assert payload["mode"] == "EXTRACTIVE_FALLBACK"
    assert payload["disclaimer"] == MANDATORY_DISCLAIMER
    assert "HRR-CO2-001" in {
        item["doc_id"] for item in payload["cited_evidence"]
    }
    assert "caused" not in payload["observed_dynamics"].lower()

    assert _audit_count(storage) == before + 1
    audit = _latest_audit_row(storage)
    assert audit["event_id"] == event.event_id
    assert audit["tripwire_triggered"] == 1
    assert audit["generation_mode"] == "EXTRACTIVE_FALLBACK"
    assert "HRR-CO2-001" in audit["cited_doc_ids"]


def test_health_and_cohort_endpoints_reflect_seeded_vectors(scenario_client):
    """WAYFINDER-V3-025: the served API exposes the embedded corpus and cohort."""
    client, _storage, _event = scenario_client

    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["vector_store_chunks"] == 13
    assert health.json()["version"] == "3.0.0"

    cohort = client.get("/api/astronauts")
    assert cohort.status_code == 200
    assert {item["astronaut_id"] for item in cohort.json()} == {
        "ASTRO-01",
        "ASTRO-02",
        "ASTRO-03",
    }

    vance = client.get("/api/astronauts/ASTRO-01")
    assert vance.status_code == 200
    assert vance.json()["callsign"] == "CDR M. Vance"
