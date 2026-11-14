import { z } from "zod";
import { createStep } from "../core";
import { telemetryTool } from "../tools/telemetryTool";
import { flightRulesTool } from "../tools/flightRulesTool";

export const correlateTelemetryStep = createStep({
  id: "correlate-telemetry",
  inputSchema: z.object({
    symptomText: z.string(),
    detectedCompartmentId: z.string(),
    detectedCompartmentName: z.string(),
    primarySymptomCategory: z.enum([
      "HEADACHE_HYPERCAPNIA",
      "OCULAR_IRRITATION",
      "THERMAL_EXERTION",
      "NEUROVESTIBULAR_DIZZINESS",
      "GENERIC_DISCOMFORT",
    ]),
    currentSnapshot: z.object({
      co2Ppm: z.number(),
      tempC: z.number(),
      humidityPct: z.number(),
      radiationRateMGy: z.number(),
      pressureMmHg: z.number(),
    }),
    astronautId: z.string(),
  }),
  outputSchema: z.object({
    symptomText: z.string(),
    compartmentName: z.string(),
    telemetryReadings: z.object({
      co2Ppm: z.number(),
      tempC: z.number(),
      humidityPct: z.number(),
      radiationRateMGy: z.number(),
      pressureMmHg: z.number(),
      airflowProfile: z.string(),
    }),
    primarySymptomCategory: z.string(),
    latchedRuleId: z.string(),
    flightRuleTitle: z.string(),
    biologicalLatencyLag: z.string(),
    physiologicalRationale: z.string(),
    confidenceMatch: z.string(),
    astronautId: z.string(),
  }),
  execute: async ({ context }) => {
    // 1. Fetch adjusted compartment micro-climate readings via tool
    const telemetry = await telemetryTool.execute({
      context: {
        compartmentId: context.detectedCompartmentId,
        baselineSnapshot: context.currentSnapshot,
      },
    });

    let ruleId = "FR-GEN-001";
    let lagWindow = "Immediate (0 - 15 Minutes)";
    let rationale = "Biometric readings reflect transient operational fluctuation.";
    let confidence = "78% (Circadian Norm)";

    if (context.primarySymptomCategory === "HEADACHE_HYPERCAPNIA") {
      const lower = context.symptomText.toLowerCase();
      if (lower.includes("cdra") || lower.includes("mitigation") || lower.includes("4.0") || lower.includes("p_co2") || lower.includes("eclss")) {
        ruleId = "FR-ECLSS-001";
      } else {
        ruleId = "FR-MED-71-04";
      }
      lagWindow = "1.5 to 2.0 Hours post-exposure";
      rationale = `Cabin CO₂ is elevated at ${telemetry.co2Ppm.toLocaleString()} PPM. Cephalic fluid shift increases intracranial pressure, producing delayed headache onset.`;
      confidence = "86% (NASA LSDA Correlation Peak)";
    } else if (context.primarySymptomCategory === "OCULAR_IRRITATION") {
      ruleId = "FR-ECLSS-012";
      lagWindow = "30 to 45 Minutes post-onset";
      rationale = `Cabin relative humidity is low (${telemetry.humidityPct}%). Forced microgravity ventilation accelerates corneal tear film evaporation.`;
      confidence = "82% (Microgravity Forced Airflow)";
    } else if (context.primarySymptomCategory === "THERMAL_EXERTION") {
      ruleId = "FR-EVA-003";
      lagWindow = "15 to 30 Minutes post-exercise";
      rationale = `Cabin temperature is ${telemetry.tempC}°C. Lack of natural convective sweat evaporation delays core temperature dissipation.`;
      confidence = "88% (Autonomic Thermal Stasis)";
    } else if (context.primarySymptomCategory === "NEUROVESTIBULAR_DIZZINESS") {
      ruleId = "FR-MED-71-04";
      lagWindow = "Immediate post-movement";
      rationale = "Transient otolith-visual sensory conflict compounded by altered cerebral vascular resistance.";
      confidence = "75% (Space Adaptation Syndrome)";
    }

    const flightRule = await flightRulesTool.execute({ context: { ruleId } });

    return {
      symptomText: context.symptomText,
      compartmentName: telemetry.compartmentName,
      telemetryReadings: telemetry,
      primarySymptomCategory: context.primarySymptomCategory,
      latchedRuleId: flightRule.rule_id,
      flightRuleTitle: flightRule.title,
      biologicalLatencyLag: lagWindow,
      physiologicalRationale: rationale,
      confidenceMatch: confidence,
      astronautId: context.astronautId,
    };
  },
});
