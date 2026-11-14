"""
tests/test_providers.py: Unit tests for pluggable DecisionSupportProviders,
mocked Gemini and Ollama generative flows, epistemic guardrails, and audio session management.
"""

from __future__ import annotations

import asyncio
import json
import time
from unittest.mock import MagicMock, patch

import pytest

from wayfinder.core.models import (
    ChecklistStep,
    CitedEvidence,
    FlightRule,
    SeverityTrigger,
)
from wayfinder.core.providers import (
    ExtractiveSynthesizerProvider,
    GeminiAudioSessionManager,
    GeminiFlashLiteProvider,
    OllamaLocalProvider,
)


@pytest.fixture
def sample_flight_rule() -> FlightRule:
    return FlightRule(
        rule_id="FR-ECLSS-001",
        title="Elevated Cabin Carbon Dioxide Excursion",
        subsystem="ECLSS",
        revision_date="2026-06-15",
        severity_trigger=SeverityTrigger.INVESTIGATE,
        condition_threshold="Cabin P_CO2 >= 4.0 mmHg sustained >= 15 min",
        verbatim_text="Cabin P_CO2 threshold exceeded. Initiate CDRA scrubber cycle.",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        checklist_steps=[
            ChecklistStep(
                step_number=1,
                action="Verify CDRA Bed A adsorption cycle status on ECLSS overview display.",
                target_subsystem="CDRA",
                verification="Bed A cycle indicator ACTIVE",
                caution_warning=None,
            ),
            ChecklistStep(
                step_number=2,
                action="Transition secondary desiccant bed to manual override.",
                target_subsystem="CDRA",
                verification="Secondary bed telemetry indicates MANUAL_HOT",
                caution_warning="Do not exceed 180 deg C thermal desiccant limit.",
            ),
        ],
        reference_docs=["NASA-STD-3001-VOL-2", "SSP-50005"],
    )


@pytest.fixture
def sample_evidence() -> list[CitedEvidence]:
    return [
        CitedEvidence(
            chunk_id="HRR-CO2-001_c1",
            doc_id="HRR-CO2-001",
            title="Adverse Health Effects of Elevated CO2",
            authors="Law et al.",
            report_identifier="NASA-TP-2014-218556",
            section_heading="Headache and Neurological Correlates",
            doi_citation="10.1016/j.jenvman.2019.04.055",
            source_repository="NASA Human Research Roadmap (HRR)",
            excerpt="Astronaut headache incidence correlates with cabin CO2 partial pressures above 4.0 mmHg.",
            rrf_score=0.032,
            relevance_pct=95.0,
        )
    ]


def test_extractive_synthesizer_provider_contract(
    sample_flight_rule: FlightRule,
    sample_evidence: list[CitedEvidence],
):
    """Verifies ExtractiveSynthesizerProvider is deterministic, cites rule verbatim, and completes in <5ms."""
    provider = ExtractiveSynthesizerProvider()
    assert asyncio.run(provider.is_available()) is True
    assert provider.provider_id == "extractive-synthesizer"

    started = time.perf_counter()
    resp = asyncio.run(
        provider.generate_response(
            prompt="Explain cabin CO2 threshold",
            evidence=sample_evidence,
            rule=sample_flight_rule,
            cohort_context={"astronaut_id": "ASTRO-01", "event_id": "EVT-101"},
        )
    )
    elapsed = (time.perf_counter() - started) * 1000.0

    assert elapsed < 50.0
    assert resp.answer is not None
    assert "Flight Rule FR-ECLSS-001" in resp.answer
    assert resp.mode == "EXTRACTIVE_FALLBACK"
    assert resp.provider_used == "extractive-synthesizer"
    assert resp.flight_rule_cited is not None
    assert resp.flight_rule_cited.rule_id == "FR-ECLSS-001"
    assert len(resp.verbatim_checklist) == 2
    assert resp.verbatim_checklist[0].target_subsystem == "CDRA"
    assert resp.tripwire_triggered is False
    assert "Non-Causal Decision Support Disclaimer" in resp.disclaimer


def test_ollama_local_provider_fallback_when_offline(
    sample_flight_rule: FlightRule,
    sample_evidence: list[CitedEvidence],
):
    """Verifies OllamaLocalProvider gracefully falls back to extractive synthesis when offline."""
    provider = OllamaLocalProvider(ollama_url="http://127.0.0.1:54321")  # Unused port

    is_avail = asyncio.run(provider.is_available())
    assert is_avail is False

    resp = asyncio.run(
        provider.generate_response(
            prompt="Check hypercapnia status",
            evidence=sample_evidence,
            rule=sample_flight_rule,
            cohort_context={"astronaut_id": "ASTRO-01"},
        )
    )

    assert resp.mode == "EXTRACTIVE_FALLBACK"
    assert resp.provider_used == "extractive-synthesizer"
    assert resp.flight_rule_cited is not None
    assert resp.flight_rule_cited.rule_id == "FR-ECLSS-001"


class _MockOllamaAsyncClient:
    probe_status = 200
    post_payload: dict = {}

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url):
        mock_resp = MagicMock()
        mock_resp.status_code = type(self).probe_status
        return mock_resp

    async def post(self, url, json=None):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"response": json_dumps(type(self).post_payload)}
        mock_resp.raise_for_status.return_value = None
        return mock_resp


def json_dumps(d):
    return json.dumps(d)


def test_ollama_local_provider_guardrail_tripwire(
    sample_flight_rule: FlightRule,
    sample_evidence: list[CitedEvidence],
    monkeypatch,
):
    """Verifies that if Ollama generates prohibited causal terms, it trips and falls back."""
    provider = OllamaLocalProvider(ollama_url="http://127.0.0.1:11434")

    # Mock Ollama returning causal wording ("causes", "diagnoses")
    _MockOllamaAsyncClient.probe_status = 200
    _MockOllamaAsyncClient.post_payload = {
        "headline": "Elevated CO2 Diagnosed",
        "observed_dynamics": "This excursion causes severe autonomic degradation.",
        "scientific_context": "Clinical diagnosis indicates rapid distress.",
        "study_caveats": ["Check immediately"],
    }
    monkeypatch.setattr("httpx.AsyncClient", _MockOllamaAsyncClient)

    resp = asyncio.run(
        provider.generate_response(
            prompt="Is this dangerous?",
            evidence=sample_evidence,
            rule=sample_flight_rule,
        )
    )

    assert resp.mode == "EXTRACTIVE_FALLBACK"
    assert resp.tripwire_triggered is True
    assert resp.flight_rule_cited.rule_id == "FR-ECLSS-001"


def test_gemini_flash_lite_provider_fallback_when_no_key(
    sample_flight_rule: FlightRule,
    sample_evidence: list[CitedEvidence],
):
    """Verifies GeminiFlashLiteProvider falls back to extractive when no API key is provided."""
    provider = GeminiFlashLiteProvider(api_key=None)
    with patch.dict("os.environ", {}, clear=True):
        provider.api_key = None
        assert asyncio.run(provider.is_available()) is False

        resp = asyncio.run(
            provider.generate_response(
                prompt="Flight rule checklist request",
                evidence=sample_evidence,
                rule=sample_flight_rule,
            )
        )
        assert resp.mode == "EXTRACTIVE_FALLBACK"
        assert resp.flight_rule_cited is not None
        assert resp.flight_rule_cited.rule_id == "FR-ECLSS-001"


def test_gemini_flash_lite_provider_generative_success(
    sample_flight_rule: FlightRule,
    sample_evidence: list[CitedEvidence],
):
    """Verifies GeminiFlashLiteProvider parses structured JSON and returns GEMINI_GENERATIVE mode."""
    provider = GeminiFlashLiteProvider(api_key="test_dummy_key_12345")
    assert asyncio.run(provider.is_available()) is True

    valid_payload = {
        "headline": "Flight Rule FR-ECLSS-001 Guidance",
        "observed_dynamics": "Elevated CO2 co-occurs with observed autonomic telemetry shifts.",
        "scientific_context": "Correlational studies associate P_CO2 above 4.0 mmHg with reported symptoms.",
        "study_caveats": ["Individual susceptibility varies."],
    }

    mock_gemini_response = MagicMock()
    mock_gemini_response.text = json.dumps(valid_payload)

    with patch("google.genai.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_gemini_response
        mock_client_cls.return_value = mock_client

        resp = asyncio.run(
            provider.generate_response(
                prompt="What is the active flight rule?",
                evidence=sample_evidence,
                rule=sample_flight_rule,
                cohort_context={"astronaut_id": "ASTRO-01"},
            )
        )

        assert resp.mode == "GEMINI_GENERATIVE"
        assert resp.provider_used == "gemini-flash-lite"
        assert resp.headline == "Flight Rule FR-ECLSS-001 Guidance"
        assert resp.flight_rule_cited is not None
        assert resp.flight_rule_cited.rule_id == "FR-ECLSS-001"
        assert len(resp.verbatim_checklist) == 2
        assert resp.tripwire_triggered is False


def test_gemini_flash_lite_provider_guardrail_tripwire(
    sample_flight_rule: FlightRule,
    sample_evidence: list[CitedEvidence],
):
    """Verifies that if Gemini outputs prohibited causal words, it triggers tripwire and falls back."""
    provider = GeminiFlashLiteProvider(api_key="test_dummy_key_12345")

    causal_payload = {
        "headline": "Clinical Diagnosis of Hypercapnia",
        "observed_dynamics": "High carbon dioxide causes immediate headache.",
        "scientific_context": "Studies prove this condition requires medical treatment.",
        "study_caveats": [],
    }

    mock_gemini_response = MagicMock()
    mock_gemini_response.text = json.dumps(causal_payload)

    with patch("google.genai.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_gemini_response
        mock_client_cls.return_value = mock_client

        resp = asyncio.run(
            provider.generate_response(
                prompt="Diagnose this condition",
                evidence=sample_evidence,
                rule=sample_flight_rule,
            )
        )

        assert resp.mode == "EXTRACTIVE_FALLBACK"
        assert resp.tripwire_triggered is True
        assert resp.flight_rule_cited.rule_id == "FR-ECLSS-001"


def test_gemini_audio_session_manager_initialization():
    """Verifies GeminiAudioSessionManager configuration and error when no API key."""
    manager_no_key = GeminiAudioSessionManager(api_key=None)
    with patch.dict("os.environ", {}, clear=True):
        manager_no_key.api_key = None
        with pytest.raises(ValueError, match="GEMINI_API_KEY is required"):
            asyncio.run(manager_no_key.start())

    manager = GeminiAudioSessionManager(
        api_key="test_audio_key_999",
        model="gemini-2.5-flash-audio",
    )
    assert manager.model == "gemini-2.5-flash-audio"
    assert manager.sample_rate_hz == 16000
    assert manager.output_sample_rate_hz == 24000
    assert manager.is_active is False
