/**
 * Pure dossier compiler.
 *
 * Deterministic projection from authoritative cohort data to a portable
 * clinical investigation report. No React, no stores, no network: the same
 * inputs always produce the same report (inject `now` for fixed timestamps).
 *
 * Epistemic invariant: symptom free-text is scanned for prohibited causal or
 * clinical-intervention language. Detection never throws; it flags the row and
 * appends an inline non-causal notice, and every report carries the mandatory
 * decision-support disclaimer.
 */

import type {
  Baselines,
  Measurement,
  QualityStatus,
} from "../../types/api";
import type {
  DossierCompilerInput,
  DossierConcordanceRow,
  DossierEnvironmentalRow,
  DossierFlightRuleRow,
  DossierReport,
  DossierSourceReference,
  DossierSymptomRow,
  DossierVitalsRow,
  EnvironmentalStatus,
  VitalStatus,
} from "./types";

export const NON_CAUSAL_INLINE_NOTE =
  "[Note: Non-causal observation - unverified correlation]";

export const PROHIBITED_CAUSAL_TERMS_SOURCE =
  "\\b(cause|causes|caused|causing|proves|proven|proving|diagnose|diagnosed|diagnosing|diagnosis|prescribe|prescribes|prescribed|prescribing|prescription|treat|treated|treating|treatment|therapeutic|therapy|cure|remedy)\\b";

export const EPISTEMIC_DISCLAIMER =
  "Non-Causal Decision Support Disclaimer: Temporal alignment of environmental excursions and physiological observations indicates co-occurrence only and does not establish clinical causation. WAYFINDER is an operational decision-support tool, not an autonomous diagnostic system. Clinical actions must be verified by flight surgeons.";

/** Fresh regex per call: a global flag would make `.test()` stateful. */
export function containsProhibitedCausalTerms(text: string): boolean {
  if (!text) {
    return false;
  }
  return new RegExp(PROHIBITED_CAUSAL_TERMS_SOURCE, "i").test(text);
}

interface VitalsStreamDefinition {
  streamId: string;
  parameter: string;
  unit: string;
  digits: number;
}

const VITALS_STREAMS: readonly VitalsStreamDefinition[] = [
  { streamId: "stream_sim_hr", parameter: "Resting Heart Rate", unit: "bpm", digits: 0 },
  { streamId: "stream_sim_hrv", parameter: "HRV · RMSSD", unit: "ms", digits: 0 },
  { streamId: "stream_sim_spo2", parameter: "Peripheral SpO₂", unit: "%", digits: 1 },
  { streamId: "stream_sim_temp", parameter: "Core Temperature", unit: "°C", digits: 2 },
];

interface EnvironmentalDefinition {
  streamId: string;
  parameter: string;
  unit: string;
  digits: number;
  fallback: number;
  statusFor: (value: number) => EnvironmentalStatus;
}

const ENVIRONMENTAL_STREAMS: readonly EnvironmentalDefinition[] = [
  {
    streamId: "stream_eda_co2",
    parameter: "Cabin Carbon Dioxide (P_CO₂)",
    unit: "PPM",
    digits: 0,
    fallback: 3197,
    statusFor: (value) => {
      if (value >= 5000) return "ALERT";
      if (value >= 3500) return "CAUTION";
      return "NOMINAL";
    },
  },
  {
    streamId: "stream_sim_radiation",
    parameter: "Ionizing Radiation Dose Rate",
    unit: "mGy/d",
    digits: 3,
    fallback: 0.2,
    statusFor: (value) => {
      if (value >= 0.5) return "ALERT";
      if (value >= 0.25) return "CAUTION";
      return "NOMINAL";
    },
  },
  {
    streamId: "stream_sim_cabin_pressure",
    parameter: "Cabin Pressure",
    unit: "kPa",
    digits: 1,
    fallback: 101.3,
    statusFor: (value) => {
      if (value < 90 || value > 107) return "ALERT";
      if (value < 95 || value > 104) return "CAUTION";
      return "NOMINAL";
    },
  },
  {
    streamId: "stream_sim_cabin_temp",
    parameter: "Cabin Temperature",
    unit: "°C",
    digits: 1,
    fallback: 22.8,
    statusFor: (value) => {
      if (value < 18 || value > 28) return "ALERT";
      if (value < 20 || value > 26) return "CAUTION";
      return "NOMINAL";
    },
  },
];

export const SOURCE_REFERENCES: readonly DossierSourceReference[] = [
  {
    sourceName: "NASA Flight Telemetry EDA",
    datasetIdentifier: "JSC-CN-33120",
    provenance: "AUTHENTIC_NASA_EDA",
  },
  {
    sourceName: "ISS Environmental Health Database",
    datasetIdentifier: "EDA-ISS-EXP71",
    provenance: "AUTHENTIC_NASA_EDA",
  },
  {
    sourceName: "NASA Flight Rules (ECLSS/EVA)",
    datasetIdentifier: "FR-ECLSS-001 · FR-CDRA-002 · FR-EVA-003",
    provenance: "AUTHENTIC_NASA_EDA",
  },
  {
    sourceName: "WAYFINDER Cohort Vitals Simulation",
    datasetIdentifier: "WAYFINDER-SIM-V4",
    provenance: "SYNTHETIC_SIMULATION",
  },
  {
    sourceName: "Crew Symptom Log",
    datasetIdentifier: "WAYFINDER-SYMPTOM-LOG",
    provenance: "CREW_REPORTED",
  },
];

interface BaselineEstimate {
  mean: number;
  std: number;
  upper: number;
  lower: number;
}

/**
 * Pool the 24 hourly baseline envelopes into one circadian estimate.
 * Variances combine within-bin spread with between-bin drift, so a profile
 * with strongly circadian HR still yields an honest global sigma.
 */
function estimateBaseline(baselines: Baselines, streamId: string): BaselineEstimate | null {
  const bins = baselines[streamId];
  if (!bins || bins.length === 0) {
    return null;
  }

  let totalWeight = 0;
  let weightedMean = 0;
  for (const bin of bins) {
    const weight = Math.max(1, bin.sample_count);
    totalWeight += weight;
    weightedMean += bin.mean * weight;
  }
  if (totalWeight === 0) {
    return null;
  }
  const mean = weightedMean / totalWeight;

  let weightedVariance = 0;
  for (const bin of bins) {
    const weight = Math.max(1, bin.sample_count);
    const spread = Number.isFinite(bin.std) ? bin.std : 0;
    weightedVariance += weight * (spread * spread + (bin.mean - mean) ** 2);
  }
  const std = Math.sqrt(weightedVariance / totalWeight);
  const sigma = std > 0 ? std : 0;

  return {
    mean,
    std: sigma,
    upper: mean + 2 * sigma,
    lower: mean - 2 * sigma,
  };
}

function latestMeasurement(
  measurements: Measurement[],
  streamId: string,
): Measurement | null {
  let latest: Measurement | null = null;
  for (const measurement of measurements) {
    if (measurement.stream_id !== streamId) {
      continue;
    }
    if (!latest || measurement.timestamp > latest.timestamp) {
      latest = measurement;
    }
  }
  return latest;
}

function vitalStatusFor(sigma: number): VitalStatus {
  const magnitude = Math.abs(sigma);
  if (magnitude >= 3) return "ANOMALOUS";
  if (magnitude >= 2) return "SUSPECT";
  return "NOMINAL";
}

function qualityOf(measurement: Measurement | null): QualityStatus {
  return measurement?.quality_status ?? "GAP";
}

function buildVitalsSummary(input: DossierCompilerInput): DossierVitalsRow[] {
  return VITALS_STREAMS.map((definition) => {
    const latest = latestMeasurement(input.measurements, definition.streamId);
    const baseline = estimateBaseline(input.baselines, definition.streamId);
    const mean = baseline?.mean ?? 0;
    const std = baseline?.std ?? 0;
    const value = latest?.value;
    const deviationSigma =
      value !== undefined && std > 0 ? (value - mean) / std : 0;

    return {
      parameter: definition.parameter,
      value: value !== undefined ? value.toFixed(definition.digits) : "—",
      unit: definition.unit,
      baselineRange: baseline
        ? `${baseline.mean.toFixed(definition.digits)} ± ${(2 * baseline.std).toFixed(definition.digits)} ${definition.unit}`
        : "No calibrated baseline",
      deviationSigma: Number(deviationSigma.toFixed(2)),
      status: latest ? vitalStatusFor(deviationSigma) : "NOMINAL",
      qualityStatus: qualityOf(latest),
    };
  });
}

function buildEnvironmentalSnapshot(
  input: DossierCompilerInput,
): DossierEnvironmentalRow[] {
  return ENVIRONMENTAL_STREAMS.map((definition) => {
    const latest = latestMeasurement(input.measurements, definition.streamId);
    const value = latest ? latest.value : definition.fallback;
    return {
      parameter: definition.parameter,
      value: value.toFixed(definition.digits),
      unit: definition.unit,
      status: definition.statusFor(value),
      // A missing stream is imputed from the canonical ISS nominal snapshot.
      qualityStatus: latest ? qualityOf(latest) : "IMPUTED",
    };
  });
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildSymptomHistory(input: DossierCompilerInput): DossierSymptomRow[] {
  return [...input.symptoms]
    .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at))
    .map((symptom) => {
      const notes = symptom.notes?.trim();
      const flagged = notes ? containsProhibitedCausalTerms(notes) : false;
      return {
        occurredAt: symptom.occurred_at,
        symptom: titleCase(symptom.symptom_code),
        severity: symptom.severity,
        module: symptom.cabin_module ?? "Not specified",
        notes: flagged ? `${notes} ${NON_CAUSAL_INLINE_NOTE}` : notes,
        nonCausalFlag: flagged,
      };
    });
}

function buildConcordanceEvents(input: DossierCompilerInput): DossierConcordanceRow[] {
  return [...input.events]
    .sort((left, right) => right.start_time.localeCompare(left.start_time))
    .map((event) => ({
      eventId: event.event_id,
      title: titleCase(event.event_type),
      severity: event.severity_level,
      rationale: event.rationale,
      timeWindow: `${event.start_time} → ${event.end_time}`,
    }));
}

function buildFlightRules(input: DossierCompilerInput): DossierFlightRuleRow[] {
  const rules = input.activeFlightRules ?? [];
  return [...rules]
    .sort((left, right) => left.rule_id.localeCompare(right.rule_id))
    .map((rule) => ({
      ruleId: rule.rule_id,
      title: rule.title,
      sha256Hash: rule.sha256_hash,
      checklistSteps: [...rule.checklist_steps]
        .sort((left, right) => left.step_number - right.step_number)
        .map((step) => ({
          stepNumber: step.step_number,
          instruction: step.action,
          verified: false,
        })),
    }));
}

function deriveTimeWindow(input: DossierCompilerInput): DossierReport["metadata"]["timeWindow"] {
  if (input.timeWindow) {
    return input.timeWindow;
  }
  const timestamps = input.measurements
    .map((measurement) => measurement.timestamp)
    .sort();
  if (timestamps.length === 0) {
    return {
      start: input.astronaut.baseline_calibrated_at ?? "Unavailable",
      end: input.astronaut.baseline_calibrated_at ?? "Unavailable",
      missionDayRange: `${input.astronaut.baseline_window_days}-day baseline`,
    };
  }
  const start = timestamps[0];
  const end = timestamps[timestamps.length - 1];
  const spanMs = Math.max(0, Date.parse(end) - Date.parse(start));
  const days = Number.isFinite(spanMs) ? spanMs / 86_400_000 : 0;
  return {
    start,
    end,
    missionDayRange: `${days.toFixed(1)}-day telemetry window`,
  };
}

function buildReportId(astronautId: string, generatedAt: string): string {
  const stamp = generatedAt.replace(/\D/g, "").slice(0, 14);
  return `WF-${astronautId}-${stamp}`;
}

export function compileDossier(input: DossierCompilerInput): DossierReport {
  const now = input.now ?? new Date();
  const generatedAt = now.toISOString();

  return {
    metadata: {
      reportId: buildReportId(input.astronaut.astronaut_id, generatedAt),
      generatedAt,
      timeWindow: deriveTimeWindow(input),
      missionId: input.astronaut.mission_id,
      astronautId: input.astronaut.astronaut_id,
      callsign: input.astronaut.callsign,
      crewRole: input.astronaut.crew_role,
    },
    vitalsSummary: buildVitalsSummary(input),
    environmentalSnapshot: buildEnvironmentalSnapshot(input),
    symptomHistory: buildSymptomHistory(input),
    concordanceEvents: buildConcordanceEvents(input),
    verifiedFlightRules: buildFlightRules(input),
    sourceReferences: [...SOURCE_REFERENCES],
    epistemicDisclaimer: EPISTEMIC_DISCLAIMER,
  };
}
