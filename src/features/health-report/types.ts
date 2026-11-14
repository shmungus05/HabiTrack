/**
 * Authoritative contracts for the structured clinical health report.
 *
 * The health report is a projection of authoritative cohort state, never a new
 * source of truth: the compiler reads typed API payloads and emits a portable
 * report for PDF download or print-to-PDF.
 */

import type {
  Astronaut,
  Baselines,
  FlightRule,
  HealthEvent,
  Measurement,
  QualityStatus,
  SymptomReport,
} from "../../types/api";

export type VitalStatus = "NOMINAL" | "SUSPECT" | "ANOMALOUS";
export type EnvironmentalStatus = "NOMINAL" | "CAUTION" | "ALERT";

export interface HealthReportVitalsRow {
  parameter: string;
  value: string;
  unit: string;
  baselineRange: string;
  deviationSigma: number;
  status: VitalStatus;
  qualityStatus: QualityStatus;
}

export interface HealthReportEnvironmentalRow {
  parameter: string;
  value: string;
  unit: string;
  status: EnvironmentalStatus;
  qualityStatus: QualityStatus;
}

export interface HealthReportSymptomRow {
  occurredAt: string;
  symptom: string;
  severity: number;
  module: string;
  notes?: string;
  nonCausalFlag?: boolean;
}

export interface HealthReportConcordanceRow {
  eventId: string;
  title: string;
  severity: string;
  rationale: string;
  timeWindow: string;
}

export interface HealthReportFlightRuleStep {
  stepNumber: number;
  instruction: string;
  verified: boolean;
  verifiedAt?: string;
}

export interface HealthReportFlightRuleRow {
  ruleId: string;
  title: string;
  checklistSteps: HealthReportFlightRuleStep[];
  sha256Hash: string;
}

export interface HealthReportSourceReference {
  sourceName: string;
  datasetIdentifier: string;
  doi?: string;
  provenance: "AUTHENTIC_NASA_EDA" | "SYNTHETIC_SIMULATION" | "CREW_REPORTED";
}

export interface HealthReportMetadata {
  reportId: string;
  generatedAt: string;
  timeWindow: {
    start: string;
    end: string;
    missionDayRange: string;
  };
  missionId: string;
  astronautId: string;
  callsign: string;
  crewRole: string;
}

export interface HealthReport {
  metadata: HealthReportMetadata;
  vitalsSummary: HealthReportVitalsRow[];
  environmentalSnapshot: HealthReportEnvironmentalRow[];
  symptomHistory: HealthReportSymptomRow[];
  concordanceEvents: HealthReportConcordanceRow[];
  verifiedFlightRules: HealthReportFlightRuleRow[];
  sourceReferences: HealthReportSourceReference[];
  epistemicDisclaimer: string;
}

/**
 * Raw inputs, exactly as returned by the typed FastAPI client.
 * `activeFlightRules` is optional so a health report still compiles when the rule
 * corpus is unavailable.
 */
export interface HealthReportSourceData {
  astronaut: Astronaut;
  baselines: Baselines;
  measurements: Measurement[];
  symptoms: SymptomReport[];
  events: HealthEvent[];
  activeFlightRules?: FlightRule[];
}

export interface HealthReportInput extends HealthReportSourceData {
  timeWindow?: {
    start: string;
    end: string;
    missionDayRange: string;
  };
  /** Injectable clock for deterministic tests and reproducible exports. */
  now?: Date;
}

export interface CompiledHealthReport {
  report: HealthReport;
  html: string;
}
