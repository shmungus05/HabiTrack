/**
 * Authoritative contracts for the structured clinical investigation dossier.
 *
 * The dossier is a projection of authoritative cohort state, never a new
 * source of truth: the compiler reads typed API payloads and emits a portable
 * report for download, clipboard use, print-to-PDF, or ground downlink.
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

export interface DossierVitalsRow {
  parameter: string;
  value: string;
  unit: string;
  baselineRange: string;
  deviationSigma: number;
  status: VitalStatus;
  qualityStatus: QualityStatus;
}

export interface DossierEnvironmentalRow {
  parameter: string;
  value: string;
  unit: string;
  status: EnvironmentalStatus;
  qualityStatus: QualityStatus;
}

export interface DossierSymptomRow {
  occurredAt: string;
  symptom: string;
  severity: number;
  module: string;
  notes?: string;
  nonCausalFlag?: boolean;
}

export interface DossierConcordanceRow {
  eventId: string;
  title: string;
  severity: string;
  rationale: string;
  timeWindow: string;
}

export interface DossierFlightRuleStep {
  stepNumber: number;
  instruction: string;
  verified: boolean;
  verifiedAt?: string;
}

export interface DossierFlightRuleRow {
  ruleId: string;
  title: string;
  checklistSteps: DossierFlightRuleStep[];
  sha256Hash: string;
}

export interface DossierSourceReference {
  sourceName: string;
  datasetIdentifier: string;
  doi?: string;
  provenance: "AUTHENTIC_NASA_EDA" | "SYNTHETIC_SIMULATION" | "CREW_REPORTED";
}

export interface DossierMetadata {
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

export interface DossierReport {
  metadata: DossierMetadata;
  vitalsSummary: DossierVitalsRow[];
  environmentalSnapshot: DossierEnvironmentalRow[];
  symptomHistory: DossierSymptomRow[];
  concordanceEvents: DossierConcordanceRow[];
  verifiedFlightRules: DossierFlightRuleRow[];
  sourceReferences: DossierSourceReference[];
  epistemicDisclaimer: string;
}

/**
 * Raw inputs, exactly as returned by the typed FastAPI client.
 * `activeFlightRules` is optional so a dossier still compiles when the rule
 * corpus is unavailable.
 */
export interface DossierSourceData {
  astronaut: Astronaut;
  baselines: Baselines;
  measurements: Measurement[];
  symptoms: SymptomReport[];
  events: HealthEvent[];
  activeFlightRules?: FlightRule[];
}

export interface DossierCompilerInput extends DossierSourceData {
  timeWindow?: {
    start: string;
    end: string;
    missionDayRange: string;
  };
  /** Injectable clock for deterministic tests and reproducible exports. */
  now?: Date;
}

export interface CompiledDossier {
  report: DossierReport;
  markdown: string;
  html: string;
}
