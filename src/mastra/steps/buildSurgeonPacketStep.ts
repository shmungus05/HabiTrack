import { z } from "zod";
import { createStep } from "../core/index.ts";

export const buildSurgeonPacketStep = createStep({
  id: "build-surgeon-packet",
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
    intent: z.string().optional(),
    followupQuestions: z.array(z.string()).optional(),
    resources: z.array(z.any()).optional(),
    latchedRuleId: z.string(),
    flightRuleTitle: z.string(),
    biologicalLatencyLag: z.string(),
    physiologicalRationale: z.string(),
    confidenceMatch: z.string(),
    astronautId: z.string(),
    disclaimer: z.string(),
    tripwireTriggered: z.boolean(),
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
    intent: z.string().optional(),
    followupQuestions: z.array(z.string()).optional(),
    resources: z.array(z.any()).optional(),
    latchedRuleId: z.string(),
    flightRuleTitle: z.string(),
    biologicalLatencyLag: z.string(),
    physiologicalRationale: z.string(),
    confidenceMatch: z.string(),
    astronautId: z.string(),
    disclaimer: z.string(),
    tripwireTriggered: z.boolean(),
    surgeonHandoffPacket: z.object({
      packetId: z.string(),
      createdAtIso: z.string(),
      astronautId: z.string(),
      symptomReported: z.string(),
      compartmentName: z.string(),
      environmentalSnapshot: z.object({
        co2Ppm: z.number(),
        tempC: z.number(),
        humidityPct: z.number(),
        radiationRateMGy: z.number(),
        pressureMmHg: z.number(),
      }),
      latchedRuleId: z.string(),
      interimActionsCount: z.number(),
    }),
  }),
  execute: async ({ context }) => {
    const packetId = `PKT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    const nowIso = new Date().toISOString();

    const surgeonHandoffPacket = {
      packetId,
      createdAtIso: nowIso,
      astronautId: context.astronautId,
      symptomReported: context.symptomText,
      compartmentName: context.compartmentName,
      environmentalSnapshot: {
        co2Ppm: context.telemetryReadings.co2Ppm,
        tempC: context.telemetryReadings.tempC,
        humidityPct: context.telemetryReadings.humidityPct,
        radiationRateMGy: context.telemetryReadings.radiationRateMGy,
        pressureMmHg: context.telemetryReadings.pressureMmHg,
      },
      latchedRuleId: context.latchedRuleId,
      interimActionsCount: context.interimActions.length,
    };

    return {
      ...context,
      surgeonHandoffPacket,
    };
  },
});
