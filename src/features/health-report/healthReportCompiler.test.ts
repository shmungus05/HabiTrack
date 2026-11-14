/**
 * Zero-dependency health report compiler harness.
 *
 * Run with Node 24 (native TypeScript type stripping):
 *   node src/features/health-report/healthReportCompiler.test.ts
 *
 * No test framework is imported, so `package.json` stays free of extra npm
 * test dependencies. Any failed assertion throws and exits non-zero.
 */

import { compileHealthReport } from "./healthReportCompiler.ts";
import {
  buildHealthReportPdfModel,
  healthReportPdfFilename,
} from "./healthReportPdf.ts";
import { generateHealthReportHtml } from "./healthReportTemplates.ts";
import type { HealthReportInput } from "./types.ts";
import type {
  Astronaut,
  Baselines,
  CircadianBinStats,
  FlightRule,
  HealthEvent,
  Measurement,
  SymptomReport,
} from "../../types/api.ts";

// ---------------------------------------------------------------------------
// Micro-assertions
// ---------------------------------------------------------------------------

let assertions = 0;

function check(condition: boolean, message: string): void {
  assertions += 1;
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function equal<T>(actual: T, expected: T, message: string): void {
  check(
    actual === expected,
    `${message} (expected ${String(expected)}, received ${String(actual)})`,
  );
}

function close(actual: number, expected: number, message: string, epsilon = 1e-6): void {
  check(
    Math.abs(actual - expected) <= epsilon,
    `${message} (expected ${expected} ± ${epsilon}, received ${actual})`,
  );
}

// ---------------------------------------------------------------------------
// Day 127 fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-05-01T02:15:00.000Z");

const ASTRONAUT: Astronaut = {
  astronaut_id: "ASTRO-01",
  callsign: "CDR M. Vance",
  mission_id: "EXP-71",
  crew_role: "Commander",
  baseline_calibrated_at: "2026-04-20T00:00:00.000Z",
  baseline_parameters: null,
  resting_hr: 60,
  resting_rmssd: 75,
  resting_spo2: 98,
  resting_temp: 36.8,
  circadian_phase_shift_hours: -0.5,
  baseline_window_days: 14,
  calibration_status: "CALIBRATED",
};

function hourlyBins(mean: number, std: number): CircadianBinStats[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour_bin: hour,
    timestamp: `2026-04-20T${String(hour).padStart(2, "0")}:00:00.000Z`,
    mean,
    std,
    upper: mean + 2 * std,
    lower: mean - 2 * std,
    sample_count: 10,
    distinct_days: 14,
    calibration_status: "CALIBRATED",
  }));
}

const BASELINES: Baselines = {
  stream_sim_hr: hourlyBins(60, 10),
  stream_sim_hrv: hourlyBins(75, 10),
  stream_sim_spo2: hourlyBins(98, 1),
  stream_sim_temp: hourlyBins(36.8, 0.2),
};

function measurement(
  streamId: string,
  value: number,
  timestamp: string,
  quality: Measurement["quality_status"] = "VALID",
): Measurement {
  return {
    id: null,
    stream_id: streamId,
    astronaut_id: "ASTRO-01",
    timestamp,
    value,
    quality_status: quality,
    is_synthetic: !streamId.startsWith("stream_eda"),
    provenance_category: streamId.startsWith("stream_eda")
      ? "AUTHENTIC_NASA_EDA"
      : "SYNTHETIC_SIMULATION",
  };
}

const MEASUREMENTS: Measurement[] = [
  measurement("stream_sim_hr", 74, "2026-05-01T01:00:00.000Z"),
  measurement("stream_sim_hr", 92, "2026-05-01T02:10:00.000Z"),
  measurement("stream_sim_hrv", 70, "2026-05-01T02:10:00.000Z"),
  measurement("stream_sim_spo2", 97, "2026-05-01T02:10:00.000Z"),
  measurement("stream_sim_temp", 37.4, "2026-05-01T02:10:00.000Z"),
  measurement("stream_eda_co2", 3850, "2026-05-01T02:05:00.000Z"),
];

const SYMPTOMS: SymptomReport[] = [
  {
    report_id: "SYM-001",
    astronaut_id: "ASTRO-01",
    symptom_code: "HEADACHE",
    severity: 4,
    occurred_at: "2026-05-01T02:20:00.000Z",
    reported_at: "2026-05-01T02:25:00.000Z",
    cabin_module: "Node 2 (Harmony)",
    notes: "Cabin CO2 caused my frontal headache.",
    is_synthetic: false,
  },
  {
    report_id: "SYM-002",
    astronaut_id: "ASTRO-01",
    symptom_code: "FATIGUE",
    severity: 2,
    occurred_at: "2026-04-30T18:00:00.000Z",
    reported_at: "2026-04-30T18:05:00.000Z",
    cabin_module: "US Lab (Destiny)",
    notes: "Mild lethargy after exercise.",
    is_synthetic: false,
  },
];

const EVENTS: HealthEvent[] = [
  {
    event_id: "EVT-001",
    astronaut_id: "ASTRO-01",
    event_type: "HYPERCAPNIA",
    severity_level: "INVESTIGATE",
    start_time: "2026-05-01T02:00:00.000Z",
    end_time: "2026-05-01T02:30:00.000Z",
    contributing_stream_ids: "stream_eda_co2,stream_sim_hr,stream_sim_hrv",
    symptom_report_id: "SYM-001",
    rationale: "Temporal co-occurrence of cabin CO2 excursion and autonomic shift.",
    peak_deviation_sigma: 3.2,
    uncertainty_level: "MODERATE",
    review_status: "PENDING",
    review_notes: null,
  },
];

const FLIGHT_RULES: FlightRule[] = [
  {
    rule_id: "FR-ECLSS-001",
    title: "Elevated Cabin Carbon Dioxide",
    subsystem: "ECLSS",
    revision_date: "2026-01-15",
    severity_trigger: "INVESTIGATE",
    condition_threshold: "P_CO2 >= 3.5 mmHg",
    verbatim_text: "Crew shall relocate to a ventilated module.",
    sha256_hash: "abc123def456",
    checklist_steps: [
      {
        step_number: 2,
        action: "Increase IMV ventilation rate.",
        target_subsystem: "ECLSS",
        verification: "Verify CDRA cycling.",
        caution_warning: null,
      },
      {
        step_number: 1,
        action: "Confirm P_CO2 with MCA.",
        target_subsystem: "ECLSS",
        verification: null,
        caution_warning: "Do not recalibrate during the excursion.",
      },
    ],
    reference_docs: ["ECLSS-001"],
  },
];

const INPUT: HealthReportInput = {
  astronaut: ASTRONAUT,
  baselines: BASELINES,
  measurements: MEASUREMENTS,
  symptoms: SYMPTOMS,
  events: EVENTS,
  activeFlightRules: FLIGHT_RULES,
  timeWindow: {
    start: "2026-04-17T00:00:00.000Z",
    end: "2026-05-01T02:30:00.000Z",
    missionDayRange: "Day 120–134",
  },
  now: NOW,
};

// ---------------------------------------------------------------------------
// 1. Baseline deviation math
// ---------------------------------------------------------------------------

const report = compileHealthReport(INPUT);
const hr = report.vitalsSummary.find((row) => row.parameter === "Resting Heart Rate");
check(Boolean(hr), "heart-rate row exists");
close(hr!.deviationSigma, 3.2, "HR deviation sigma = (92 - 60) / 10");
equal(hr!.status, "ANOMALOUS", "3.2σ is classified ANOMALOUS");
equal(hr!.value, "92", "latest HR measurement is projected");
equal(hr!.unit, "bpm", "HR keeps its physical unit");
equal(hr!.qualityStatus, "VALID", "latest HR quality status is preserved");
check(
  hr!.baselineRange.includes("60 ± 20"),
  `baseline range reports μ ± 2σ (received ${hr!.baselineRange})`,
);

const temp = report.vitalsSummary.find((row) => row.parameter === "Core Temperature");
close(temp!.deviationSigma, 3, "core temp deviation sigma = (37.4 - 36.8) / 0.2");
equal(temp!.status, "ANOMALOUS", "3.0σ is classified ANOMALOUS");

const rmssd = report.vitalsSummary.find((row) => row.parameter === "HRV · RMSSD");
close(rmssd!.deviationSigma, -0.5, "RMSSD deviation sigma");
equal(rmssd!.status, "NOMINAL", "suppressed RMSSD inside 2σ remains NOMINAL");

// ---------------------------------------------------------------------------
// 2. Environmental mapping and units
// ---------------------------------------------------------------------------

const co2 = report.environmentalSnapshot.find((row) =>
  row.parameter.includes("Carbon Dioxide"),
);
check(Boolean(co2), "CO2 environmental row exists");
equal(co2!.value, "3850", "CO2 value is projected from telemetry");
equal(co2!.unit, "PPM", "CO2 is reported in PPM");
equal(co2!.status, "CAUTION", "3,850 PPM crosses the 3,500 PPM caution threshold");
equal(co2!.qualityStatus, "VALID", "authentic EDA quality is preserved");

const radiation = report.environmentalSnapshot.find((row) =>
  row.parameter.includes("Radiation"),
);
equal(radiation!.unit, "mGy/d", "radiation is reported in mGy/d");
equal(
  radiation!.qualityStatus,
  "IMPUTED",
  "missing radiation stream is explicitly imputed, never silently invented",
);

// ---------------------------------------------------------------------------
// 3. Epistemic guardrail: flag, never throw
// ---------------------------------------------------------------------------

let threw = false;
try {
  compileHealthReport(INPUT);
} catch {
  threw = true;
}
check(!threw, "causal symptom text never aborts compilation");

const flagged = report.symptomHistory.find((row) => row.symptom === "Headache");
equal(flagged!.nonCausalFlag, true, "causal note is flagged non-causal");
check(
  (flagged!.notes ?? "").includes("[Note: Non-causal observation - unverified correlation]"),
  "flagged row carries the inline non-causal notice",
);

const clean = report.symptomHistory.find((row) => row.symptom === "Fatigue");
equal(clean!.nonCausalFlag, false, "neutral note is not flagged");

// ---------------------------------------------------------------------------
// 4. Rules, references, disclaimer
// ---------------------------------------------------------------------------

equal(report.verifiedFlightRules.length, 1, "attached flight rule is projected");
equal(
  report.verifiedFlightRules[0].checklistSteps[0].stepNumber,
  1,
  "checklist steps are ordered by step number",
);
equal(
  report.verifiedFlightRules[0].checklistSteps[0].verified,
  false,
  "checklist steps start unverified",
);
check(report.sourceReferences.length >= 3, "source references are attached");
check(
  report.sourceReferences.some((ref) => ref.provenance === "AUTHENTIC_NASA_EDA"),
  "authentic NASA provenance is present",
);
check(
  report.epistemicDisclaimer.startsWith("Non-Causal Decision Support Disclaimer"),
  "mandatory epistemic disclaimer is present",
);
equal(report.metadata.timeWindow.missionDayRange, "Day 120–134", "window is preserved");
check(report.metadata.reportId.startsWith("WF-ASTRO-01-"), "report id is scoped and stamped");

// ---------------------------------------------------------------------------
// 5. Export templates
// ---------------------------------------------------------------------------

const html = generateHealthReportHtml(report);
check(html.includes('id="health-report-document"'), "html health report root");
check(html.includes("Clinical Health Report"), "html title");
check(html.includes("Non-Causal Decision Support Disclaimer"), "html disclaimer");
check(!html.includes("<script"), "html output contains no scripts");

const pdfSections = buildHealthReportPdfModel(report);
equal(pdfSections.length, 7, "pdf model exposes seven sections");
equal(
  pdfSections[1].rows.length,
  report.vitalsSummary.length,
  "pdf vitals rows match the compiled report",
);
check(
  pdfSections.every((section) =>
    section.rows.every((row) => row.length === section.columns.length),
  ),
  "every pdf row matches its column count",
);
check(
  healthReportPdfFilename(report).startsWith("Habitat_Trace_Health_Report_"),
  "pdf filename carries the health report label",
);
check(healthReportPdfFilename(report).endsWith(".pdf"), "pdf filename uses .pdf");

console.log(`PASS · ${assertions} assertions · health report compiler and templates`);
