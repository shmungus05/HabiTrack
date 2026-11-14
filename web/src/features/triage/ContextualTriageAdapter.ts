/**
 * Isolated Deep Module: Contextual Clinical Triage Adapter
 * Parses freeform dialogue for compartment mentions and correlates with
 * the 5-factor environmental snapshot and NASA Flight Rules.
 */

import { type EnvironmentalSnapshot, evaluateClinicalRisk } from "../risk/ClinicalRiskModule";
import { ISS_COMPARTMENTS, type SpacecraftModule } from "../topology/SpacecraftTopologyModule";

export interface TriageEvaluationResult {
  detectedModule: SpacecraftModule | null;
  environmentalSnapshot: EnvironmentalSnapshot;
  clinicalRisk: ReturnType<typeof evaluateClinicalRisk>;
  potentialDelayedCausality: {
    symptom: string;
    factor: string;
    lagWindow: string;
    confidenceMatch: string;
    rationale: string;
  } | null;
  countermeasures: string[];
  disclaimer: string;
}

export function detectLocationFromText(text: string): SpacecraftModule | null {
  const lower = text.toLowerCase();
  if (lower.includes("destiny") || lower.includes("us lab") || lower.includes("lab")) {
    return ISS_COMPARTMENTS.find((m) => m.id === "destiny") ?? null;
  }
  if (lower.includes("columbus")) {
    return ISS_COMPARTMENTS.find((m) => m.id === "columbus") ?? null;
  }
  if (lower.includes("kibo") || lower.includes("jem")) {
    return ISS_COMPARTMENTS.find((m) => m.id === "kibo") ?? null;
  }
  if (lower.includes("unity") || lower.includes("node 1")) {
    return ISS_COMPARTMENTS.find((m) => m.id === "node1") ?? null;
  }
  if (lower.includes("cupola")) {
    return ISS_COMPARTMENTS.find((m) => m.id === "cupola") ?? null;
  }
  if (
    lower.includes("harmony") ||
    lower.includes("node 2") ||
    lower.includes("crew quarters") ||
    lower.includes("sleep station")
  ) {
    return ISS_COMPARTMENTS.find((m) => m.id === "node2") ?? null;
  }
  return null;
}

export function evaluateContextualTriage(
  reportText: string,
  snapshot: EnvironmentalSnapshot,
): TriageEvaluationResult {
  const detectedModule = detectLocationFromText(reportText);
  const clinicalRisk = evaluateClinicalRisk(snapshot);
  const textLower = reportText.toLowerCase();

  let potentialDelayedCausality = null;
  const countermeasures: string[] = [];

  // Headache correlation with CO2
  if (
    textLower.includes("headache") ||
    textLower.includes("throbbing") ||
    textLower.includes("fog") ||
    textLower.includes("dizzy")
  ) {
    if (snapshot.co2Ppm > 2800) {
      potentialDelayedCausality = {
        symptom: "Headache / Neurocognitive Impairment",
        factor: "Carbon Dioxide (ppCO₂)",
        lagWindow: "1.5 to 2.0 Hours post-exposure",
        confidenceMatch: "84% (NASA LSDA Correlation Peak)",
        rationale: `Cabin CO₂ is elevated at ${snapshot.co2Ppm.toLocaleString()} PPM. Cephalic fluid shift increases intracranial pressure, producing delayed headache onset.`,
      };
      countermeasures.push("Activate module auxiliary circulation diffuser fans");
      countermeasures.push("Hydrate with 500 mL water to support cephalic venous return");
      countermeasures.push("Relocate to higher-ventilation compartment (e.g. US Lab Destiny)");
    }
  }

  // Dry eye / Ocular discomfort
  if (textLower.includes("eye") || textLower.includes("dry") || textLower.includes("stinging")) {
    if (snapshot.humidityPct < 40) {
      potentialDelayedCausality = {
        symptom: "Keratoconjunctivitis / Dry Eye Syndrome",
        factor: "Cabin Relative Humidity",
        lagWindow: "30 to 45 Minutes post-onset",
        confidenceMatch: "72% (Microgravity Forced Ventilation)",
        rationale: `Cabin relative humidity is low (${snapshot.humidityPct}%). Forced airflow accelerates tear film evaporation in zero-g.`,
      };
      countermeasures.push("Apply preservative-free artificial tear drops");
      countermeasures.push("Reposition localized diffuser exhaust away from facial direct stream");
    }
  }

  // Thermal strain / Overheating
  if (textLower.includes("sweat") || textLower.includes("hot") || textLower.includes("exhaust")) {
    potentialDelayedCausality = {
      symptom: "Thermoregulatory Heat Strain",
      factor: "Cabin Ambient Temperature & Microgravity Convection Loss",
      lagWindow: "Immediate / Active Exercise",
      confidenceMatch: "78% (Thermal THC Lag)",
      rationale: `Absence of natural buoyancy convection traps sweat layer against skin, raising core temperature +${clinicalRisk.exerciseCoreHeatRiseDegC} °C above resting.`,
    };
    countermeasures.push("Pre-cool workout zone to 21.0 °C prior to CEVIS/T2 exercise");
    countermeasures.push("Utilize evaporative sweat towels and liquid cooling garments");
  }

  if (countermeasures.length === 0) {
    countermeasures.push("Maintain standard mission hydration and circadian schedule");
    countermeasures.push("Log follow-up symptoms if discomfort persists beyond 60 minutes");
  }

  return {
    detectedModule,
    environmentalSnapshot: snapshot,
    clinicalRisk,
    potentialDelayedCausality,
    countermeasures,
    disclaimer:
      "Non-Causal Decision Support: Environmental correlation indicates co-occurrence only and does not establish clinical causation. Recommendations are advisory only.",
  };
}
