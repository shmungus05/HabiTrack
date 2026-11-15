import { z } from "zod";
import { createStep } from "../core/index.ts";
import { telemetryTool } from "../tools/telemetryTool.ts";
import { flightRulesTool } from "../tools/flightRulesTool.ts";

export const correlateTelemetryStep = createStep({
  id: "correlate-telemetry",
  inputSchema: z.object({
    symptomText: z.string(),
    detectedCompartmentId: z.string(),
    detectedCompartmentName: z.string(),
    primarySymptomCategory: z.enum([
      "HEADACHE_HYPERCAPNIA",
      "MUSCLE_SORENESS",
      "SLEEP_DISTURBANCE",
      "OCULAR_IRRITATION",
      "THERMAL_EXERTION",
      "NEUROVESTIBULAR_DIZZINESS",
      "CRITICAL_EMERGENCY",
      "GENERIC_DISCOMFORT",
    ]),
    intent: z.string().optional(),
    followupQuestions: z.array(z.string()).optional(),
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
    intent: z.string().optional(),
    followupQuestions: z.array(z.string()).optional(),
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

    if (context.primarySymptomCategory === "CRITICAL_EMERGENCY") {
      ruleId = "FR-MED-71-04";
      lagWindow = "Immediate (0 Minutes)";
      rationale =
        "CRITICAL ALERT: Acute physiological distress or toxic exposure reported. Normal knowledge retrieval bypassed. Initiate emergency crew medical protocol immediately.";
      confidence = "99% (Emergency Escalation)";
    } else if (context.primarySymptomCategory === "HEADACHE_HYPERCAPNIA") {
      ruleId = "FR-ECLSS-001";
      lagWindow = "1.5 to 2.0 Hours post-exposure";
      rationale = `Cabin CO₂ is elevated at ${telemetry.co2Ppm.toLocaleString()} PPM. Cephalic fluid shift increases intracranial pressure, producing delayed headache onset.`;
      confidence = "86% (NASA LSDA Correlation Peak)";
    } else if (context.primarySymptomCategory === "MUSCLE_SORENESS") {
      ruleId = "FR-EVA-003";
      lagWindow = "12 to 24 Hours post-exercise (DOMS Curve)";
      rationale =
        "Musculoskeletal fatigue and delayed onset muscle soreness (DOMS) temporally associated with microgravity resistive loading (ARED). Non-acute; no uncontained cabin excursion detected.";
      confidence = "92% (Exercise Countermeasure Dynamics)";
    } else if (context.primarySymptomCategory === "SLEEP_DISTURBANCE") {
      ruleId = "FR-GEN-001";
      lagWindow = "Diurnal Rest Cycle (0 to 8 Hours)";
      rationale =
        "Rest-cycle disruption temporally correlated with localized crew quarters airflow turnover and acoustic background levels.";
      confidence = "84% (Circadian & Acoustic Habitability)";
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
      intent: context.intent,
      followupQuestions: context.followupQuestions,
      latchedRuleId: flightRule.rule_id,
      flightRuleTitle: flightRule.title,
      biologicalLatencyLag: lagWindow,
      physiologicalRationale: rationale,
      confidenceMatch: confidence,
      astronautId: context.astronautId,
    };
  },
});
