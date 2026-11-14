"""
wayfinder.core.models: Pydantic V2 domain models and enums for WAYFINDER.
"""

from enum import Enum
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class CalibrationStatus(str, Enum):
    """Circadian baseline calibration lifecycle state."""
    CALIBRATING = "CALIBRATING"
    CALIBRATED = "CALIBRATED"


class ProvenanceCategory(str, Enum):
    """Authoritative origin of data."""
    AUTHENTIC_NASA_EDA = "AUTHENTIC_NASA_EDA"
    SYNTHETIC_SIMULATION = "SYNTHETIC_SIMULATION"
    CREW_REPORTED = "CREW_REPORTED"


class QualityStatus(str, Enum):
    """Integrity state of telemetry measurements."""
    VALID = "VALID"
    SUSPECT = "SUSPECT"
    IMPUTED = "IMPUTED"
    STALE = "STALE"
    GAP = "GAP"


class MetricCategory(str, Enum):
    """Categorical classification of telemetry streams."""
    ENVIRONMENTAL = "ENVIRONMENTAL"
    PHYSIOLOGICAL = "PHYSIOLOGICAL"


class SeverityLevel(str, Enum):
    """Operational priority and review severity."""
    INFO = "INFO"
    OBSERVE = "OBSERVE"
    INVESTIGATE = "INVESTIGATE"


class UncertaintyLevel(str, Enum):
    """Analytical confidence based on telemetry gaps and spatial context."""
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"


class ReviewStatus(str, Enum):
    """Human-in-the-loop review state."""
    PENDING = "PENDING"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"


class Astronaut(BaseModel):
    """Astronaut mission profile and baseline physiological calibration."""
    model_config = ConfigDict(frozen=True)

    astronaut_id: str
    callsign: str
    mission_id: str
    crew_role: str
    baseline_calibrated_at: Optional[str] = None
    baseline_parameters: Optional[str] = None
    resting_hr: float = 65.0
    resting_rmssd: float = 55.0
    resting_spo2: float = 98.0
    resting_temp: float = 37.0
    circadian_phase_shift_hours: float = 0.0
    baseline_window_days: int = 7
    calibration_status: CalibrationStatus = CalibrationStatus.CALIBRATING


class DataSource(BaseModel):
    """Metadata origin descriptor for streams."""
    model_config = ConfigDict(frozen=True)

    source_id: str
    source_name: str
    provenance_category: ProvenanceCategory
    dataset_identifier: Optional[str] = None
    sampling_frequency_hz: Optional[float] = None


class TelemetryStream(BaseModel):
    """Registered continuous telemetry channel."""
    model_config = ConfigDict(frozen=True)

    stream_id: str
    source_id: str
    metric_name: str
    metric_category: MetricCategory
    unit: str
    nominal_min: Optional[float] = None
    nominal_max: Optional[float] = None


class Measurement(BaseModel):
    """Time-series observation point."""
    model_config = ConfigDict(frozen=True)

    id: Optional[int] = None
    stream_id: str
    astronaut_id: Optional[str] = None
    timestamp: str
    value: float
    quality_status: QualityStatus = QualityStatus.VALID
    is_synthetic: bool = False
    provenance_category: Optional[ProvenanceCategory] = None


class SymptomReport(BaseModel):
    """Crew-submitted clinical discomfort record."""
    model_config = ConfigDict(frozen=True)

    report_id: str
    astronaut_id: str
    symptom_code: str
    severity: int = Field(ge=1, le=5)
    occurred_at: str
    reported_at: str
    cabin_module: Optional[str] = None
    notes: Optional[str] = None
    is_synthetic: bool = False


class HealthEvent(BaseModel):
    """Explainable temporal association finding."""
    model_config = ConfigDict(frozen=True)

    event_id: str
    astronaut_id: str
    event_type: str
    severity_level: SeverityLevel
    start_time: str
    end_time: str
    contributing_stream_ids: str
    symptom_report_id: Optional[str] = None
    rationale: str
    peak_deviation_sigma: Optional[float] = None
    uncertainty_level: UncertaintyLevel
    review_status: ReviewStatus = ReviewStatus.PENDING
    review_notes: Optional[str] = None


class ResearchDocument(BaseModel):
    """Curated scientific knowledge excerpt."""
    model_config = ConfigDict(frozen=True)

    doc_id: str
    title: str
    section_heading: str
    content: str
    doi_citation: Optional[str] = None
    source_repository: str


class CircadianBinStats(BaseModel):
    """In-memory analytical representation of a circadian hourly statistical bin."""
    model_config = ConfigDict(frozen=True)

    stream_id: str
    astronaut_id: str
    hour_bin: int = Field(ge=0, le=23)
    mean: float
    std: float
    sample_count: int
    distinct_days: int
    calibration_status: CalibrationStatus


class BaselineDeviation(BaseModel):
    """Instantaneous deviation observation against calibrated circadian baseline."""
    model_config = ConfigDict(frozen=True)

    timestamp: str
    stream_id: str
    astronaut_id: str
    value: float
    expected_mean: float
    expected_std: float
    z_score: float
    is_statistical_deviation: bool


class CoalescedAutonomicInterval(BaseModel):
    """Consolidated interval episode of contiguous autonomic shift observations."""
    model_config = ConfigDict(frozen=True)

    event_id: str
    start_time: str
    end_time: str
    duration_minutes: float
    sample_count: int
    peak_z_hr: float
    peak_hr_value: float
    nadir_z_rmssd: float
    nadir_rmssd_value: float
    peak_hr_diff: Optional[float] = None
    nadir_rmssd_diff: Optional[float] = None
    astronaut_id: Optional[str] = None

    def __getitem__(self, item: str):
        return getattr(self, item)

    def __contains__(self, item: str):
        return hasattr(self, item) and getattr(self, item) is not None


class CitedEvidence(BaseModel):
    """Scientific Evidence Card: curated literature passage supporting decision support."""
    model_config = ConfigDict(frozen=True)

    chunk_id: str
    doc_id: str
    title: str
    authors: Optional[str] = None
    report_identifier: Optional[str] = None
    section_heading: str
    doi_citation: Optional[str] = None
    source_repository: str
    excerpt: str
    rrf_score: float
    relevance_pct: float


class SeverityTrigger(str, Enum):
    """Trigger severity classification for operational flight rules."""
    INFO = "INFO"
    OBSERVE = "OBSERVE"
    INVESTIGATE = "INVESTIGATE"
    EMERGENCY = "EMERGENCY"


class ChecklistStep(BaseModel):
    """Individual procedural checklist step within an operational flight rule."""
    model_config = ConfigDict(frozen=True)

    step_number: int
    action: str
    target_subsystem: str
    verification: Optional[str] = None
    caution_warning: Optional[str] = None


class FlightRule(BaseModel):
    """Certified operational flight rule parsed from Markdown."""
    model_config = ConfigDict(frozen=True)

    rule_id: str
    title: str
    subsystem: str
    revision_date: str
    severity_trigger: SeverityTrigger
    condition_threshold: str
    verbatim_text: str
    sha256_hash: str
    checklist_steps: List[ChecklistStep]
    reference_docs: List[str]


class AssistantResponse(BaseModel):
    """Structured clinical decision support explanation payload."""
    model_config = ConfigDict(frozen=True)

    interaction_id: str
    astronaut_id: Optional[str] = None
    event_id: Optional[str] = None
    mode: Literal["OLLAMA_GENERATIVE", "EXTRACTIVE_FALLBACK", "GEMINI_GENERATIVE"]
    headline: str
    observed_dynamics: str
    scientific_context: str
    cited_evidence: List[CitedEvidence]
    study_caveats: List[str]
    disclaimer: str
    tripwire_triggered: bool = False
    latency_ms: float

    # Non-breaking extensions for flight rules & provider telemetry
    flight_rule_cited: Optional[FlightRule] = None
    verbatim_checklist: List[ChecklistStep] = Field(default_factory=list)
    provider_used: Optional[str] = None
    answer: Optional[str] = None


class VectorEmbeddingRecord(BaseModel):
    """Persisted vector embedding record for curated research passage chunks."""
    model_config = ConfigDict(frozen=True)

    chunk_id: str
    doc_id: str
    title: str
    authors: Optional[str] = None
    report_identifier: Optional[str] = None
    section_heading: str
    content: str
    doi_citation: Optional[str] = None
    source_repository: str
    embedding: bytes
    embedding_model: str = "all-minilm"
    corpus_type: str = "RESEARCH"
    rule_id: Optional[str] = None
    sha256_hash: Optional[str] = None


class AssistantAuditLog(BaseModel):
    """Audit trail record for knowledge assistant interactions."""
    model_config = ConfigDict(frozen=True)

    log_id: str
    event_id: Optional[str] = None
    astronaut_id: Optional[str] = None
    query_text: str
    retrieval_mode: Literal["HYBRID_RRF", "LEXICAL_BM25", "DENSE_COSINE"]
    generation_mode: Literal["OLLAMA_GENERATIVE", "EXTRACTIVE_FALLBACK"]
    response_text: str
    cited_doc_ids: str
    tripwire_triggered: bool = False
    latency_ms: float
    created_at: str
    trace_id: Optional[str] = None
    flight_rule_cited: Optional[str] = None
    rule_sha256: Optional[str] = None
    stt_confidence: Optional[float] = None
    stt_duration_sec: Optional[float] = None
    tripwire_match_term: Optional[str] = None
    provider_used: Optional[str] = None


class HealthStatus(BaseModel):
    """System health payload including vector store and local model status."""
    model_config = ConfigDict(frozen=True)

    status: str = "ok"
    version: str = "3.0.0"
    ollama_online: bool
    vector_store_chunks: int


class ExplainEventRequest(BaseModel):
    """REST request to explain a specific health event."""
    event_id: str
    astronaut_id: str


class ResearchQueryRequest(BaseModel):
    """REST request for an ad-hoc research literature query."""
    query: str
    top_k: int = 5
    astronaut_id: Optional[str] = None


class AssistantQueryRequest(BaseModel):
    """REST request for contextual decision support or flight rule queries."""
    query: str = Field(..., min_length=2, max_length=1000)
    astronaut_id: Optional[str] = None
    concordance_event_id: Optional[str] = None
    top_k: int = Field(default=5, ge=1, le=20)
    client_timestamp: Optional[str] = None


class ProviderStatusResponse(BaseModel):
    """Health and key availability response for assistant decision support providers."""
    model_config = ConfigDict(frozen=True)

    active_provider: str
    gemini_available: bool
    ollama_available: bool
    gemini_audio_testing_enabled: bool
    active_model_name: str


class ReviewEventRequest(BaseModel):
    """REST request to update human-in-the-loop review state."""
    review_status: ReviewStatus
    review_notes: Optional[str] = None


class SymptomReportRequest(BaseModel):
    """REST request to log a crew-reported symptom."""
    astronaut_id: str
    symptom_code: str
    severity: int = Field(..., ge=1, le=5)
    cabin_module: Optional[str] = "Node 2"
    notes: Optional[str] = None
    occurred_at: Optional[str] = None
