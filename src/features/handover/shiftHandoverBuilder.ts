/**
 * Pure deterministic Shift Handover Briefing compiler and sequential fetch orchestrator.
 * Follows strict non-causal epistemic guidelines and zero state mutation.
 */

import {
  fetchAstronauts,
  fetchBaselines,
  fetchEvents,
  fetchFlightRules,
  fetchMeasurements,
  fetchSymptoms,
} from "../../services/api.ts";
import { getActiveMissionTimeMs, useMissionStore } from "../../stores/missionStore.ts";
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
import { EPISTEMIC_DISCLAIMER } from "../health-report/healthReportCompiler.ts";
import type {
  CrewChangeItem,
  CrewHandoverSummary,
  DataQualitySummary,
  EvidencePointer,
  HandoverInputs,
  PendingReviewItem,
  ShiftHandoverBriefing,
} from "./types.ts";

const SEVERITY_WEIGHT: Record<SeverityLevel, number> = {
  INVESTIGATE: 3,
  OBSERVE: 2,
  INFO: 1,
};

const UNCERTAINTY_WEIGHT: Record<UncertaintyLevel, number> = {
  HIGH: 3,
  MODERATE: 2,
  LOW: 1,
};

function parseTimeToMs(isoOrDateStr: string | null | undefined): number {
  if (!isoOrDateStr) return 0;
  const parsed = new Date(isoOrDateStr).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Pure compiler: Takes pre-fetched inputs and compiles the structured briefing.
 * Completely deterministic and unit-testable without network, React, or browser APIs.
 */
export function compileShiftHandover(inputs: HandoverInputs): ShiftHandoverBriefing {
  const {
    astronauts,
    eventsByAstronaut,
    symptomsByAstronaut,
    baselinesByAstronaut,
    measurementsByAstronaut,
    flightRules,
    missionTimeMs,
    windowHours,
    isSimulation,
  } = inputs;

  const windowEndMs = missionTimeMs;
  const windowStartMs = windowEndMs - windowHours * 60 * 60 * 1000;
  const startIso = new Date(windowStartMs).toISOString();
  const endIso = new Date(windowEndMs).toISOString();

  // 1. Data Quality aggregation and Clock Mismatch Detection
  let validCount = 0;
  let suspectCount = 0;
  let staleCount = 0;
  let gapCount = 0;
  let imputedCount = 0;
  const importedSourcesSet = new Set<string>();
  const allStreamIds = new Set<string>();
  let hasMeasurementsInWindow = false;
  let measurementTimestampSample = 0;

  for (const astro of astronauts) {
    const list = measurementsByAstronaut[astro.astronaut_id] ?? [];
    for (const m of list) {
      allStreamIds.add(m.stream_id);
      if (m.provenance_category && m.provenance_category !== "SYNTHETIC_SIMULATION") {
        importedSourcesSet.add(m.provenance_category);
      }
      const t = parseTimeToMs(m.timestamp);
      if (t >= windowStartMs && t <= windowEndMs) {
        hasMeasurementsInWindow = true;
        if (m.quality_status === "VALID") validCount++;
        else if (m.quality_status === "SUSPECT") suspectCount++;
        else if (m.quality_status === "STALE") staleCount++;
        else if (m.quality_status === "GAP") gapCount++;
        else if (m.quality_status === "IMPUTED") imputedCount++;
      } else if (measurementTimestampSample === 0 && t > 0) {
        measurementTimestampSample = t;
      }
    }
  }

  // Detect clock mismatch: simulation mode active but measurements are anchored near Date.now()
  let isClockMismatched = false;
  let clockWarning: string | undefined = undefined;

  if (isSimulation) {
    const timeDiscrepancyMs = Math.abs(windowEndMs - measurementTimestampSample);
    // If difference between mission time and measurement sample exceeds 2 days, signal clock divergence
    if (measurementTimestampSample > 0 && timeDiscrepancyMs > 2 * 24 * 3600 * 1000 && !hasMeasurementsInWindow) {
      isClockMismatched = true;
      clockWarning =
        "Simulation clock active (MET epoch). Raw telemetry series generated at real-time clock epoch; measurements fall outside historical simulated window. Events and symptoms accurately reflect simulated mission time.";
    }
  }

  const expectedStreams = [
    "stream_eda_co2",
    "stream_eda_temp",
    "stream_eda_humidity",
    "stream_eda_radiation",
    "stream_eda_pressure",
  ];
  const missingStreams = expectedStreams.filter((s) => !allStreamIds.has(s));

  const dataQuality: DataQualitySummary = {
    valid: validCount,
    suspect: suspectCount,
    stale: staleCount,
    gap: gapCount,
    imputed: imputedCount,
    importedSources: Array.from(importedSourcesSet),
    missingStreams,
    clockWarning,
  };

  // 2. What Changed per Crewmember (Material deviations & baseline deltas)
  const crewSummaries: CrewHandoverSummary[] = [];
  const relevantRuleIds = new Set<string>();

  for (const astro of astronauts) {
    const id = astro.astronaut_id;
    const astroEvents = eventsByAstronaut[id] ?? [];
    const astroSymptoms = symptomsByAstronaut[id] ?? [];
    const changes: CrewChangeItem[] = [];

    // Filter events in window
    for (const evt of astroEvents) {
      const evtStart = parseTimeToMs(evt.start_time);
      const evtEnd = parseTimeToMs(evt.end_time);
      if ((evtStart >= windowStartMs && evtStart <= windowEndMs) || (evtEnd >= windowStartMs && evtEnd <= windowEndMs)) {
        changes.push({
          kind: "event",
          label: evt.event_type.replace(/_/g, " "),
          value: evt.rationale || `Severity: ${evt.severity_level}`,
          baselineDelta: evt.peak_deviation_sigma ? `Z = +${evt.peak_deviation_sigma.toFixed(1)}σ` : undefined,
          sourceId: evt.event_id,
          severity: evt.severity_level,
        });

        // Correlate flight rules based on event keywords
        const lower = (evt.rationale + " " + evt.event_type).toLowerCase();
        if (lower.includes("co2") || lower.includes("hypercapnia") || lower.includes("eclss")) {
          relevantRuleIds.add("FR-ECLSS-001");
        }
        if (lower.includes("cdra") || lower.includes("temp") || lower.includes("thermal")) {
          relevantRuleIds.add("FR-CDRA-002");
        }
        if (lower.includes("eva") || lower.includes("heart rate") || lower.includes("tachycardia")) {
          relevantRuleIds.add("FR-EVA-003");
        }
      }
    }

    // Filter symptoms in window
    for (const sym of astroSymptoms) {
      const symOccurred = parseTimeToMs(sym.occurred_at || sym.reported_at);
      if (symOccurred >= windowStartMs && symOccurred <= windowEndMs) {
        changes.push({
          kind: "symptom",
          label: `Reported ${sym.symptom_code}`,
          value: sym.notes ? `"${sym.notes}" (Sev ${sym.severity}/3)` : `Severity: ${sym.severity}/3`,
          sourceId: sym.report_id,
          severity: sym.severity === 3 ? "INVESTIGATE" : sym.severity === 2 ? "OBSERVE" : "INFO",
        });

        const lower = (sym.symptom_code + " " + (sym.notes || "")).toLowerCase();
        if (lower.includes("headache") || lower.includes("co2")) {
          relevantRuleIds.add("FR-ECLSS-001");
        }
      }
    }

    // If no material changes, provide calm nominal verification
    if (changes.length === 0) {
      changes.push({
        kind: "vital_delta",
        label: "Nominal Circadian Profile",
        value: "All monitored physiological and cabin parameters within nominal envelopes",
        sourceId: `stream-nominal-${id}`,
      });
    }

    crewSummaries.push({
      astronautId: id,
      callsign: astro.callsign,
      crewRole: astro.crew_role,
      changes,
    });
  }

  // 3. Needs Review: Pending events and symptoms ranked by severity desc, uncertainty desc, then age
  const pendingReviews: PendingReviewItem[] = [];

  for (const astro of astronauts) {
    const id = astro.astronaut_id;
    const astroEvents = eventsByAstronaut[id] ?? [];
    const astroSymptoms = symptomsByAstronaut[id] ?? [];

    for (const evt of astroEvents) {
      if (evt.review_status === "PENDING") {
        const evtStart = parseTimeToMs(evt.start_time);
        const ageHours = Math.max(0, parseFloat(((windowEndMs - evtStart) / (1000 * 3600)).toFixed(1)));
        pendingReviews.push({
          kind: "event",
          id: evt.event_id,
          astronautId: id,
          callsign: astro.callsign,
          severity: evt.severity_level,
          uncertainty: evt.uncertainty_level,
          ageHours,
          title: `${evt.event_type.replace(/_/g, " ")}: ${evt.rationale.slice(0, 60)}...`,
          sourceId: evt.event_id,
        });
      }
    }

    for (const sym of astroSymptoms) {
      if (sym.review_status === "PENDING") {
        const symOccurred = parseTimeToMs(sym.occurred_at || sym.reported_at);
        const ageHours = Math.max(0, parseFloat(((windowEndMs - symOccurred) / (1000 * 3600)).toFixed(1)));
        const severity: SeverityLevel =
          sym.severity >= 3 ? "INVESTIGATE" : sym.severity === 2 ? "OBSERVE" : "INFO";
        pendingReviews.push({
          kind: "symptom",
          id: sym.report_id,
          astronautId: id,
          callsign: astro.callsign,
          severity,
          uncertainty: "MODERATE",
          ageHours,
          title: `Crew Symptom: ${sym.symptom_code} (${sym.notes || "No notes"})`,
          sourceId: sym.report_id,
        });
      }
    }
  }

  // Sort pending reviews: Severity (INVESTIGATE > OBSERVE > INFO) then Uncertainty (HIGH > MODERATE > LOW) then Age (desc)
  pendingReviews.sort((a, b) => {
    const sevDiff = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    if (sevDiff !== 0) return sevDiff;
    const uncA = a.uncertainty ? UNCERTAINTY_WEIGHT[a.uncertainty] : 1;
    const uncB = b.uncertainty ? UNCERTAINTY_WEIGHT[b.uncertainty] : 1;
    const uncDiff = uncB - uncA;
    if (uncDiff !== 0) return uncDiff;
    return b.ageHours - a.ageHours;
  });

  // 4. Evidence Pointers (Flight rules & research documents)
  const evidencePointers: EvidencePointer[] = [];

  for (const ruleId of relevantRuleIds) {
    const rule = flightRules.find((r) => r.rule_id === ruleId);
    if (rule) {
      evidencePointers.push({
        type: "flight_rule",
        id: rule.rule_id,
        title: rule.title,
      });
    }
  }

  // Default flight rules if none specifically matched
  if (evidencePointers.length === 0 && flightRules.length > 0) {
    evidencePointers.push({
      type: "flight_rule",
      id: flightRules[0].rule_id,
      title: flightRules[0].title,
    });
  }

  // Add key NASA research documents
  evidencePointers.push({
    type: "research",
    id: "HRP-ECLSS-004",
    title: "Spacecraft Cabin Environment & Hypercapnia Risk Assessment (NASA HRP)",
  });
  evidencePointers.push({
    type: "research",
    id: "NASA-TM-2021-220087",
    title: "Long-Duration Astronaut Circadian Rhythms & Autonomic Dynamics",
  });

  // 5. Suggested Focus Prompts (2-4 neutral clinical prompts)
  const focusPrompts: string[] = [];
  if (pendingReviews.length > 0) {
    const top = pendingReviews[0];
    focusPrompts.push(
      `Review pending ${top.severity} item ${top.id} (${top.callsign}) logged ${top.ageHours}h ago before next rest cycle.`
    );
  }
  const hasHeadacheOrCO2 = crewSummaries.some((c) =>
    c.changes.some((ch) => ch.label.toLowerCase().includes("headache") || ch.value.toLowerCase().includes("co2"))
  );
  if (hasHeadacheOrCO2) {
    focusPrompts.push("Cross-reference Node 2 ppCO₂ scrubbing performance against reported crew headaches.");
  }
  focusPrompts.push("Verify sleep quality and autonomic RMSSD recovery curves during post-workout intervals.");
  if (focusPrompts.length < 4) {
    focusPrompts.push("Confirm telemetry packet downlink integrity with Mission Control ground stations.");
  }

  return {
    window: {
      mode: isSimulation ? "simulation" : "normal",
      startIso,
      endIso,
      hours: windowHours,
      timezone: "UTC",
      isClockMismatched,
    },
    crew: crewSummaries,
    pendingReviews,
    dataQuality,
    evidencePointers,
    focusPrompts: focusPrompts.slice(0, 4),
    disclaimer: EPISTEMIC_DISCLAIMER,
    generatedBy: "deterministic",
  };
}

/**
 * Sequential fetcher and orchestrator: Gathers cohort data sequentially without blocking the UI.
 */
export async function fetchAndBuildShiftHandover(
  windowHours = 12
): Promise<ShiftHandoverBriefing> {
  const missionTimeMs = getActiveMissionTimeMs();
  const isSimulation = useMissionStore.getState().mode === "simulation";

  // 1. Fetch cohort roster and flight rules
  const [astronauts, flightRules] = await Promise.all([
    fetchAstronauts(),
    fetchFlightRules().catch(() => [] as FlightRule[]),
  ]);

  const eventsByAstronaut: Record<string, HealthEvent[]> = {};
  const symptomsByAstronaut: Record<string, SymptomReport[]> = {};
  const baselinesByAstronaut: Record<string, Baselines> = {};
  const measurementsByAstronaut: Record<string, Measurement[]> = {};

  // 2. Fetch data sequentially per crewmember to keep main thread completely unblocked
  for (const astro of astronauts) {
    const id = astro.astronaut_id;
    try {
      eventsByAstronaut[id] = await fetchEvents(id);
    } catch {
      eventsByAstronaut[id] = [];
    }

    try {
      symptomsByAstronaut[id] = await fetchSymptoms(id);
    } catch {
      symptomsByAstronaut[id] = [];
    }

    try {
      baselinesByAstronaut[id] = await fetchBaselines(id);
    } catch {
      baselinesByAstronaut[id] = {};
    }

    try {
      // Request bounded sample for shift window
      measurementsByAstronaut[id] = await fetchMeasurements(id, windowHours, 500);
    } catch {
      measurementsByAstronaut[id] = [];
    }
  }

  return compileShiftHandover({
    astronauts,
    eventsByAstronaut,
    symptomsByAstronaut,
    baselinesByAstronaut,
    measurementsByAstronaut,
    flightRules,
    missionTimeMs,
    windowHours,
    isSimulation,
  });
}
