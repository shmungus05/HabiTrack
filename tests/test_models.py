"""
tests.test_models: Unit tests for domain models and V2 baseline structures.
"""

import pytest
from pydantic import ValidationError

from wayfinder.core.models import (
    Astronaut,
    CalibrationStatus,
    CircadianBinStats,
    BaselineDeviation,
    CoalescedAutonomicInterval,
    AssistantResponse,
    AssistantAuditLog,
    CitedEvidence,
    ExplainEventRequest,
    HealthEvent,
    HealthStatus,
    ResearchQueryRequest,
    ReviewEventRequest,
    ReviewStatus,
    SeverityLevel,
    SymptomReportRequest,
    UncertaintyLevel,
    VectorEmbeddingRecord,
)


def test_calibration_status_enum():
    """Verify CalibrationStatus enum values."""
    assert CalibrationStatus.CALIBRATING == "CALIBRATING"
    assert CalibrationStatus.CALIBRATED == "CALIBRATED"
    assert set(CalibrationStatus) == {
        CalibrationStatus.CALIBRATING,
        CalibrationStatus.CALIBRATED,
    }


def test_astronaut_defaults_backward_compatibility():
    """Verify Astronaut instantiates with legacy fields and correct V2 defaults."""
    astro = Astronaut(
        astronaut_id="ASTRO-01",
        callsign="Vance",
        mission_id="Ex-71",
        crew_role="Commander",
    )
    assert astro.astronaut_id == "ASTRO-01"
    assert astro.callsign == "Vance"
    assert astro.mission_id == "Ex-71"
    assert astro.crew_role == "Commander"
    assert astro.baseline_calibrated_at is None
    assert astro.baseline_parameters is None

    # V2 Defaults
    assert astro.resting_hr == 65.0
    assert astro.resting_rmssd == 55.0
    assert astro.resting_spo2 == 98.0
    assert astro.resting_temp == 37.0
    assert astro.circadian_phase_shift_hours == 0.0
    assert astro.baseline_window_days == 7
    assert astro.calibration_status == CalibrationStatus.CALIBRATING


def test_astronaut_custom_v2_parameters():
    """Verify Astronaut model with explicit V2 parameters."""
    astro = Astronaut(
        astronaut_id="ASTRO-02",
        callsign="Patel",
        mission_id="Ex-71",
        crew_role="Flight Engineer",
        resting_hr=52.0,
        resting_rmssd=75.0,
        resting_spo2=98.5,
        resting_temp=36.8,
        circadian_phase_shift_hours=-1.0,
        baseline_window_days=14,
        calibration_status=CalibrationStatus.CALIBRATED,
    )
    assert astro.resting_hr == 52.0
    assert astro.resting_rmssd == 75.0
    assert astro.resting_spo2 == 98.5
    assert astro.resting_temp == 36.8
    assert astro.circadian_phase_shift_hours == -1.0
    assert astro.baseline_window_days == 14
    assert astro.calibration_status == CalibrationStatus.CALIBRATED


def test_astronaut_immutability():
    """Verify Astronaut is frozen."""
    astro = Astronaut(
        astronaut_id="ASTRO-01",
        callsign="Vance",
        mission_id="Ex-71",
        crew_role="Commander",
    )
    with pytest.raises(ValidationError):
        astro.resting_hr = 70.0


def test_astronaut_validation_errors():
    """Verify Astronaut validation fails on invalid types or enum values."""
    with pytest.raises(ValidationError):
        Astronaut(
            astronaut_id="ASTRO-01",
            callsign="Vance",
            mission_id="Ex-71",
            crew_role="Commander",
            calibration_status="INVALID_STATUS",
        )


def test_astronaut_serialization_roundtrip():
    """Verify Astronaut serialization to/from JSON."""
    astro = Astronaut(
        astronaut_id="ASTRO-03",
        callsign="Lindgren",
        mission_id="Ex-71",
        crew_role="Mission Specialist",
        resting_hr=72.0,
        resting_rmssd=38.0,
        resting_spo2=97.8,
        resting_temp=37.1,
        circadian_phase_shift_hours=1.5,
        baseline_window_days=7,
        calibration_status=CalibrationStatus.CALIBRATED,
    )
    json_data = astro.model_dump_json()
    recovered = Astronaut.model_validate_json(json_data)
    assert recovered == astro


def test_circadian_bin_stats_instantiation_and_immutability():
    """Verify CircadianBinStats fields, defaults, and frozen configuration."""
    bin_stats = CircadianBinStats(
        stream_id="stream_sim_hr",
        astronaut_id="ASTRO-01",
        hour_bin=14,
        mean=72.5,
        std=4.2,
        sample_count=84,
        distinct_days=7,
        calibration_status=CalibrationStatus.CALIBRATED,
    )
    assert bin_stats.stream_id == "stream_sim_hr"
    assert bin_stats.astronaut_id == "ASTRO-01"
    assert bin_stats.hour_bin == 14
    assert bin_stats.mean == 72.5
    assert bin_stats.std == 4.2
    assert bin_stats.sample_count == 84
    assert bin_stats.distinct_days == 7
    assert bin_stats.calibration_status == CalibrationStatus.CALIBRATED

    with pytest.raises(ValidationError):
        bin_stats.mean = 80.0


def test_circadian_bin_stats_hour_bin_validation():
    """Verify hour_bin validation strictly enforces 0 <= hour_bin <= 23."""
    with pytest.raises(ValidationError):
        CircadianBinStats(
            stream_id="stream_sim_hr",
            astronaut_id="ASTRO-01",
            hour_bin=24,
            mean=70.0,
            std=3.0,
            sample_count=10,
            distinct_days=3,
            calibration_status=CalibrationStatus.CALIBRATED,
        )

    with pytest.raises(ValidationError):
        CircadianBinStats(
            stream_id="stream_sim_hr",
            astronaut_id="ASTRO-01",
            hour_bin=-1,
            mean=70.0,
            std=3.0,
            sample_count=10,
            distinct_days=3,
            calibration_status=CalibrationStatus.CALIBRATED,
        )


def test_circadian_bin_stats_serialization():
    """Verify CircadianBinStats serialization round-trip."""
    bin_stats = CircadianBinStats(
        stream_id="stream_sim_hrv",
        astronaut_id="ASTRO-02",
        hour_bin=3,
        mean=85.0,
        std=6.5,
        sample_count=40,
        distinct_days=4,
        calibration_status=CalibrationStatus.CALIBRATING,
    )
    dumped = bin_stats.model_dump()
    assert dumped["hour_bin"] == 3
    assert dumped["calibration_status"] == "CALIBRATING"
    recovered = CircadianBinStats.model_validate(dumped)
    assert recovered == bin_stats


def test_baseline_deviation_instantiation_and_immutability():
    """Verify BaselineDeviation attributes and immutability."""
    deviation = BaselineDeviation(
        timestamp="2026-11-14T14:30:00Z",
        stream_id="stream_sim_hr",
        astronaut_id="ASTRO-01",
        value=110.0,
        expected_mean=70.0,
        expected_std=5.0,
        z_score=8.0,
        is_statistical_deviation=True,
    )
    assert deviation.timestamp == "2026-11-14T14:30:00Z"
    assert deviation.stream_id == "stream_sim_hr"
    assert deviation.astronaut_id == "ASTRO-01"
    assert deviation.value == 110.0
    assert deviation.expected_mean == 70.0
    assert deviation.expected_std == 5.0
    assert deviation.z_score == 8.0
    assert deviation.is_statistical_deviation is True

    with pytest.raises(ValidationError):
        deviation.z_score = 1.0


def test_baseline_deviation_serialization():
    """Verify BaselineDeviation serialization roundtrip."""
    deviation = BaselineDeviation(
        timestamp="2026-11-14T04:00:00Z",
        stream_id="stream_sim_spo2",
        astronaut_id="ASTRO-03",
        value=97.5,
        expected_mean=98.0,
        expected_std=0.6,
        z_score=-0.833,
        is_statistical_deviation=False,
    )
    json_str = deviation.model_dump_json()
    recovered = BaselineDeviation.model_validate_json(json_str)
    assert recovered == deviation


def test_coalesced_autonomic_interval_model():
    """Verify CoalescedAutonomicInterval instantiation, immutability, dict access, and serialization."""
    interval = CoalescedAutonomicInterval(
        event_id="EVT-EXERTION-20260509T140000Z",
        start_time="2026-05-09T14:00:00Z",
        end_time="2026-05-09T15:25:00Z",
        duration_minutes=85.0,
        sample_count=18,
        peak_z_hr=3.2,
        peak_hr_value=130.0,
        nadir_z_rmssd=-2.8,
        nadir_rmssd_value=18.5,
        peak_hr_diff=65.0,
        nadir_rmssd_diff=-36.5,
        astronaut_id="ASTRO-01",
    )
    assert interval.event_id == "EVT-EXERTION-20260509T140000Z"
    assert interval.start_time == "2026-05-09T14:00:00Z"
    assert interval.end_time == "2026-05-09T15:25:00Z"
    assert interval.duration_minutes == 85.0
    assert interval.sample_count == 18
    assert interval.peak_z_hr == 3.2
    assert interval.peak_hr_value == 130.0
    assert interval.nadir_z_rmssd == -2.8
    assert interval.nadir_rmssd_value == 18.5
    assert interval.peak_hr_diff == 65.0
    assert interval.nadir_rmssd_diff == -36.5
    assert interval.astronaut_id == "ASTRO-01"

    # Dict-like access compatibility
    assert interval["event_id"] == "EVT-EXERTION-20260509T140000Z"
    assert interval["peak_z_hr"] == 3.2
    assert "peak_hr_diff" in interval
    assert "non_existent_key" not in interval

    # Frozen immutability
    with pytest.raises(ValidationError):
        interval.duration_minutes = 90.0

    # Serialization roundtrip
    serialized = interval.model_dump_json()
    recovered = CoalescedAutonomicInterval.model_validate_json(serialized)
    assert recovered == interval


def _health_event_payload(**overrides) -> dict:
    """Build a V2-shaped health_events row dict for model construction tests."""
    payload = {
        "event_id": "EVT-DAY127-CO2",
        "astronaut_id": "ASTRO-01",
        "event_type": "MULTI_SIGNAL_CONCORDANCE",
        "severity_level": SeverityLevel.INVESTIGATE,
        "start_time": "2026-07-08T02:15:00Z",
        "end_time": "2026-07-08T03:00:00Z",
        "contributing_stream_ids": '["stream_eda_co2","stream_sim_hr"]',
        "symptom_report_id": "SYM-DAY127-E2E",
        "rationale": "Elevated CO2 concordant with heart rate excursion.",
        "uncertainty_level": UncertaintyLevel.MODERATE,
        "review_status": ReviewStatus.PENDING,
        "review_notes": None,
    }
    payload.update(overrides)
    return payload


def test_health_event_peak_deviation_sigma_defaults_from_legacy_row():
    """Verify V2 DB rows without peak_deviation_sigma still construct HealthEvent."""
    event = HealthEvent(**_health_event_payload())
    assert event.peak_deviation_sigma is None
    assert event.event_id == "EVT-DAY127-CO2"
    assert event.severity_level == SeverityLevel.INVESTIGATE


def test_health_event_peak_deviation_sigma_roundtrip_preserves_precision():
    """Verify explicit peak sigma survives JSON round-trip without precision loss."""
    event = HealthEvent(**_health_event_payload(peak_deviation_sigma=4.123456789))
    assert event.peak_deviation_sigma == 4.123456789

    recovered = HealthEvent.model_validate_json(event.model_dump_json())
    assert recovered == event
    assert recovered.peak_deviation_sigma == 4.123456789



def _cited_evidence_payload(**overrides) -> dict:
    """Build a Scientific Evidence Card payload."""
    payload = {
        "chunk_id": "HRR-CO2-001::chunk-02",
        "doc_id": "HRR-CO2-001",
        "title": "Human Health Risks from CO2 Exposure",
        "authors": "Law J, Van Baalen M, et al.",
        "report_identifier": "NASA/TP-2022-001",
        "section_heading": "Cognitive and Autonomic Effects",
        "doi_citation": "10.1000/hrco2.001",
        "source_repository": "NASA HRP",
        "excerpt": "CO2 exposures above 4 mmHg were associated with autonomic shifts.",
        "rrf_score": 0.03278688524590164,
        "relevance_pct": 87.65,
    }
    payload.update(overrides)
    return payload


def test_cited_evidence_instantiation_defaults_and_immutability():
    """Verify CitedEvidence fields, optional metadata defaults, and frozen config."""
    evidence = CitedEvidence(**_cited_evidence_payload())
    assert evidence.chunk_id == "HRR-CO2-001::chunk-02"
    assert evidence.relevance_pct == 87.65
    assert evidence.rrf_score == 0.03278688524590164

    minimal = CitedEvidence(
        chunk_id="GL-MICRO-042::chunk-01",
        doc_id="GL-MICRO-042",
        title="Spaceflight Immune Dysregulation",
        section_heading="Abstract",
        source_repository="NASA GeneLab",
        excerpt="Spaceflight alters immune cell populations.",
        rrf_score=0.016,
        relevance_pct=42.5,
    )
    assert minimal.authors is None
    assert minimal.report_identifier is None
    assert minimal.doi_citation is None

    with pytest.raises(ValidationError):
        evidence.excerpt = "mutated"


def test_assistant_response_nests_cited_evidence_and_roundtrips():
    """Verify AssistantResponse assembly, defaults, and JSON round-trip."""
    evidence = CitedEvidence(**_cited_evidence_payload())
    response = AssistantResponse(
        interaction_id="INT-0001",
        astronaut_id="ASTRO-01",
        event_id="EVT-DAY127-CO2",
        mode="EXTRACTIVE_FALLBACK",
        headline="Nocturnal CO2 and heart rate concordance",
        observed_dynamics="Heart rate rose 18 bpm while CO2 reached 5.8 mmHg.",
        scientific_context="Elevated CO2 can drive autonomic activation.",
        cited_evidence=[evidence],
        study_caveats=["Single-mission exposure data."],
        disclaimer="Decision support only; not a diagnosis.",
        latency_ms=12.3456789,
    )
    assert response.mode == "EXTRACTIVE_FALLBACK"
    assert response.tripwire_triggered is False
    assert response.cited_evidence[0] == evidence
    assert response.latency_ms == 12.3456789

    recovered = AssistantResponse.model_validate_json(response.model_dump_json())
    assert recovered == response
    assert recovered.latency_ms == 12.3456789
    assert recovered.cited_evidence[0].rrf_score == 0.03278688524590164

    with pytest.raises(ValidationError):
        AssistantResponse(
            interaction_id="INT-0002",
            mode="UNSUPPORTED_MODE",
            headline="h",
            observed_dynamics="o",
            scientific_context="s",
            cited_evidence=[],
            study_caveats=[],
            disclaimer="d",
            latency_ms=1.0,
        )


def _vector_record_payload(**overrides) -> dict:
    """Build a research vector record payload with a 4-float BLOB."""
    import numpy as np

    payload = {
        "chunk_id": "HRP-CARDIO-108::chunk-03",
        "doc_id": "HRP-CARDIO-108",
        "title": "Cardiovascular Adaptations to Long-Duration Spaceflight",
        "authors": "Convertino VA, et al.",
        "report_identifier": "NASA/TP-2020-108",
        "section_heading": "Orthostatic Intolerance",
        "content": "Cardiovascular deconditioning manifests as orthostatic intolerance.",
        "doi_citation": "10.1000/hrpcardio.108",
        "source_repository": "NASA HRP",
        "embedding": np.array([0.1, -0.2, 0.3, -0.4], dtype=np.float32).tobytes(),
    }
    payload.update(overrides)
    return payload


def test_vector_embedding_record_defaults_and_blob_roundtrip():
    """Verify VectorEmbeddingRecord default model tag and byte-exact BLOB round-trip.

    Raw ``bytes`` are not JSON-serializable under Pydantic's default ``utf8``
    byte mode; storage persists the BLOB directly, so the contract checked here
    is the dict/validation round-trip.
    """
    record = VectorEmbeddingRecord(**_vector_record_payload())
    assert record.embedding_model == "all-minilm"
    assert len(record.embedding) == 16

    recovered = VectorEmbeddingRecord.model_validate(record.model_dump())
    assert recovered == record
    assert recovered.embedding == record.embedding

    with pytest.raises(ValidationError):
        record.content = "mutated"


def test_assistant_audit_log_defaults_and_literal_validation():
    """Verify AssistantAuditLog nullable context, defaults, and mode validation."""
    log = AssistantAuditLog(
        log_id="LOG-0001",
        query_text="What explains the Day 127 CO2 event?",
        retrieval_mode="HYBRID_RRF",
        generation_mode="OLLAMA_GENERATIVE",
        response_text="Observed CO2 and heart rate concordance.",
        cited_doc_ids='["HRR-CO2-001"]',
        latency_ms=987.654321,
        created_at="2026-07-08T03:05:00Z",
    )
    assert log.event_id is None
    assert log.astronaut_id is None
    assert log.tripwire_triggered is False
    assert log.latency_ms == 987.654321

    recovered = AssistantAuditLog.model_validate_json(log.model_dump_json())
    assert recovered == log

    with pytest.raises(ValidationError):
        AssistantAuditLog(
            log_id="LOG-0002",
            query_text="q",
            retrieval_mode="UNSUPPORTED_RETRIEVAL",
            generation_mode="EXTRACTIVE_FALLBACK",
            response_text="r",
            cited_doc_ids="[]",
            latency_ms=1.0,
            created_at="2026-07-08T03:05:00Z",
        )


def test_health_status_defaults():
    """Verify HealthStatus reports V3 defaults and vector chunk count."""
    status = HealthStatus(ollama_online=True, vector_store_chunks=128)
    assert status.status == "ok"
    assert status.version == "3.0.0"
    assert status.ollama_online is True
    assert status.vector_store_chunks == 128

    dumped = status.model_dump()
    assert dumped["status"] == "ok"
    assert HealthStatus.model_validate(dumped) == status


def test_explain_event_request_requires_event_and_astronaut():
    """Verify ExplainEventRequest captures the 1-click explanation target."""
    request = ExplainEventRequest(event_id="EVT-DAY127-CO2", astronaut_id="ASTRO-01")
    assert request.event_id == "EVT-DAY127-CO2"
    assert request.astronaut_id == "ASTRO-01"

    with pytest.raises(ValidationError):
        ExplainEventRequest(event_id="EVT-DAY127-CO2")


def test_research_query_request_defaults_and_json_roundtrip():
    """Verify ResearchQueryRequest defaults and JSON round-trip."""
    request = ResearchQueryRequest(query="CO2 cognitive effects")
    assert request.top_k == 5
    assert request.astronaut_id is None

    recovered = ResearchQueryRequest.model_validate_json(request.model_dump_json())
    assert recovered == request


def test_review_event_request_validates_review_status():
    """Verify ReviewEventRequest accepts enum values and rejects unknown status."""
    request = ReviewEventRequest(
        review_status=ReviewStatus.ACKNOWLEDGED,
        review_notes="Clinician acknowledged during next comms window.",
    )
    assert request.review_status == ReviewStatus.ACKNOWLEDGED
    assert request.review_notes == "Clinician acknowledged during next comms window."
    assert ReviewEventRequest(review_status="RESOLVED").review_notes is None

    with pytest.raises(ValidationError):
        ReviewEventRequest(review_status="DEFERRED")


def test_symptom_report_request_defaults_and_severity_bounds():
    """Verify SymptomReportRequest defaults and strict 1..5 severity bounds."""
    request = SymptomReportRequest(
        astronaut_id="ASTRO-01",
        symptom_code="HEADACHE",
        severity=3,
    )
    assert request.severity == 3
    assert request.cabin_module == "Node 2"
    assert request.notes is None
    assert request.occurred_at is None

    for valid_severity in (1, 5):
        assert (
            SymptomReportRequest(
                astronaut_id="ASTRO-01",
                symptom_code="HEADACHE",
                severity=valid_severity,
            ).severity
            == valid_severity
        )

    for invalid_severity in (0, 6):
        with pytest.raises(ValidationError):
            SymptomReportRequest(
                astronaut_id="ASTRO-01",
                symptom_code="HEADACHE",
                severity=invalid_severity,
            )
