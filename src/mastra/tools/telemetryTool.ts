import { z } from "zod";
import { createTool } from "../core";

export const telemetryTool = createTool({
  id: "get-compartment-telemetry",
  description: "Reads live 5-factor environmental telemetry and micro-climate conditions for an ISS module.",
  inputSchema: z.object({
    compartmentId: z.string().describe("Module identifier e.g. destiny, node2, columbus, kibo, cupola"),
    baselineSnapshot: z.object({
      co2Ppm: z.number(),
      tempC: z.number(),
      humidityPct: z.number(),
      radiationRateMGy: z.number(),
      pressureMmHg: z.number(),
    }).optional(),
  }),
  outputSchema: z.object({
    compartmentName: z.string(),
    co2Ppm: z.number(),
    tempC: z.number(),
    humidityPct: z.number(),
    radiationRateMGy: z.number(),
    pressureMmHg: z.number(),
    airflowProfile: z.string(),
  }),
  execute: async ({ context }) => {
    const cid = context.compartmentId.toLowerCase();
    const snap = context.baselineSnapshot || {
      co2Ppm: 3197,
      tempC: 22.8,
      humidityPct: 43.9,
      radiationRateMGy: 0.20,
      pressureMmHg: 758.2,
    };

    // Micro-climate adjustment based on compartment airflow characteristics
    if (cid.includes("node2") || cid.includes("crew quarters") || cid.includes("harmony")) {
      return {
        compartmentName: "Node 2 (Harmony Crew Quarters)",
        co2Ppm: Math.round(snap.co2Ppm * 1.05), // Pocketing tendency
        tempC: snap.tempC,
        humidityPct: snap.humidityPct,
        radiationRateMGy: snap.radiationRateMGy,
        pressureMmHg: snap.pressureMmHg,
        airflowProfile: "Low Convective Turnover (Diffuser Assisted)",
      };
    }

    if (cid.includes("destiny") || cid.includes("lab")) {
      return {
        compartmentName: "US Lab Destiny",
        co2Ppm: Math.round(snap.co2Ppm * 0.92), // High airflow scrub
        tempC: snap.tempC - 0.5,
        humidityPct: snap.humidityPct,
        radiationRateMGy: snap.radiationRateMGy,
        pressureMmHg: snap.pressureMmHg,
        airflowProfile: "High Circulation (Active CDRA Loop)",
      };
    }

    return {
      compartmentName: "General Station Habitat",
      co2Ppm: snap.co2Ppm,
      tempC: snap.tempC,
      humidityPct: snap.humidityPct,
      radiationRateMGy: snap.radiationRateMGy,
      pressureMmHg: snap.pressureMmHg,
      airflowProfile: "Nominal ISS Bulk Circulation",
    };
  },
});
