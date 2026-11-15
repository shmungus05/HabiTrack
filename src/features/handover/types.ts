/**
 * Flight Surgeon Shift Handover Briefing domain types.
 * Pure TypeScript contract - zero backend dependencies.
 */

import type {
  Astronaut,
  Baselines,
  FlightRule,
  HealthEvent,
  Measurement,
  QualityStatus,
  SeverityLevel,
  SymptomReport,
  UncertaintyLevel,
} from "../../types/api.ts";

export type HandoverWindowHours = 6 | 12 | 24 | number;

export interface HandoverWindow {
  mode: "normal" | "simulation";
  startIso: string;
  endIso: string;
  hours: number;
  timezone: string;
  isClockMismatched?: boolean;
}

export type CrewChangeKind = "event" | "symptom" | "vital_delta" | "telemetry";

export interface CrewChangeItem {
  kind: CrewChangeKind;
  label: string;
  value: string;
  baselineDelta?: string;
  sourceId: string;
  severity?: SeverityLevel;
}

export interface CrewHandoverSummary {
  astronautId: string;
  callsign: string;
  crewRole: string;
  changes: CrewChangeItem[];
}

export interface PendingReviewItem {
  kind: "event" | "symptom";
  id: string;
  astronautId: string;
  callsign: string;
  severity: SeverityLevel;
  uncertainty?: UncertaintyLevel;
  ageHours: number;
  title: string;
  sourceId: string;
}

export interface DataQualitySummary {
  valid: number;
  suspect: number;
  stale: number;
  gap: number;
  imputed: number;
  importedSources: string[];
  missingStreams: string[];
  clockWarning?: string;
}

export interface EvidencePointer {
  type: "flight_rule" | "research";
  id: string;
  title: string;
}

export interface ShiftHandoverBriefing {
  window: HandoverWindow;
  crew: CrewHandoverSummary[];
  pendingReviews: PendingReviewItem[];
  dataQuality: DataQualitySummary;
  evidencePointers: EvidencePointer[];
  focusPrompts: string[];
  disclaimer: string;
  generatedBy: "deterministic" | "llm";
}

/** Pure input shape required by the deterministic compiler */
export interface HandoverInputs {
  astronauts: Astronaut[];
  eventsByAstronaut: Record<string, HealthEvent[]>;
  symptomsByAstronaut: Record<string, SymptomReport[]>;
  baselinesByAstronaut: Record<string, Baselines>;
  measurementsByAstronaut: Record<string, Measurement[]>;
  flightRules: FlightRule[];
  missionTimeMs: number;
  windowHours: number;
  isSimulation: boolean;
}
