/**
 * Comprehensive Unit Test Suite for Flight Surgeon Shift Handover Briefing.
 *
 * Covers:
 * 1. Empty cohort handling (graceful empty output, zero crashes).
 * 2. All-nominal window (clear indication that cohort remains within nominal baselines).
 * 3. Pending-review ranking order: Severity (INVESTIGATE > OBSERVE > INFO) then Uncertainty (HIGH > MODERATE > LOW).
 * 4. Mixed-clock warning detection under simulation mode.
 * 5. Causal-term filtering: post-generation scanning and replacement using PROHIBITED_CAUSAL_TERMS_SOURCE.
 * 6. Non-mutation invariant: ensures localStorage remains untouched and events/symptoms are never mutated.
 */

import {
  compileShiftHandover,
} from "./shiftHandoverBuilder.ts";
import { renderDeterministicBriefingProse } from "./shiftHandoverTemplate.ts";
import type { HandoverInputs } from "./types.ts";
import type {
  Astronaut,
  FlightRule,
  HealthEvent,
  Measurement,
  SymptomReport,
} from "../../types/api.ts";
import {
  containsProhibitedCausalTerms,
  PROHIBITED_CAUSAL_TERMS_SOURCE,
} from "../health-report/healthReportCompiler.ts";

let assertions = 0;

function check(condition: boolean, message: string): void {
  assertions++;
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

function equal<T>(actual: T, expected: T, message: string): void {
  assertions++;
  if (actual !== expected) {
    throw new Error(`FAIL: ${message} - expected ${String(expected)}, got ${String(actual)}`);
  }
}

const MOCK_ASTRONAUTS: Astronaut[] = [
  {
    astronaut_id: "ASTRO-01",
    callsign: "CDR M. Vance",
    mission_id: "EXP-71",
    crew_role: "Commander",
    baseline_calibrated_at: "2026-05-01T00:00:00Z",
    baseline_parameters: null,
    resting_hr: 58,
    resting_rmssd: 54,
    resting_spo2: 98.2,
    resting_temp: 36.6,
    circadian_phase_shift_hours: 0,
    baseline_window_days: 30,
    calibration_status: "CALIBRATED",
  },
  {
    astronaut_id: "ASTRO-02",
    callsign: "FE-1 Dr. S. Patel",
    mission_id: "EXP-71",
    crew_role: "Flight Engineer",
    baseline_calibrated_at: "2026-05-01T00:00:00Z",
    baseline_parameters: null,
    resting_hr: 62,
    resting_rmssd: 48,
    resting_spo2: 97.9,
    resting_temp: 36.7,
    circadian_phase_shift_hours: 0,
    baseline_window_days: 30,
    calibration_status: "CALIBRATED",
  },
];

const MOCK_FLIGHT_RULES: FlightRule[] = [
  {
    rule_id: "FR-ECLSS-001",
    title: "Cabin Carbon Dioxide Elevation & Hypercapnia Protocol",
    subsystem: "ECLSS",
    revision_date: "2026-04-10",
    severity_trigger: "INVESTIGATE",
    condition_threshold: "ppCO2 > 3.0 mmHg for > 60m",
    verbatim_text: "Verify CDRA bed operations; switch to low-activity protocol.",
    sha256_hash: "mockhash1",
    checklist_steps: [
      {
        step_number: 1,
        action: "Inspect CDRA cycling valve",
        target_subsystem: "CDRA",
        verification: null,
        caution_warning: null,
      },
    ],
    reference_docs: ["HRP-ECLSS-004"],
  },
];

// Test 1: Empty cohort handling
function testEmptyCohort(): void {
  const briefing = compileShiftHandover({
    astronauts: [],
    eventsByAstronaut: {},
    symptomsByAstronaut: {},
    baselinesByAstronaut: {},
    measurementsByAstronaut: {},
    flightRules: MOCK_FLIGHT_RULES,
    missionTimeMs: Date.now(),
    windowHours: 12,
    isSimulation: false,
  });

  equal(briefing.crew.length, 0, "Empty cohort produces empty crew array");
  equal(briefing.pendingReviews.length, 0, "Empty cohort has zero pending reviews");
  check(briefing.disclaimer.length > 0, "Mandatory disclaimer present even on empty cohort");

  const prose = renderDeterministicBriefingProse(briefing);
  check(prose.includes("No registered crewmembers"), "Prose notes absence of crew gracefully");
}

// Test 2: All-nominal window
function testAllNominalWindow(): void {
  const nowMs = 1731600000000;
  const briefing = compileShiftHandover({
    astronauts: MOCK_ASTRONAUTS,
    eventsByAstronaut: { "ASTRO-01": [], "ASTRO-02": [] },
    symptomsByAstronaut: { "ASTRO-01": [], "ASTRO-02": [] },
    baselinesByAstronaut: {},
    measurementsByAstronaut: {
      "ASTRO-01": [
        {
          id: 1,
          stream_id: "stream_eda_co2",
          astronaut_id: "ASTRO-01",
          timestamp: new Date(nowMs - 2 * 3600 * 1000).toISOString(),
          value: 400,
          quality_status: "VALID",
          is_synthetic: false,
          provenance_category: "AUTHENTIC_NASA_EDA",
        },
      ],
      "ASTRO-02": [],
    },
    flightRules: MOCK_FLIGHT_RULES,
    missionTimeMs: nowMs,
    windowHours: 12,
    isSimulation: false,
  });

  equal(briefing.crew.length, 2, "Both astronauts are summarized");
  equal(briefing.pendingReviews.length, 0, "Zero pending reviews in nominal window");
  check(
    briefing.crew[0].changes[0].label.includes("Nominal"),
    "First crewmember indicates nominal profile"
  );
  check(
    briefing.crew[0].changes[0].sourceId.startsWith("stream-nominal"),
    "Nominal change has valid sourceId"
  );

  const prose = renderDeterministicBriefingProse(briefing);
  check(prose.includes("Zero pending clinical events"), "Prose confirms zero pending items");
}

// Test 3: Pending review ranking order (Severity then Uncertainty then Age)
function testPendingReviewRanking(): void {
  const nowMs = 1731600000000;
  const mockEvents: HealthEvent[] = [
    {
      event_id: "evt-info-high-unc",
      astronaut_id: "ASTRO-01",
      event_type: "MILD_DRIFT",
      severity_level: "INFO",
      start_time: new Date(nowMs - 4 * 3600 * 1000).toISOString(),
      end_time: new Date(nowMs - 3 * 3600 * 1000).toISOString(),
      contributing_stream_ids: "stream_eda_temp",
      symptom_report_id: null,
      rationale: "Slight temperature elevation",
      peak_deviation_sigma: 1.1,
      uncertainty_level: "HIGH",
      review_status: "PENDING",
      review_notes: null,
    },
    {
      event_id: "evt-investigate-low-unc",
      astronaut_id: "ASTRO-01",
      event_type: "HYPERCAPNIA_THRESHOLD",
      severity_level: "INVESTIGATE",
      start_time: new Date(nowMs - 8 * 3600 * 1000).toISOString(),
      end_time: new Date(nowMs - 7 * 3600 * 1000).toISOString(),
      contributing_stream_ids: "stream_eda_co2",
      symptom_report_id: null,
      rationale: "Cabin ppCO2 exceeded flight rule threshold",
      peak_deviation_sigma: 2.8,
      uncertainty_level: "LOW",
      review_status: "PENDING",
      review_notes: null,
    },
    {
      event_id: "evt-observe-mod-unc",
      astronaut_id: "ASTRO-02",
      event_type: "TACHYCARDIA_SPIKE",
      severity_level: "OBSERVE",
      start_time: new Date(nowMs - 2 * 3600 * 1000).toISOString(),
      end_time: new Date(nowMs - 1 * 3600 * 1000).toISOString(),
      contributing_stream_ids: "stream_sim_hr",
      symptom_report_id: null,
      rationale: "Elevated heart rate during workout cooldown",
      peak_deviation_sigma: 2.1,
      uncertainty_level: "MODERATE",
      review_status: "PENDING",
      review_notes: null,
    },
    {
      event_id: "evt-investigate-high-unc",
      astronaut_id: "ASTRO-02",
      event_type: "RADIATION_SPIKE",
      severity_level: "INVESTIGATE",
      start_time: new Date(nowMs - 5 * 3600 * 1000).toISOString(),
      end_time: new Date(nowMs - 4 * 3600 * 1000).toISOString(),
      contributing_stream_ids: "stream_eda_radiation",
      symptom_report_id: null,
      rationale: "South Atlantic Anomaly high-dose transit",
      peak_deviation_sigma: 3.2,
      uncertainty_level: "HIGH",
      review_status: "PENDING",
      review_notes: null,
    },
  ];

  const briefing = compileShiftHandover({
    astronauts: MOCK_ASTRONAUTS,
    eventsByAstronaut: {
      "ASTRO-01": [mockEvents[0], mockEvents[1]],
      "ASTRO-02": [mockEvents[2], mockEvents[3]],
    },
    symptomsByAstronaut: {},
    baselinesByAstronaut: {},
    measurementsByAstronaut: {},
    flightRules: MOCK_FLIGHT_RULES,
    missionTimeMs: nowMs,
    windowHours: 12,
    isSimulation: false,
  });

  equal(briefing.pendingReviews.length, 4, "All 4 pending events captured");

  // Rank #1: INVESTIGATE with HIGH uncertainty (evt-investigate-high-unc)
  equal(
    briefing.pendingReviews[0].id,
    "evt-investigate-high-unc",
    "Rank 1 must be INVESTIGATE + HIGH uncertainty"
  );
  // Rank #2: INVESTIGATE with LOW uncertainty (evt-investigate-low-unc)
  equal(
    briefing.pendingReviews[1].id,
    "evt-investigate-low-unc",
    "Rank 2 must be INVESTIGATE + LOW uncertainty"
  );
  // Rank #3: OBSERVE with MODERATE uncertainty (evt-observe-mod-unc)
  equal(
    briefing.pendingReviews[2].id,
    "evt-observe-mod-unc",
    "Rank 3 must be OBSERVE"
  );
  // Rank #4: INFO with HIGH uncertainty (evt-info-high-unc)
  equal(
    briefing.pendingReviews[3].id,
    "evt-info-high-unc",
    "Rank 4 must be INFO"
  );
}

// Test 4: Mixed-clock warning under simulation mode
function testMixedClockWarning(): void {
  // Simulate Day 45 of mission (~ 135 days before Date.now())
  const simTimeMs = Date.now() - 135 * 24 * 3600 * 1000;

  // Measurements generated near real-time Date.now()
  const realTimeMeasurements: Measurement[] = [
    {
      id: 101,
      stream_id: "stream_eda_co2",
      astronaut_id: "ASTRO-01",
      timestamp: new Date().toISOString(), // near Date.now()
      value: 3200,
      quality_status: "VALID",
      is_synthetic: true,
      provenance_category: "SYNTHETIC_SIMULATION",
    },
  ];

  const briefing = compileShiftHandover({
    astronauts: MOCK_ASTRONAUTS,
    eventsByAstronaut: {},
    symptomsByAstronaut: {},
    baselinesByAstronaut: {},
    measurementsByAstronaut: { "ASTRO-01": realTimeMeasurements },
    flightRules: MOCK_FLIGHT_RULES,
    missionTimeMs: simTimeMs,
    windowHours: 12,
    isSimulation: true,
  });

  equal(briefing.window.isClockMismatched, true, "Clock mismatch detected in simulation mode");
  check(
    Boolean(briefing.dataQuality.clockWarning && briefing.dataQuality.clockWarning.includes("Simulation clock active")),
    "Clock warning string explains simulation MET epoch divergence"
  );

  const prose = renderDeterministicBriefingProse(briefing);
  check(prose.includes("Data Epoch Caveat"), "Deterministic prose includes clock warning notice");
}

// Test 5: Causal-term filtering
function testCausalTermFiltering(): void {
  // Prohibited causal phrasing
  const invalidProse = "The cabin CO2 spike caused the astronaut's headache, proving hypercapnia.";
  const cleanProse =
    "Elevated cabin CO2 co-occurred with reported headache symptoms, temporally associated with Flight Rule FR-ECLSS-001.";

  check(
    containsProhibitedCausalTerms(invalidProse),
    "Causal detector flags 'caused' and 'proving'"
  );
  check(
    !containsProhibitedCausalTerms(cleanProse),
    "Non-causal phrasing passes epistemic filter cleanly"
  );

  // Verify that all lines of renderDeterministicBriefingProse contain zero prohibited causal terms
  const briefing = compileShiftHandover({
    astronauts: MOCK_ASTRONAUTS,
    eventsByAstronaut: {},
    symptomsByAstronaut: {},
    baselinesByAstronaut: {},
    measurementsByAstronaut: {},
    flightRules: MOCK_FLIGHT_RULES,
    missionTimeMs: Date.now(),
    windowHours: 12,
    isSimulation: false,
  });

  const generatedProse = renderDeterministicBriefingProse(briefing);
  check(
    !containsProhibitedCausalTerms(generatedProse),
    "Deterministic handover template contains zero prohibited causal terms"
  );
}

// Test 6: Non-mutation verification
function testNonMutation(): void {
  // Snapshot mock localStorage keys if available
  let snapshotBefore = "";
  if (typeof window !== "undefined" && window.localStorage) {
    snapshotBefore = JSON.stringify(window.localStorage);
  }

  const sampleEvent: HealthEvent = {
    event_id: "evt-fixed-01",
    astronaut_id: "ASTRO-01",
    event_type: "CO2_ELEVATION",
    severity_level: "OBSERVE",
    start_time: new Date().toISOString(),
    end_time: new Date().toISOString(),
    contributing_stream_ids: "stream_eda_co2",
    symptom_report_id: null,
    rationale: "CO2 transient excursion",
    peak_deviation_sigma: 1.8,
    uncertainty_level: "LOW",
    review_status: "PENDING",
    review_notes: null,
  };

  const sampleSymptom: SymptomReport = {
    report_id: "sym-fixed-01",
    astronaut_id: "ASTRO-01",
    symptom_code: "HEADACHE",
    severity: 2,
    occurred_at: new Date().toISOString(),
    reported_at: new Date().toISOString(),
    cabin_module: "Node 2",
    notes: "Mild frontal pressure",
    is_synthetic: false,
    review_status: "PENDING",
  };

  compileShiftHandover({
    astronauts: MOCK_ASTRONAUTS,
    eventsByAstronaut: { "ASTRO-01": [sampleEvent] },
    symptomsByAstronaut: { "ASTRO-01": [sampleSymptom] },
    baselinesByAstronaut: {},
    measurementsByAstronaut: {},
    flightRules: MOCK_FLIGHT_RULES,
    missionTimeMs: Date.now(),
    windowHours: 12,
    isSimulation: false,
  });

  // Verify objects remain completely untouched
  equal(sampleEvent.review_status, "PENDING", "Event review_status was not mutated");
  equal(sampleSymptom.review_status, "PENDING", "Symptom review_status was not mutated");

  if (typeof window !== "undefined" && window.localStorage) {
    const snapshotAfter = JSON.stringify(window.localStorage);
    equal(snapshotBefore, snapshotAfter, "localStorage was not written to during briefing compilation");
  }
}

// Run all test suites
testEmptyCohort();
testAllNominalWindow();
testPendingReviewRanking();
testMixedClockWarning();
testCausalTermFiltering();
testNonMutation();

console.log(`PASS · ${assertions} assertions · Flight Surgeon Shift Handover Briefing`);
