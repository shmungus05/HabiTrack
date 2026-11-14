import { z } from "zod";
import { createStep } from "../core";

export const parseSymptomStep = createStep({
  id: "parse-symptom",
  inputSchema: z.object({
    symptomText: z.string(),
    compartmentOverride: z.string().optional(),
    currentSnapshot: z.object({
      co2Ppm: z.number(),
      tempC: z.number(),
      humidityPct: z.number(),
      radiationRateMGy: z.number(),
      pressureMmHg: z.number(),
    }),
    astronautId: z.string().optional(),
  }),
  outputSchema: z.object({
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
  execute: async ({ context }) => {
    const textLower = context.symptomText.toLowerCase();

    // 1. Detect compartment location
    let compartmentId = "general";
    let compartmentName = "General Station Bay";

    if (context.compartmentOverride && context.compartmentOverride !== "Auto-Detect") {
      compartmentId = context.compartmentOverride.toLowerCase();
      compartmentName = context.compartmentOverride;
    } else if (textLower.includes("node 2") || textLower.includes("harmony") || textLower.includes("quarters") || textLower.includes("sleep")) {
      compartmentId = "node2";
      compartmentName = "Node 2 (Harmony Crew Quarters)";
    } else if (textLower.includes("destiny") || textLower.includes("us lab") || textLower.includes("lab")) {
      compartmentId = "destiny";
      compartmentName = "US Lab Destiny";
    } else if (textLower.includes("columbus")) {
      compartmentId = "columbus";
      compartmentName = "Columbus European Module";
    } else if (textLower.includes("kibo") || textLower.includes("jem")) {
      compartmentId = "kibo";
      compartmentName = "Kibo JEM Module";
    } else if (textLower.includes("cupola")) {
      compartmentId = "cupola";
      compartmentName = "Cupola Observation Module";
    }

    // 2. Identify primary symptom category
    let category:
      | "HEADACHE_HYPERCAPNIA"
      | "OCULAR_IRRITATION"
      | "THERMAL_EXERTION"
      | "NEUROVESTIBULAR_DIZZINESS"
      | "GENERIC_DISCOMFORT" = "GENERIC_DISCOMFORT";

    const hasNegation =
      textLower.includes("no headache") ||
      textLower.includes("not having") ||
      textLower.includes("without") ||
      textLower.includes("no symptom") ||
      textLower.includes("feeling good") ||
      textLower.includes("feeling fine");

    if (!hasNegation) {
      if (textLower.includes("headache") || textLower.includes("throbbing") || textLower.includes("fog") || textLower.includes("pco2")) {
        category = "HEADACHE_HYPERCAPNIA";
      } else if (textLower.includes("eye") || textLower.includes("dry") || textLower.includes("stinging") || textLower.includes("irritat")) {
        category = "OCULAR_IRRITATION";
      } else if (textLower.includes("hot") || textLower.includes("sweat") || textLower.includes("heat") || textLower.includes("workout")) {
        category = "THERMAL_EXERTION";
      } else if (textLower.includes("dizzy") || textLower.includes("lightheaded") || textLower.includes("nausea") || textLower.includes("spinning")) {
        category = "NEUROVESTIBULAR_DIZZINESS";
      }
    }

    return {
      symptomText: context.symptomText,
      detectedCompartmentId: compartmentId,
      detectedCompartmentName: compartmentName,
      primarySymptomCategory: category,
      currentSnapshot: context.currentSnapshot,
      astronautId: context.astronautId || "ASTRO-01",
    };
  },
});
