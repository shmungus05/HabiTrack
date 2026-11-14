/**
 * Strongly-typed domain models for HabiTrack.
 */

export type CalibrationStatus = "CALIBRATING" | "CALIBRATED";
export type ProvenanceCategory =
  | "AUTHENTIC_NASA_EDA"
  | "SYNTHETIC_SIMULATION"
  | "CREW_REPORTED"
  | "HUAWEI_HEALTH";
export type QualityStatus = "VALID" | "SUSPECT" | "IMPUTED" | "STALE" | "GAP";
export type SeverityLevel = "INFO" | "OBSERVE" | "INVESTIGATE";
export type UncertaintyLevel = "LOW" | "MODERATE" | "HIGH";
export type ReviewStatus = "PENDING" | "ACKNOWLEDGED" | "RESOLVED";
export type AssistantMode =
  | "OLLAMA_GENERATIVE"
  | "EXTRACTIVE_FALLBACK"
  | "GEMINI_GENERATIVE";
export type SeverityTrigger = "INFO" | "OBSERVE" | "INVESTIGATE" | "EMERGENCY";

export interface ChecklistStep {
  step_number: number;
  action: string;
  target_subsystem: string;
  verification: string | null;
  caution_warning: string | null;
}

export interface FlightRule {
  rule_id: string;
  title: string;
  subsystem: string;
  revision_date: string;
  severity_trigger: SeverityTrigger;
  condition_threshold: string;
  verbatim_text: string;
  sha256_hash: string;
  checklist_steps: ChecklistStep[];
  reference_docs: string[];
  created_at?: string;
}

export interface Astronaut {
  astronaut_id: string;
  callsign: string;
  mission_id: string;
  crew_role: string;
  baseline_calibrated_at: string | null;
  baseline_parameters: string | null;
  resting_hr: number;
  resting_rmssd: number;
  resting_spo2: number;
  resting_temp: number;
  circadian_phase_shift_hours: number;
  baseline_window_days: number;
  calibration_status: CalibrationStatus;
}

export interface Measurement {
  id: number | null;
  stream_id: string;
  astronaut_id: string | null;
  timestamp: string;
  value: number;
  quality_status: QualityStatus;
  is_synthetic: boolean;
  provenance_category: ProvenanceCategory | null;
}

export interface SymptomReport {
  report_id: string;
  astronaut_id: string;
  symptom_code: string;
  severity: number;
  occurred_at: string;
  reported_at: string;
  cabin_module: string | null;
  notes: string | null;
  is_synthetic: boolean;
}

export interface HealthEvent {
  event_id: string;
  astronaut_id: string;
  event_type: string;
  severity_level: SeverityLevel;
  start_time: string;
  end_time: string;
  contributing_stream_ids: string;
  symptom_report_id: string | null;
  rationale: string;
  peak_deviation_sigma: number | null;
  uncertainty_level: UncertaintyLevel;
  review_status: ReviewStatus;
  review_notes: string | null;
}

export interface CitedEvidence {
  chunk_id: string;
  doc_id: string;
  title: string;
  authors: string | null;
  report_identifier: string | null;
  section_heading: string;
  doi_citation: string | null;
  source_repository: string;
  excerpt: string;
  rrf_score: number;
  relevance_pct: number;
}

export interface AssistantResponse {
  interaction_id: string;
  astronaut_id: string | null;
  event_id: string | null;
  mode: AssistantMode;
  headline: string;
  observed_dynamics: string;
  scientific_context: string;
  cited_evidence: CitedEvidence[];
  study_caveats: string[];
  disclaimer: string;
  tripwire_triggered: boolean;
  latency_ms: number;
  flight_rule_cited?: FlightRule | null;
  verbatim_checklist?: ChecklistStep[];
  provider_used?: string | null;
  answer?: string | null;
}

export interface ProviderStatusResponse {
  active_provider: string;
  gemini_available: boolean;
  ollama_available: boolean;
  gemini_audio_testing_enabled: boolean;
  active_model_name: string;
}

export interface AssistantQueryRequest {
  query: string;
  astronaut_id?: string | null;
  concordance_event_id?: string | null;
  top_k?: number;
  client_timestamp?: string | null;
}

export interface HealthStatus {
  status: string;
  version: string;
  ollama_online: boolean;
  vector_store_chunks: number;
}

export interface CircadianBinStats {
  hour_bin: number;
  timestamp: string;
  mean: number;
  std: number;
  upper: number;
  lower: number;
  sample_count: number;
  distinct_days: number;
  calibration_status: CalibrationStatus;
}

/** `/api/telemetry/baselines` response: stream id → 24 hourly envelopes. */
export type Baselines = Record<string, CircadianBinStats[]>;

export interface SymptomReportRequest {
  astronaut_id: string;
  symptom_code: string;
  severity: number;
  cabin_module?: string | null;
  notes?: string | null;
  occurred_at?: string | null;
}

export interface ReviewEventRequest {
  review_status: ReviewStatus;
  review_notes?: string | null;
}
