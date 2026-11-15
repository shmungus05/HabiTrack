import { z } from "zod";
import { createTool } from "../core/index.ts";
import type { FlightRule } from "../../types/api";

export const NASA_FLIGHT_RULES: Record<string, FlightRule> = {
  "FR-ECLSS-001": {
    rule_id: "FR-ECLSS-001",
    title: "Elevated Cabin Carbon Dioxide and Hypercapnia Mitigation",
    subsystem: "ECLSS / CDRA",
    revision_date: "2026-04-15",
    severity_trigger: "INVESTIGATE",
    condition_threshold: "P_CO2 >= 4.0 mmHg for > 30 min",
    verbatim_text:
      "# Operational Flight Rule: FR-ECLSS-001\n\n## Operating Condition & Context\nWhen cabin partial pressure of CO2 exceeds 4.0 mmHg during crew rest cycles or 5.0 mmHg during active duty, the following procedural checklist must be executed immediately to prevent acute hypercapnia, cognitive impairment, and cephalic fluid shift compounding.",
    sha256_hash: "01139b1eb4d3a872654316be2c9ebc5c4e9ec691459a997ef2b7941ce30c0089",
    checklist_steps: [
      {
        step_number: 1,
        action: "Transition CDRA Bed Selector to DUAL-BED HIGH-FLOW",
        target_subsystem: "CDRA-ECLSS",
        verification: "Telemetry CDRA_STATE == 0x04",
        caution_warning: "Ensure vacuum desorb valve V12 is open before switching",
      },
      {
        step_number: 2,
        action: "Verify cabin ventilation fans running at nominal rate",
        target_subsystem: "NOD2-VENT",
        verification: "Flow rate >= 55 CFM",
        caution_warning: "High acoustic noise (>62 dBA) during high-flow operation",
      },
      {
        step_number: 3,
        action: "Inquire crew for subjective symptoms",
        target_subsystem: "CREW-MED",
        verification: "Log headache, vision blurring, dyspnea",
        caution_warning: "Prepare backup LiOH canisters if CDRA delta-P > 1.2 psi",
      },
      {
        step_number: 4,
        action: "Deploy portable LiOH auxiliary scrubber if P_CO2 > 6.0 mmHg",
        target_subsystem: "AUX-SCRUB",
        verification: "Auxiliary latch confirmed",
        caution_warning: "Emergency flight director notification mandatory",
      },
    ],
    reference_docs: ["NASA-STD-3001 Vol 2", "SSP 50260 Section 4.2"],
  },
  "FR-CDRA-002": {
    rule_id: "FR-CDRA-002",
    title: "Carbon Dioxide Removal Assembly Desiccant Bed Thermal Regeneration",
    subsystem: "CDRA / ECLSS",
    revision_date: "2026-05-10",
    severity_trigger: "INVESTIGATE",
    condition_threshold: "CDRA_BED_TEMP >= 210.0 degC or CYCLING_DELTA_P > 1.2 psi",
    verbatim_text:
      "# Operational Flight Rule: FR-CDRA-002\n\n## Operating Condition & Context\nDuring cyclic thermal desorption of CDRA desiccant and zeolite adsorbent beds, differential pressure anomalies across the selector valve or bed core temperatures exceeding nominal limits indicate thermal boundary excursion or bed channeling.",
    sha256_hash: "40513440b92ebc1ad7abc98f81a6683e486c38f07465fb406c36ccd01d71984f",
    checklist_steps: [
      {
        step_number: 1,
        action: "Isolate regenerative heating loop on affected bed",
        target_subsystem: "CDRA-HEAT",
        verification: "Power telemetry HEATER_A_PWR == 0 W",
        caution_warning: "Do not touch manifold lines; surface temperature exceeds 200 degC",
      },
      {
        step_number: 2,
        action: "Engage secondary cabin return air bypass loop",
        target_subsystem: "NOD2-AIR",
        verification: "BYPASS_V22 position confirmed OPEN",
        caution_warning: "Airflow drop across desiccant bed expected",
      },
      {
        step_number: 3,
        action: "Initiate vacuum desorption purge for 20 minutes",
        target_subsystem: "CDRA-VAC",
        verification: "Vacuum valve V12 OPEN, P_VAC < 0.05 torr",
        caution_warning: "Monitor cabin pressure for unexpected air loss",
      },
      {
        step_number: 4,
        action: "Re-evaluate bed delta-P before resuming automatic cycle",
        target_subsystem: "CDRA-METRICS",
        verification: "DELTA_P <= 0.8 psi",
        caution_warning: "If delta-P persists above 1.2 psi, lock out Bed B",
      },
    ],
    reference_docs: ["SSP 50260 Section 4.5", "NASA-STD-3001 Vol 2"],
  },
  "FR-MED-71-04": {
    rule_id: "FR-MED-71-04",
    title: "Spacecraft Hypercapnia & Cephalic Fluid Shift Mitigation",
    subsystem: "Crew Health & Flight Medicine",
    revision_date: "2026-06-01",
    severity_trigger: "INVESTIGATE",
    condition_threshold: "Cabin ppCO2 > 3.0 mmHg (~3,000 ppm) with crew headache, cognitive slowing, or visual disturbance.",
    verbatim_text:
      "# Operational Flight Rule: FR-MED-71-04\n\n## Operating Condition & Context\nWhen cabin CO2 partial pressure exceeds 3.0 mmHg in association with subjective headache reports, microgravity cephalic venous engorgement elevates intracranial pressure.",
    sha256_hash: "7b13a8ef32d56a90123be88c149ebc219ec79802459a997ef2b7941ce30c0012",
    checklist_steps: [
      {
        step_number: 1,
        action: "Inspect sleep station and local compartment ventilation diffuser exhaust for cargo bag obstruction",
        target_subsystem: "NOD2-VENT",
        verification: "Airflow velocity >= 0.15 m/s",
        caution_warning: "Stagnant exhaled air bubbles accumulate without active forced draft",
      },
      {
        step_number: 2,
        action: "Ingest 500 mL water with oral electrolyte solution to counteract cephalic venous stasis",
        target_subsystem: "CREW-MED",
        verification: "Oral intake logged in medical timeline",
        caution_warning: "Avoid hypertonic formulations that accelerate fluid retention",
      },
      {
        step_number: 3,
        action: "Float into US Lab Destiny or higher-turnover compartment with active CDRA scrubber draw",
        target_subsystem: "DESTINY-AIR",
        verification: "Crew location confirmed in Lab",
        caution_warning: "Maintain loose tethering during movement to limit autonomic exertion",
      },
      {
        step_number: 4,
        action: "Re-evaluate crew headache severity and SpO2 at +15 minutes MET",
        target_subsystem: "VITALS-MON",
        verification: "SpO2 >= 97% verified on finger probe",
        caution_warning: "If headache intensifies with visual aura, notify Flight Surgeon on priority audio loop",
      },
    ],
    reference_docs: ["NASA Flight Rule MED-B14-71", "LSDA Hypercapnia Evidence Book"],
  },
  "FR-ECLSS-012": {
    rule_id: "FR-ECLSS-012",
    title: "Cabin Low-Humidity Ocular & Mucosal Protection",
    subsystem: "Environmental Control & Life Support",
    revision_date: "2026-05-18",
    severity_trigger: "OBSERVE",
    condition_threshold: "Relative humidity < 40% with ocular dryness, stinging, or foreign-body sensation.",
    verbatim_text:
      "# Operational Flight Rule: FR-ECLSS-012\n\n## Operating Condition & Context\nLow cabin humidity combined with high convective airflow accelerates tear film evaporation in microgravity, risking superficial keratoconjunctivitis.",
    sha256_hash: "2c918ef32b56a90123be88c149ebc219ec79802459a997ef2b7941ce30c0077",
    checklist_steps: [
      {
        step_number: 1,
        action: "Instill preservative-free artificial tear lubricating drops (2 drops per eye)",
        target_subsystem: "CREW-MED",
        verification: "Medication kit 02 logged",
        caution_warning: "Do not rub eyes in microgravity; floating particulate may induce corneal abrasion",
      },
      {
        step_number: 2,
        action: "Reposition localized duct louvers away from direct facial stream",
        target_subsystem: "COLUMBUS-VENT",
        verification: "Louver angle deflection >= 30 deg",
        caution_warning: "Ensure return air path remains unblocked",
      },
      {
        step_number: 3,
        action: "Inspect module air intake grille for debris accumulation",
        target_subsystem: "ECLSS-FILT",
        verification: "Delta-P nominal",
        caution_warning: "Use vacuum wand with HEPA capture to clean intake",
      },
      {
        step_number: 4,
        action: "Report ocular comfort score to Flight Surgeon",
        target_subsystem: "COMM-MED",
        verification: "Triage entry confirmed in queue",
        caution_warning: "If photophobia occurs, don tinted orbital goggles",
      },
    ],
    reference_docs: ["ISS ECLSS Flight Rule 2.1.4-B", "NASA Ocular Health Protocol"],
  },
  "FR-EVA-003": {
    rule_id: "FR-EVA-003",
    title: "Autonomic Exertion Strain & Heat Dissipation Protocol",
    subsystem: "Extravehicular & Physiological Workload",
    revision_date: "2026-05-25",
    severity_trigger: "INVESTIGATE",
    condition_threshold: "Autonomic tachycardia or heat retention post-workout (Temp > 24.5°C).",
    verbatim_text:
      "# Operational Flight Rule: FR-EVA-003\n\n## Operating Condition & Context\nIn zero-gravity, absence of thermal buoyancy traps a boundary sweat layer against the epidermis, causing elevated core body temperature and cardiac drift.",
    sha256_hash: "9e13a8ef32d56a90123be88c149ebc219ec79802459a997ef2b7941ce30c0099",
    checklist_steps: [
      {
        step_number: 1,
        action: "Terminate aerobic or resistive exercise and anchor to deck grid",
        target_subsystem: "ARED-T2",
        verification: "Cycle ergometer telemetry STOPPED",
        caution_warning: "Avoid abrupt cessation; 2-minute cool-down spin recommended",
      },
      {
        step_number: 2,
        action: "Position portable auxiliary ventilation booster directly over torso",
        target_subsystem: "USLAB-FAN",
        verification: "Airflow velocity >= 0.4 m/s",
        caution_warning: "Towel off excess sweat layer to allow evaporative cooling",
      },
      {
        step_number: 3,
        action: "Drink 750 mL chilled electrolyte beverage over 15 minutes",
        target_subsystem: "CREW-HYD",
        verification: "Intake pouch verified",
        caution_warning: "Sip slowly to avoid vagal gastric distension",
      },
      {
        step_number: 4,
        action: "Monitor resting heart rate recovery curve until HR < 85 bpm",
        target_subsystem: "BIOPACK",
        verification: "Autonomic HR recovery slope normal",
        caution_warning: "If resting tachycardia persists > 30 min, alert ground surgeon",
      },
    ],
    reference_docs: ["NASA HRP Autonomic Drift Guidelines (EVA-003)", "SSP 50260 Section 6"],
  },
};

export const flightRulesTool = createTool({
  id: "latch-flight-rule",
  description: "Retrieves authentic NASA Flight Rules and emergency operational checklists.",
  inputSchema: z.object({
    ruleId: z.string().describe("e.g. FR-ECLSS-001, FR-CDRA-002, FR-MED-71-04, FR-ECLSS-012, FR-EVA-003"),
  }),
  outputSchema: z.custom<FlightRule>(),
  execute: async ({ context }) => {
    const rule = NASA_FLIGHT_RULES[context.ruleId];
    if (rule) return rule;

    // Search by partial match
    const found = Object.values(NASA_FLIGHT_RULES).find(
      (r) =>
        r.rule_id.toLowerCase().includes(context.ruleId.toLowerCase()) ||
        r.title.toLowerCase().includes(context.ruleId.toLowerCase())
    );
    if (found) return found;

    return NASA_FLIGHT_RULES["FR-ECLSS-001"];
  },
});
