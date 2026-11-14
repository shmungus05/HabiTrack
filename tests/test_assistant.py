"""
tests/test_assistant.py: Unit tests for canonical archetype resolution, extractive
synthesis, the epistemic guardrail, and the fast-fail Ollama client.
"""

import asyncio
import json
import time

import httpx
import pytest

import wayfinder.core.assistant as assistant_module
from wayfinder.core.assistant import (
    MANDATORY_DISCLAIMER,
    PROHIBITED_CAUSAL_TERMS,
    apply_epistemic_guardrail,
    is_ollama_available,
    query_generative_assistant,
)
from wayfinder.core.models import (
    CitedEvidence,
    HealthEvent,
    SeverityLevel,
    UncertaintyLevel,
)

PROHIBITED_STEMS = [
    "cause",
    "causes",
    "caused",
    "causing",
    "proves",
    "proven",
    "proving",
    "diagnose",
    "diagnosed",
    "diagnosing",
    "diagnosis",
    "prescribe",
    "prescribes",
    "prescribed",
    "prescribing",
    "prescription",
    "treat",
    "treated",
    "treating",
    "treatment",
    "therapeutic",
    "therapy",
    "cure",
    "remedy",
]


def make_event(**overrides) -> HealthEvent:
    payload = dict(
        event_id="EVT-ASSIST-1",
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
    payload.update(overrides)
    return HealthEvent(**payload)


def make_evidence(**overrides) -> CitedEvidence:
    payload = dict(
        chunk_id="HRR-CO2-001_c2",
        doc_id="HRR-CO2-001",
        title="Risk of Adverse Health Effects from Elevated Carbon Dioxide in Spaceflight",
        authors=None,
        report_identifier="HRR-CO2-001",
        section_heading="Headache and Physiological Susceptibility",
        doi_citation="10.1016/j.jenvman.2019.04.055",
        source_repository="NASA Human Research Roadmap (HRR)",
        excerpt="Crew-reported headaches co-occur with cabin CO2 partial pressures above 4.0 mmHg.",
        rrf_score=0.032787,
        relevance_pct=100.0,
    )
    payload.update(overrides)
    return CitedEvidence(**payload)


def test_extractive_event_synthesis_is_deterministic_and_fast():
    """WAYFINDER-V3-009: offline synthesis is structured, cited, and <2 ms."""
    evidence = [make_evidence()]
    event = make_event()

    started = time.perf_counter()
    response = assistant_module.ExtractiveResearchSynthesizer.synthesize_for_event(
        event, evidence, astronaut_id="ASTRO-01", latency_ms=0.4
    )
    elapsed_ms = (time.perf_counter() - started) * 1000.0

    assert elapsed_ms < 2.0
    assert response.mode == "EXTRACTIVE_FALLBACK"
    assert response.headline == "Scientific Evidence Context: Multi Signal Concordance"
    assert response.event_id == "EVT-ASSIST-1"
    assert response.astronaut_id == "ASTRO-01"
    assert "[HRR-CO2-001: Headache and Physiological Susceptibility]" in response.scientific_context
    assert "2.80 sigma" in response.observed_dynamics
    assert response.disclaimer == MANDATORY_DISCLAIMER
    assert response.tripwire_triggered is False
    assert response.study_caveats


def test_extractive_query_synthesis_has_no_event_scope():
    """WAYFINDER-V3-009: ad-hoc research synthesis is cited and event-free."""
    response = assistant_module.ExtractiveResearchSynthesizer.synthesize_for_query(
        "Does cabin CO2 co-occur with headaches?", [make_evidence()]
    )

    assert response.headline.startswith("Literature Synthesis:")
    assert response.event_id is None
    assert response.mode == "EXTRACTIVE_FALLBACK"
    assert "[HRR-CO2-001:" in response.scientific_context
    assert response.disclaimer == MANDATORY_DISCLAIMER


def test_extractive_synthesis_handles_empty_evidence():
    """WAYFINDER-V3-009: no-match queries still return a valid response."""
    response = assistant_module.ExtractiveResearchSynthesizer.synthesize_for_query(
        "unmatched query", []
    )

    assert response.cited_evidence == []
    assert "No direct NASA Life Sciences" in response.scientific_context


@pytest.mark.parametrize("stem", PROHIBITED_STEMS)
def test_guardrail_intercepts_every_prohibited_inflectional_stem(stem):
    """WAYFINDER-V3-010: all 24 prohibited causal/clinical stems trip the wire."""
    fallback_called = {"count": 0}

    def fallback():
        fallback_called["count"] += 1
        return assistant_module.ExtractiveResearchSynthesizer.synthesize_for_query(
            "tripwire", [make_evidence()]
        )

    response = apply_epistemic_guardrail(
        headline="Evidence context",
        observed_dynamics=f"Elevated CO2 {stem} the reported headache.",
        scientific_context="",
        cited_evidence=[make_evidence()],
        study_caveats=[],
        astronaut_id="ASTRO-01",
        event_id="EVT-ASSIST-1",
        latency_ms=1.0,
        fallback_generator=fallback,
    )

    assert fallback_called["count"] == 1
    assert response.mode == "EXTRACTIVE_FALLBACK"
    assert response.tripwire_triggered is True


@pytest.mark.parametrize(
    "safe_text",
    [
        "Cabin CO2 co-occurred with headache reports.",
        "Elevated CO2 is associated with reduced sleep quality.",
        "Vital shifts may co-occur with environmental excursions.",
    ],
)
def test_guardrail_allows_correlation_language(safe_text):
    """WAYFINDER-V3-010: non-causal correlation wording passes cleanly."""
    response = apply_epistemic_guardrail(
        headline=safe_text,
        observed_dynamics="",
        scientific_context="",
        cited_evidence=[make_evidence()],
        study_caveats=["Flight analogue caveat."],
        astronaut_id="ASTRO-01",
        event_id="EVT-ASSIST-1",
        latency_ms=2.5,
        fallback_generator=lambda: pytest.fail("fallback must not run"),
    )

    assert response.mode == "OLLAMA_GENERATIVE"
    assert response.tripwire_triggered is False
    assert response.cited_evidence[0].excerpt.startswith("Crew-reported")


def test_guardrail_exempts_verbatim_cited_excerpts():
    """WAYFINDER-V3-010: quoted source text does not trip the narrative guardrail."""
    quoted = make_evidence(
        excerpt="Source passage uses the words cause and causes in a quoted context."
    )
    response = apply_epistemic_guardrail(
        headline="Evidence context for review",
        observed_dynamics="Temporal co-occurrence only.",
        scientific_context="See cited passage.",
        cited_evidence=[quoted],
        study_caveats=[],
        astronaut_id=None,
        event_id=None,
        latency_ms=1.0,
        fallback_generator=lambda: pytest.fail("fallback must not run"),
    )

    assert response.tripwire_triggered is False
    assert response.mode == "OLLAMA_GENERATIVE"


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def json(self) -> dict:
        return self._payload

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                "fake error", request=httpx.Request("POST", "http://test"), response=self
            )


class _FakeAsyncClient:
    probe_status = 200
    post_payload: dict = {}
    post_exception: Exception | None = None
    post_calls = 0

    def __init__(self, *args, **kwargs):
        self.timeout = kwargs.get("timeout")

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url):
        return _FakeResponse(self.probe_status, {})

    async def post(self, url, json=None):
        type(self).post_calls += 1
        if self.post_exception is not None:
            raise self.post_exception
        return _FakeResponse(200, self.post_payload)


def test_is_ollama_available_true_for_200(monkeypatch):
    """WAYFINDER-V3-012: a 200 /api/tags response reports online."""
    _FakeAsyncClient.probe_status = 200
    monkeypatch.setattr(assistant_module.httpx, "AsyncClient", _FakeAsyncClient)

    assert asyncio.run(is_ollama_available()) is True


def test_is_ollama_available_false_for_error_status(monkeypatch):
    """WAYFINDER-V3-012: a non-200 probe reports offline."""
    _FakeAsyncClient.probe_status = 503
    monkeypatch.setattr(assistant_module.httpx, "AsyncClient", _FakeAsyncClient)

    assert asyncio.run(is_ollama_available()) is False


def test_offline_ollama_falls_back_without_posting(monkeypatch):
    """WAYFINDER-V3-012: offline daemon returns extractive output in <50 ms."""
    _FakeAsyncClient.probe_status = 503
    _FakeAsyncClient.post_calls = 0
    monkeypatch.setattr(assistant_module.httpx, "AsyncClient", _FakeAsyncClient)

    started = time.perf_counter()
    response = asyncio.run(
        query_generative_assistant("CO2 query", [make_evidence()], event=make_event())
    )
    elapsed_ms = (time.perf_counter() - started) * 1000.0

    assert elapsed_ms < 50.0
    assert _FakeAsyncClient.post_calls == 0
    assert response.mode == "EXTRACTIVE_FALLBACK"


def test_ollama_timeout_falls_back_cleanly(monkeypatch):
    """WAYFINDER-V3-012: a generation timeout returns extractive output, no error."""
    _FakeAsyncClient.probe_status = 200
    _FakeAsyncClient.post_exception = httpx.TimeoutException("timed out")
    monkeypatch.setattr(assistant_module.httpx, "AsyncClient", _FakeAsyncClient)

    response = asyncio.run(
        query_generative_assistant("CO2 query", [make_evidence()], event=make_event())
    )

    assert response.mode == "EXTRACTIVE_FALLBACK"
    assert response.tripwire_triggered is False


def test_ollama_http_error_falls_back_cleanly(monkeypatch):
    """WAYFINDER-V3-012: a 5xx generation response never escapes as a 500."""

    class _ErrorStatusClient(_FakeAsyncClient):
        async def post(self, url, json=None):
            return _FakeResponse(500, {})

    _FakeAsyncClient.probe_status = 200
    monkeypatch.setattr(assistant_module.httpx, "AsyncClient", _ErrorStatusClient)

    response = asyncio.run(
        query_generative_assistant("CO2 query", [make_evidence()], event=make_event())
    )

    assert response.mode == "EXTRACTIVE_FALLBACK"
    assert response.tripwire_triggered is False


def test_malformed_ollama_json_falls_back_cleanly(monkeypatch):
    """WAYFINDER-V3-012: malformed JSON never escapes as a 500 error."""
    _FakeAsyncClient.probe_status = 200
    _FakeAsyncClient.post_exception = None
    _FakeAsyncClient.post_payload = {"response": "not-valid-json"}
    monkeypatch.setattr(assistant_module.httpx, "AsyncClient", _FakeAsyncClient)

    response = asyncio.run(
        query_generative_assistant("CO2 query", [make_evidence()], event=make_event())
    )

    assert response.mode == "EXTRACTIVE_FALLBACK"


def test_generative_response_passes_guardrail(monkeypatch):
    """WAYFINDER-V3-012: clean generated JSON returns OLLAMA_GENERATIVE mode."""
    _FakeAsyncClient.probe_status = 200
    _FakeAsyncClient.post_exception = None
    _FakeAsyncClient.post_payload = {
        "response": json.dumps(
            {
                "headline": "CO2 excursion context",
                "observed_dynamics": "Cabin CO2 co-occurred with autonomic shifts.",
                "scientific_context": "Literature associates elevated CO2 with headache reports.",
                "study_caveats": ["Flight analogue only."],
            }
        )
    }
    monkeypatch.setattr(assistant_module.httpx, "AsyncClient", _FakeAsyncClient)

    response = asyncio.run(
        query_generative_assistant("CO2 query", [make_evidence()], event=make_event())
    )

    assert response.mode == "OLLAMA_GENERATIVE"
    assert response.tripwire_triggered is False
    assert response.event_id == "EVT-ASSIST-1"


def test_generative_causal_language_trips_guardrail(monkeypatch):
    """WAYFINDER-V3-012: causal generative text is replaced and flagged."""
    _FakeAsyncClient.probe_status = 200
    _FakeAsyncClient.post_exception = None
    _FakeAsyncClient.post_payload = {
        "response": json.dumps(
            {
                "headline": "CO2 caused the headache",
                "observed_dynamics": "High CO2 caused a headache.",
                "scientific_context": "Prescribe rest.",
                "study_caveats": [],
            }
        )
    }
    monkeypatch.setattr(assistant_module.httpx, "AsyncClient", _FakeAsyncClient)

    response = asyncio.run(
        query_generative_assistant("CO2 query", [make_evidence()], event=make_event())
    )

    assert response.mode == "EXTRACTIVE_FALLBACK"
    assert response.tripwire_triggered is True


def test_prohibited_regex_covers_all_stems():
    """WAYFINDER-V3-012: the compiled regex matches every documented stem."""
    missing = [stem for stem in PROHIBITED_STEMS if not PROHIBITED_CAUSAL_TERMS.search(stem)]
    assert missing == []


# ==============================================================================
# AssistantManager Orchestration & Epistemic Guardrail Tests
# ==============================================================================


class _StubProvider(assistant_module.DecisionSupportProvider):
    def __init__(self, pid: str, avail: bool, reply_headline: str = "Stub"):
        self._pid = pid
        self._avail = avail
        self._headline = reply_headline

    @property
    def provider_id(self) -> str:
        return self._pid

    async def is_available(self) -> bool:
        return self._avail

    async def generate_response(self, prompt, evidence, rule=None, cohort_context=None, trace_id=""):
        return assistant_module.AssistantResponse(
            interaction_id="stub-id",
            astronaut_id=(cohort_context or {}).get("astronaut_id"),
            event_id=(cohort_context or {}).get("event_id"),
            mode="GEMINI_GENERATIVE" if "gemini" in self._pid else "OLLAMA_GENERATIVE",
            headline=self._headline,
            observed_dynamics="Stub dynamics",
            scientific_context="Stub context",
            cited_evidence=evidence,
            study_caveats=[],
            disclaimer=assistant_module.MANDATORY_DISCLAIMER,
            tripwire_triggered=False,
            latency_ms=1.2,
            flight_rule_cited=rule,
            verbatim_checklist=rule.checklist_steps if rule else [],
            provider_used=self._pid,
        )


def test_assistant_manager_provider_fallback_chain():
    """Verifies fallback cascade: Gemini -> Ollama -> Extractive."""
    # 1. Gemini available
    mgr = assistant_module.AssistantManager(
        gemini_provider=_StubProvider("gemini-flash-lite", True),
        ollama_provider=_StubProvider("llama3.2:1b", True),
    )
    active = asyncio.run(mgr.get_active_provider())
    assert active.provider_id == "gemini-flash-lite"

    # 2. Gemini offline, Ollama available
    mgr2 = assistant_module.AssistantManager(
        gemini_provider=_StubProvider("gemini-flash-lite", False),
        ollama_provider=_StubProvider("llama3.2:1b", True),
    )
    active2 = asyncio.run(mgr2.get_active_provider())
    assert active2.provider_id == "llama3.2:1b"

    # 3. Both offline -> Extractive
    mgr3 = assistant_module.AssistantManager(
        gemini_provider=_StubProvider("gemini-flash-lite", False),
        ollama_provider=_StubProvider("llama3.2:1b", False),
    )
    active3 = asyncio.run(mgr3.get_active_provider())
    assert active3.provider_id == "extractive-synthesizer"


def test_assistant_manager_provider_status():
    """Verifies get_provider_status returns proper telemetry structure."""
    mgr = assistant_module.AssistantManager(
        gemini_provider=_StubProvider("gemini-flash-lite", True),
        ollama_provider=_StubProvider("llama3.2:1b", False),
    )
    status = asyncio.run(mgr.get_provider_status())
    assert status.active_provider == "gemini-flash-lite"
    assert status.gemini_available is True
    assert status.ollama_available is False
    assert status.gemini_audio_testing_enabled is True
    assert "Gemini" in status.active_model_name


def test_assistant_manager_fast_path_latching_by_rule_id(tmp_path):
    """Verifies explicit rule_id latches flight rule and checklists directly from storage."""
    from wayfinder.core.flight_rules import seed_flight_rules
    from wayfinder.core.storage import StorageManager

    db_path = str(tmp_path / "asst_test.db")
    storage = StorageManager(db_path)
    storage.ensure_initialized()
    seed_flight_rules(storage)

    mgr = assistant_module.AssistantManager(
        storage=storage,
        gemini_provider=_StubProvider("gemini-flash-lite", True),
    )

    resp = asyncio.run(
        mgr.execute_query(
            query="Check CO2 procedure",
            rule_id="FR-ECLSS-001",
        )
    )

    assert resp.flight_rule_cited is not None
    assert resp.flight_rule_cited.rule_id == "FR-ECLSS-001"
    assert len(resp.verbatim_checklist) >= 1
    assert "ECLSS" in resp.flight_rule_cited.subsystem


def test_assistant_manager_fast_path_latching_by_event(tmp_path):
    """Verifies concordance event signature auto-latches canonical flight rule."""
    from wayfinder.core.flight_rules import seed_flight_rules
    from wayfinder.core.models import Astronaut
    from wayfinder.core.storage import StorageManager

    db_path = str(tmp_path / "asst_test2.db")
    storage = StorageManager(db_path)
    storage.ensure_initialized()
    seed_flight_rules(storage)
    storage.insert_astronaut(
        Astronaut(
            astronaut_id="ASTRO-01",
            name="Test Crew",
            callsign="Falcon",
            mission_id="MISSION-01",
            crew_role="Commander",
        )
    )
    event = make_event(
        event_id="EVT-CO2-01",
        astronaut_id="ASTRO-01",
        event_type="MULTI_SIGNAL_CONCORDANCE",
        contributing_stream_ids="stream_eda_co2,stream_sim_hr",
    )
    storage.insert_health_event(event)

    mgr = assistant_module.AssistantManager(
        storage=storage,
        gemini_provider=_StubProvider("gemini-flash-lite", True),
    )

    resp = asyncio.run(
        mgr.execute_query(
            query="Explain current situation",
            concordance_event_id="EVT-CO2-01",
            astronaut_id="ASTRO-01",
        )
    )

    assert resp.flight_rule_cited is not None
    assert resp.flight_rule_cited.rule_id == "FR-ECLSS-001"


def test_assistant_manager_tripwire_guardrail_fallback_and_audit(tmp_path):
    """Verifies causal language in generative response trips guardrail, falls back to extractive, and audits."""
    from wayfinder.core.flight_rules import seed_flight_rules
    from wayfinder.core.models import Astronaut
    from wayfinder.core.storage import StorageManager

    db_path = str(tmp_path / "asst_test3.db")
    storage = StorageManager(db_path)
    storage.ensure_initialized()
    seed_flight_rules(storage)
    storage.insert_astronaut(
        Astronaut(
            astronaut_id="ASTRO-01",
            name="Test Crew",
            callsign="Falcon",
            mission_id="MISSION-01",
            crew_role="Commander",
        )
    )

    # Provider returning causal wording
    bad_provider = _StubProvider("gemini-flash-lite", True, reply_headline="High CO2 causes acute headache")
    mgr = assistant_module.AssistantManager(
        storage=storage,
        gemini_provider=bad_provider,
    )

    trace_id = "test-w3c-trace-999"
    resp = asyncio.run(
        mgr.execute_query(
            query="What causes this headache?",
            astronaut_id="ASTRO-01",
            rule_id="FR-ECLSS-001",
            trace_id=trace_id,
            stt_confidence=0.96,
            stt_duration_sec=1.45,
        )
    )

    assert resp.mode == "EXTRACTIVE_FALLBACK"
    assert resp.tripwire_triggered is True

    # Check audit log in storage
    with storage.get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM assistant_audit_logs WHERE trace_id = ?",
            (trace_id,),
        ).fetchone()

    assert row is not None
    assert row["trace_id"] == trace_id
    assert row["flight_rule_cited"] == "FR-ECLSS-001"
    assert row["tripwire_triggered"] == 1
    assert row["tripwire_match_term"] == "causes"
    assert row["stt_confidence"] == pytest.approx(0.96)
    assert row["stt_duration_sec"] == pytest.approx(1.45)

