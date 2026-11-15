import { z } from "zod";
import { createStep } from "../core/index.ts";

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
      "MUSCLE_SORENESS",
      "SLEEP_DISTURBANCE",
      "OCULAR_IRRITATION",
      "THERMAL_EXERTION",
      "NEUROVESTIBULAR_DIZZINESS",
      "CRITICAL_EMERGENCY",
      "GENERIC_DISCOMFORT",
    ]),
    intent: z.enum([
      "health_concern",
      "exercise_guidance",
      "sleep_guidance",
      "mental_wellbeing",
      "daily_living",
      "general_question",
    ]),
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

    // 2. Identify primary symptom category and conversational intent
    let category:
      | "HEADACHE_HYPERCAPNIA"
      | "MUSCLE_SORENESS"
      | "SLEEP_DISTURBANCE"
      | "OCULAR_IRRITATION"
      | "THERMAL_EXERTION"
      | "NEUROVESTIBULAR_DIZZINESS"
      | "CRITICAL_EMERGENCY"
      | "GENERIC_DISCOMFORT" = "GENERIC_DISCOMFORT";

    let intent:
      | "health_concern"
      | "exercise_guidance"
      | "sleep_guidance"
      | "mental_wellbeing"
      | "daily_living"
      | "general_question" = "general_question";

    let followupQuestions: string[] = [];

    const hasNegation =
      textLower.includes("no headache") ||
      textLower.includes("not having") ||
      textLower.includes("without") ||
      textLower.includes("no symptom") ||
      textLower.includes("feeling good") ||
      textLower.includes("feeling fine");

    if (!hasNegation) {
      if (
        textLower.includes("chest pain") ||
        textLower.includes("cannot breathe") ||
        textLower.includes("shortness of breath") ||
        textLower.includes("toxic") ||
        textLower.includes("ammonia")
      ) {
        category = "CRITICAL_EMERGENCY";
        intent = "health_concern";
      } else if (
        textLower.includes("headache") ||
        textLower.includes("throbbing") ||
        textLower.includes("fog") ||
        textLower.includes("pco2") ||
        textLower.includes("hypercapnia")
      ) {
        category = "HEADACHE_HYPERCAPNIA";
        intent = "health_concern";
      } else if (
        textLower.includes("sore") ||
        textLower.includes("soreness") ||
        textLower.includes("muscle") ||
        textLower.includes("stiff") ||
        textLower.includes("aching") ||
        textLower.includes("strain") ||
        textLower.includes("doms") ||
        textLower.includes("back pain")
      ) {
        category = "MUSCLE_SORENESS";
        intent = textLower.includes("exercise") || textLower.includes("workout") || textLower.includes("squat")
          ? "exercise_guidance"
          : "health_concern";
        followupQuestions = [
          "Where are you feeling the soreness (e.g. lower back, thighs, shoulders)?",
          "Did this discomfort begin during or after your ARED or treadmill workout?",
          "Is it a dull muscular ache or a sharp/shooting pain?",
        ];
      } else if (
        textLower.includes("sleep") ||
        textLower.includes("insomnia") ||
        textLower.includes("wake up") ||
        textLower.includes("bunk") ||
        textLower.includes("rest cycle") ||
        textLower.includes("cannot sleep")
      ) {
        category = "SLEEP_DISTURBANCE";
        intent = "sleep_guidance";
        followupQuestions = [
          "Are you experiencing local airflow stagnation in your sleep station?",
          "Is acoustic background noise (>60 dBA) disrupting your rest cycle?",
        ];
      } else if (
        textLower.includes("eye") ||
        textLower.includes("dry") ||
        textLower.includes("stinging") ||
        textLower.includes("irritat")
      ) {
        category = "OCULAR_IRRITATION";
        intent = "health_concern";
      } else if (
        textLower.includes("hot") ||
        textLower.includes("sweat") ||
        textLower.includes("heat") ||
        textLower.includes("workout")
      ) {
        category = "THERMAL_EXERTION";
        intent = "exercise_guidance";
      } else if (
        textLower.includes("dizzy") ||
        textLower.includes("lightheaded") ||
        textLower.includes("nausea") ||
        textLower.includes("spinning") ||
        textLower.includes("vertigo")
      ) {
        category = "NEUROVESTIBULAR_DIZZINESS";
        intent = "health_concern";
      }
    }

    return {
      symptomText: context.symptomText,
      detectedCompartmentId: compartmentId,
      detectedCompartmentName: compartmentName,
      primarySymptomCategory: category,
      intent,
      followupQuestions: followupQuestions.length > 0 ? followupQuestions : undefined,
      currentSnapshot: context.currentSnapshot,
      astronautId: context.astronautId || "ASTRO-01",
    };
  },
});
