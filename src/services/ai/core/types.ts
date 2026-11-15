/**
 * src/services/ai/core/types.ts
 *
 * Core domain contracts, Seam interfaces, and Request/Response definitions
 * for the Deep FlightSI Module in HabiTrack.
 */

import type {
  AssistantResponse,
  ChecklistStep,
  CitedEvidence,
  FlightRule,
  SpaceCareIntent,
  SpaceCareResourceReference,
} from "../../../types/api.ts";
import type { ShiftHandoverBriefing } from "../../../features/handover/types.ts";

export type { ShiftHandoverBriefing };

export interface TelemetrySnapshot {
  co2Ppm: number;
  tempC: number;
  humidityPct: number;
  radiationRateMGy: number;
  pressureMmHg: number;
}

export interface InterimActionItem {
  id: string;
  stepNumber: number;
  action: string;
  rationale: string;
  estimatedMinutes: number;
  completed: boolean;
}

export interface SurgeonHandoffPacket {
  packetId: string;
  createdAtIso: string;
  astronautId: string;
  symptomReported: string;
  compartmentName: string;
  environmentalSnapshot: TelemetrySnapshot;
  latchedRuleId: string;
  interimActionsCount: number;
}

export interface SymptomConsentState {
  status: "PENDING" | "CONFIRMED" | "DISMISSED";
  symptomText: string;
  location: string;
  snapshot: TelemetrySnapshot;
  astronautId: string;
  callsign?: string;
  latchedRuleId?: string;
  confirmedAt?: string;
}

export type SymptomCategory =
  | "HEADACHE_HYPERCAPNIA"
  | "MUSCLE_SORENESS"
  | "SLEEP_DISTURBANCE"
  | "OCULAR_IRRITATION"
  | "THERMAL_EXERTION"
  | "NEUROVESTIBULAR_DIZZINESS"
  | "CRITICAL_EMERGENCY"
  | "GENERIC_DISCOMFORT";

export type ConversationalIntent = SpaceCareIntent;

export interface ChatMessageTurn {
  role: "user" | "model";
  text: string;
}

/* ========================================================================== */
/*                                SEAM: LlmAdapter                            */
/* ========================================================================== */

export interface LlmTextParams {
  systemInstruction?: string;
  prompt: string;
  history?: ChatMessageTurn[];
  temperature?: number;
  maxOutputTokens?: number;
}

export interface LlmTextResult {
  text: string;
  provider: string;
  isFallback: boolean;
}

export interface LlmStructuredParams<T> {
  systemInstruction?: string;
  prompt: string;
  schema?: unknown;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface LlmStructuredResult<T> {
  data: T;
  provider: string;
  isFallback: boolean;
}

/**
 * Clean Seam where LLM implementations (Frontier, Local WebGPU, Extractive, Mock)
 * are plugged into the deep FlightSI module.
 */
export interface LlmAdapter {
  readonly id: string;
  readonly displayName: string;
  isReady(): boolean;
  completeText(params: LlmTextParams): Promise<LlmTextResult>;
  completeStructured<T>(params: LlmStructuredParams<T>): Promise<LlmStructuredResult<T>>;
}

/* ========================================================================== */
/*                      MODULE INTERFACE: Requests & Results                  */
/* ========================================================================== */

export interface SIRequest {
  query: string;
  astronautId?: string | null;
  concordanceEventId?: string | null;
  compartmentOverride?: string | null;
  history?: ChatMessageTurn[];
  telemetryContext?: (TelemetrySnapshot & { compartment?: string }) | null;
}

export interface SITurnResult {
  text: string;
  provider: string;
  isFallback: boolean;
  headline: string;
  intent: ConversationalIntent;
  resources: SpaceCareResourceReference[];
  citedEvidence: CitedEvidence[];
  flightRuleCited?: FlightRule | null;
  verbatimChecklist?: ChecklistStep[];
  studyCaveats: string[];
  disclaimer: string;
  tripwireTriggered: boolean;
  rawResponse?: AssistantResponse;
}

export interface SymptomTriageRequest {
  symptomText: string;
  astronautId?: string | null;
  compartmentOverride?: string | null;
  snapshot?: TelemetrySnapshot | null;
}

export interface TriageTurnResult {
  headline: string;
  conversationalOverview?: string;
  symptomText: string;
  compartmentName: string;
  compartmentId: string;
  primarySymptomCategory: SymptomCategory;
  intent: ConversationalIntent;
  telemetryReadings: TelemetrySnapshot & { airflowProfile: string };
  interimActions: InterimActionItem[];
  resources: SpaceCareResourceReference[];
  followupQuestions: string[];
  latchedRuleId: string;
  flightRuleTitle: string;
  biologicalLatencyLag: string;
  physiologicalRationale: string;
  confidenceMatch: string;
  disclaimer: string;
  tripwireTriggered: boolean;
  surgeonHandoffPacket: SurgeonHandoffPacket;
  symptomConsent: SymptomConsentState;
  provider: string;
}

export interface ShiftBriefingRequest {
  windowHours: number;
  briefingData: ShiftHandoverBriefing;
}

export interface BriefingTurnResult {
  narrativeText: string;
  generatedBy: "deterministic" | "llm";
  provider: string;
  briefing: ShiftHandoverBriefing;
  disclaimer: string;
}

/**
 * Deep Module Interface: Single high-leverage entry point for all spaceflight SI tasks.
 */
export interface FlightSI {
  interact(request: SIRequest): Promise<SITurnResult>;
  triageSymptom(request: SymptomTriageRequest): Promise<TriageTurnResult>;
  generateShiftBriefing(request: ShiftBriefingRequest): Promise<BriefingTurnResult>;
}
