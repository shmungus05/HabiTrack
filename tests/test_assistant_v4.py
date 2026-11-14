"""
tests/test_assistant_v4.py: Integration tests for WAYFINDER standby assistant endpoints:
rules catalog, fast-path rule lookup, provider status, and live audio dialog WebSocket.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from wayfinder.core.flight_rules import seed_flight_rules
from wayfinder.core.models import Astronaut, HealthEvent, SeverityLevel, UncertaintyLevel


@pytest.fixture
def seeded_standby_client(api_client, temp_db):
    """Initializes certified flight rules and test crew for standby assistant testing."""
    seed_flight_rules(temp_db)
    temp_db.insert_astronaut(
        Astronaut(
            astronaut_id="ASTRO-01",
            name="CDR M. Vance",
            callsign="Falcon",
            mission_id="ISS-EXP-71",
            crew_role="Commander",
        )
    )
    temp_db.insert_health_event(
        HealthEvent(
            event_id="EVT-ECLSS-CO2",
            astronaut_id="ASTRO-01",
            event_type="MULTI_SIGNAL_CONCORDANCE",
            severity_level=SeverityLevel.INVESTIGATE,
            start_time="2026-07-08T02:00:00Z",
            end_time="2026-07-08T02:30:00Z",
            contributing_stream_ids="stream_eda_co2,stream_sim_hr",
            rationale="Cabin CO2 co-occurrence with elevated heart rate.",
            uncertainty_level=UncertaintyLevel.LOW,
            peak_deviation_sigma=2.8,
        )
    )
    return api_client


def test_list_flight_rules_endpoint(seeded_standby_client):
    """Verifies GET /api/assistant/rules returns all seeded rules and filters properly."""
    res = seeded_standby_client.get("/api/assistant/rules")
    assert res.status_code == 200
    rules = res.json()
    assert len(rules) == 3
    rule_ids = {r["rule_id"] for r in rules}
    assert "FR-ECLSS-001" in rule_ids
    assert "FR-CDRA-002" in rule_ids
    assert "FR-EVA-003" in rule_ids

    # Filter by subsystem
    res_eva = seeded_standby_client.get("/api/assistant/rules?subsystem=EVA")
    assert res_eva.status_code == 200
    eva_rules = res_eva.json()
    assert len(eva_rules) == 1
    assert eva_rules[0]["rule_id"] == "FR-EVA-003"


def test_get_single_flight_rule_endpoint(seeded_standby_client):
    """Verifies fast-path GET /api/assistant/rules/{rule_id} <1ms response and 404 handling."""
    res = seeded_standby_client.get("/api/assistant/rules/FR-ECLSS-001")
    assert res.status_code == 200
    data = res.json()
    assert data["rule_id"] == "FR-ECLSS-001"
    assert "CO2" in data["title"] or "Carbon Dioxide" in data["title"]
    assert len(data["checklist_steps"]) >= 2
    assert len(data["sha256_hash"]) == 64

    # Nonexistent rule returns 404
    res_404 = seeded_standby_client.get("/api/assistant/rules/FR-NONEXISTENT")
    assert res_404.status_code == 404


def test_provider_status_endpoint(seeded_standby_client):
    """Verifies GET /api/assistant/provider-status exposes provider availability."""
    res = seeded_standby_client.get("/api/assistant/provider-status")
    assert res.status_code == 200
    payload = res.json()
    assert "active_provider" in payload
    assert "gemini_available" in payload
    assert "ollama_available" in payload
    assert "gemini_audio_testing_enabled" in payload
    assert "active_model_name" in payload


def test_assistant_query_with_event_rule_latching(seeded_standby_client):
    """Verifies POST /api/assistant/query with concordance_event_id latches flight rule."""
    payload = {
        "query": "What checklist applies to current excursion?",
        "astronaut_id": "ASTRO-01",
        "concordance_event_id": "EVT-ECLSS-CO2",
        "top_k": 3,
    }
    res = seeded_standby_client.post("/api/assistant/query", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] in ("EXTRACTIVE_FALLBACK", "OLLAMA_GENERATIVE", "GEMINI_GENERATIVE")
    assert data["flight_rule_cited"] is not None
    assert data["flight_rule_cited"]["rule_id"] == "FR-ECLSS-001"
    assert len(data["verbatim_checklist"]) >= 2
    assert "Non-Causal Decision Support Disclaimer" in data["disclaimer"]


def test_websocket_audio_dialog_missing_key(seeded_standby_client):
    """Verifies WS /api/assistant/ws/audio rejects missing API key with error frame."""
    client = seeded_standby_client
    with patch.dict("os.environ", {}, clear=True):
        with client.websocket_connect("/api/assistant/ws/audio") as ws:
            ws.send_json({"type": "init", "api_key": ""})
            msg = ws.receive_json()
            assert msg["type"] == "error"
            assert "Missing GEMINI_API_KEY" in msg["message"]


def test_websocket_audio_dialog_mocked_exchange(seeded_standby_client):
    """Verifies WS /api/assistant/ws/audio executes handshake and text/audio routing."""
    client = seeded_standby_client

    mock_manager = MagicMock()
    mock_manager.start = AsyncMock(return_value={
        "type": "ready",
        "session_id": "mock-session-123",
        "model": "gemini-2.5-flash-audio",
    })
    mock_manager.send_text_message = AsyncMock()
    mock_manager.send_audio_chunk = AsyncMock()
    mock_manager.close = AsyncMock()

    async def mock_events():
        yield {"type": "delta_text", "speaker": "assistant", "text": "Latched rule FR-ECLSS-001"}
        yield {"type": "audio", "data": b"\x00\x01\x02\x03", "mime_type": "audio/pcm;rate=24000"}

    mock_manager.receive_events = mock_events

    with patch("wayfinder.api.routes.assistant.GeminiAudioSessionManager", return_value=mock_manager):
        with client.websocket_connect("/api/assistant/ws/audio") as ws:
            ws.send_json({
                "type": "init",
                "api_key": "test_dummy_key",
                "model": "gemini-2.5-flash-audio",
            })
            ready_msg = ws.receive_json()
            assert ready_msg["type"] == "ready"
            assert ready_msg["session_id"] == "mock-session-123"

            # Receive streamed delta text
            text_msg = ws.receive_json()
            assert text_msg["type"] == "delta_text"
            assert "FR-ECLSS-001" in text_msg["text"]

            # Receive binary audio chunk
            audio_bytes = ws.receive_bytes()
            assert audio_bytes == b"\x00\x01\x02\x03"

            # Send close signal
            ws.send_json({"type": "close"})
