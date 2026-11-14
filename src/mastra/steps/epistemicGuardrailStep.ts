import { z } from "zod";
import { createStep } from "../core";

const PROHIBITED_CAUSAL_TERMS = /\b(cause|causes|caused|causing|proves|proven|diagnose|diagnosed|diagnosis|prescribe|prescribes|prescribed|prescription|treat|treated|treating|treatment|cure|remedy)\b/gi;

const MANDATORY_DISCLAIMER =
  "Non-Causal Decision Support Disclaimer: Temporal correlation indicates co-occurrence only and does not establish clinical causation. Habitat Trace is an onboard clinical decision-support triage assistant, not an autonomous diagnostic system. Operational countermeasure decisions must be verified by a flight surgeon.";

export const epistemicGuardrailStep = createStep({
  id: "epistemic-guardrail",
  inputSchema: z.object({
    headline: z.string(),
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
    interimActions: z.array(
      z.object({
        id: z.string(),
        stepNumber: z.number(),
        action: z.string(),
        rationale: z.string(),
        estimatedMinutes: z.number(),
        completed: z.boolean(),
      })
    ),
    latchedRuleId: z.string(),
    flightRuleTitle: z.string(),
    biologicalLatencyLag: z.string(),
    physiologicalRationale: z.string(),
    confidenceMatch: z.string(),
    astronautId: z.string(),
  }),
  outputSchema: z.object({
    headline: z.string(),
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
    interimActions: z.array(
      z.object({
        id: z.string(),
        stepNumber: z.number(),
        action: z.string(),
        rationale: z.string(),
        estimatedMinutes: z.number(),
        completed: z.boolean(),
      })
    ),
    latchedRuleId: z.string(),
    flightRuleTitle: z.string(),
    biologicalLatencyLag: z.string(),
    physiologicalRationale: z.string(),
    confidenceMatch: z.string(),
    astronautId: z.string(),
    disclaimer: z.string(),
    tripwireTriggered: z.boolean(),
  }),
  execute: async ({ context }) => {
    let tripwire = false;

    // Check if rationale or headline had prohibited terms
    if (PROHIBITED_CAUSAL_TERMS.test(context.physiologicalRationale)) {
      tripwire = true;
    }

    const sanitizedRationale = context.physiologicalRationale.replace(
      PROHIBITED_CAUSAL_TERMS,
      "[temporally correlated with]"
    );

    const sanitizedActions = context.interimActions.map((act) => ({
      ...act,
      rationale: act.rationale.replace(PROHIBITED_CAUSAL_TERMS, "[associated with]"),
    }));

    return {
      ...context,
      physiologicalRationale: sanitizedRationale,
      interimActions: sanitizedActions,
      disclaimer: MANDATORY_DISCLAIMER,
      tripwireTriggered: tripwire,
    };
  },
});
