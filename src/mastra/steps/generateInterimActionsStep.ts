import { z } from "zod";
import { createStep } from "../core/index.ts";
import { generateClinicalTriageAI } from "../../services/ai/geminiClient.ts";
import { generateUnifiedTriageAI, type AIModelMode } from "../../services/ai/aiProvider.ts";
import { searchSpaceLifeGuides } from "../tools/spaceLifeLibraryTool.ts";

export const generateInterimActionsStep = createStep({
  id: "generate-interim-actions",
  inputSchema: z.object({
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
  }),
  execute: async ({ context }) => {
    // Search SpaceLife Library for grounded instructional resources & video guides ONLY when relevant
    let resourceCategory: string | undefined;
    let symptomCodes: string[] = [];

    if (context.primarySymptomCategory === "MUSCLE_SORENESS") {
      resourceCategory = "exercise";
      symptomCodes = ["FATIGUE", "MUSCLE_SORENESS"];
    } else if (context.primarySymptomCategory === "SLEEP_DISTURBANCE") {
      resourceCategory = "sleep";
      symptomCodes = ["SLEEP", "FATIGUE"];
    } else if (context.primarySymptomCategory === "NEUROVESTIBULAR_DIZZINESS") {
      resourceCategory = "adaptation";
      symptomCodes = ["NAUSEA", "DIZZINESS"];
    }

    // Only search library guides if an instructional category applies
    const resources = resourceCategory
      ? searchSpaceLifeGuides({
          query: context.symptomText,
          category: resourceCategory,
          symptomCodes,
          limit: 2,
        })
      : [];

    // 1. Attempt dynamic AI reasoning via active provider (Frontier or Local WebGPU)
    try {
      const activeMode: AIModelMode =
        (typeof window !== "undefined"
          ? (window.localStorage.getItem("habitrack_ai_model_mode") as AIModelMode)
          : "frontier") || "frontier";

      const dynamicAI = await generateUnifiedTriageAI({
        mode: activeMode,
        symptomText: context.symptomText,
        compartmentName: context.compartmentName,
        snapshot: context.telemetryReadings,
        astronautId: context.astronautId,
      });

      if (
        dynamicAI &&
        Array.isArray(dynamicAI.interimActions) &&
        dynamicAI.interimActions.length > 0
      ) {
        return {
          headline:
            dynamicAI.headline ||
            `First-Response Interim Protocol: ${context.compartmentName}`,
          symptomText: context.symptomText,
          compartmentName: context.compartmentName,
          telemetryReadings: context.telemetryReadings,
          interimActions: dynamicAI.interimActions,
          intent: context.intent,
          followupQuestions: context.followupQuestions,
          resources,
          latchedRuleId: dynamicAI.latchedRuleId || context.latchedRuleId,
          flightRuleTitle: dynamicAI.flightRuleTitle || context.flightRuleTitle,
          biologicalLatencyLag:
            dynamicAI.biologicalLatencyLag || context.biologicalLatencyLag,
          physiologicalRationale:
            dynamicAI.physiologicalRationale || context.physiologicalRationale,
          confidenceMatch:
            dynamicAI.confidenceMatch || context.confidenceMatch,
          astronautId: context.astronautId,
        };
      }
    } catch (err) {
      console.warn("AI dynamic clinical triage generation skipped or offline; falling back to deterministic protocol:", err);
    }

    // 2. Deterministic fallback if offline / API key unconfigured
    let actions: Array<{
      id: string;
      stepNumber: number;
      action: string;
      rationale: string;
      estimatedMinutes: number;
      completed: boolean;
    }> = [];

    if (context.primarySymptomCategory === "CRITICAL_EMERGENCY") {
      actions = [
        {
          id: "act-1",
          stepNumber: 1,
          action: "IMMEDIATE ESCALATION: Notify Commander and downlink emergency code to Flight Surgeon",
          rationale: "Acute pain, respiratory distress, or toxic hazard requires immediate operational medical intervention.",
          estimatedMinutes: 1,
          completed: false,
        },
        {
          id: "act-2",
          stepNumber: 2,
          action: "Don Portable Breathing Apparatus (PBA) if environmental contamination or ammonia is suspected",
          rationale: "Ensures an uncompromised airway until atmospheric gas chromatography verifies scrub state.",
          estimatedMinutes: 2,
          completed: false,
        },
        {
          id: "act-3",
          stepNumber: 3,
          action: "Deploy Station Emergency Medical Kit (CHeCS) to current compartment",
          rationale: "Pre-stages emergency pharmaceutical and monitoring equipment for crew medical officer.",
          estimatedMinutes: 3,
          completed: false,
        },
      ];
    } else if (context.primarySymptomCategory === "HEADACHE_HYPERCAPNIA") {
      actions = [
        {
          id: "act-1",
          stepNumber: 1,
          action: "Inspect your sleep station / module ventilation diffuser exhaust fan",
          rationale: "Microgravity lack of thermal buoyancy traps pockets of exhaled CO₂ directly around your head.",
          estimatedMinutes: 2,
          completed: false,
        },
        {
          id: "act-2",
          stepNumber: 2,
          action: "Ingest 500 mL water with oral electrolyte replacement",
          rationale: "Cephalic fluid shift elevates intracranial pressure; hydration supports central venous compliance.",
          estimatedMinutes: 3,
          completed: false,
        },
        {
          id: "act-3",
          stepNumber: 3,
          action: "Float into US Lab Destiny or higher-circulation station module",
          rationale: "Destiny provides 40% higher CFM airflow turnover and active CDRA scrubber draw.",
          estimatedMinutes: 5,
          completed: false,
        },
      ];
    } else if (context.primarySymptomCategory === "MUSCLE_SORENESS") {
      actions = [
        {
          id: "act-1",
          stepNumber: 1,
          action: "Hydrate with 500 mL electrolyte fluid to assist clearance of muscular metabolic byproducts",
          rationale: "Microgravity hypovolemia exacerbates muscle cramping and slows post-exercise DOMS recovery.",
          estimatedMinutes: 5,
          completed: false,
        },
        {
          id: "act-2",
          stepNumber: 2,
          action: "Perform gentle zero-g lower back and hamstring passive decompression stretches",
          rationale: "Reduces paravertebral muscle tension following axial resistance training on ARED.",
          estimatedMinutes: 10,
          completed: false,
        },
        {
          id: "act-3",
          stepNumber: 3,
          action: "Review ARED footplate alignment and bar locking demonstration video prior to next workout",
          rationale: "Ensures correct biomechanical posture and eliminates lumbar shear loads during microgravity squats.",
          estimatedMinutes: 4,
          completed: false,
        },
      ];
    } else if (context.primarySymptomCategory === "SLEEP_DISTURBANCE") {
      actions = [
        {
          id: "act-1",
          stepNumber: 1,
          action: "Inspect sleep station ventilation diffuser duct to prevent exhaled CO₂ bubble pooling",
          rationale: "Zero-g buoyancy loss traps high-concentration CO₂ around the facial breathing envelope during sleep.",
          estimatedMinutes: 3,
          completed: false,
        },
        {
          id: "act-2",
          stepNumber: 2,
          action: "Verify 4-point elastic tether tension on the Crew Quarters sleeping bag",
          rationale: "Tactile boundary stability dampens microgravity micro-movements and floating tactile illusions.",
          estimatedMinutes: 2,
          completed: false,
        },
        {
          id: "act-3",
          stepNumber: 3,
          action: "Deploy active acoustic attenuation / noise-canceling sleep headset",
          rationale: "Suppresses continuous station fan and pump noise to support restorative REM cycles.",
          estimatedMinutes: 1,
          completed: false,
        },
      ];
    } else if (context.primarySymptomCategory === "OCULAR_IRRITATION") {
      actions = [
        {
          id: "act-1",
          stepNumber: 1,
          action: "Instill 2 drops of preservative-free artificial tear solution into each eye",
          rationale: "Restores tear film integrity stripped by low relative humidity and forced air currents.",
          estimatedMinutes: 2,
          completed: false,
        },
        {
          id: "act-2",
          stepNumber: 2,
          action: "Reposition localized duct diffuser louvers away from facial line-of-sight",
          rationale: "Direct cabin ventilation streams rapidly evaporate the pre-corneal lipid layer.",
          estimatedMinutes: 2,
          completed: false,
        },
        {
          id: "act-3",
          stepNumber: 3,
          action: "Inspect the return air grille for floating particulate lint or fiber debris",
          rationale: "Prevents mechanical abrasion from airborne particulate in zero-gravity.",
          estimatedMinutes: 4,
          completed: false,
        },
      ];
    } else if (context.primarySymptomCategory === "THERMAL_EXERTION") {
      actions = [
        {
          id: "act-1",
          stepNumber: 1,
          action: "Terminate workout exertion and anchor to the deck foot-restraints",
          rationale: "Eliminates metabolic heat generation and prevents autonomic cardiac drift.",
          estimatedMinutes: 1,
          completed: false,
        },
        {
          id: "act-2",
          stepNumber: 2,
          action: "Position portable auxiliary ventilation booster directly over torso",
          rationale: "Provides forced convective air velocity to evaporate adhering microgravity sweat.",
          estimatedMinutes: 2,
          completed: false,
        },
        {
          id: "act-3",
          stepNumber: 3,
          action: "Consume 750 mL chilled electrolyte pouch over 15 minutes",
          rationale: "Restores intravascular volume and accelerates core thermodynamic cooling.",
          estimatedMinutes: 15,
          completed: false,
        },
      ];
    } else {
      actions = [
        {
          id: "act-1",
          stepNumber: 1,
          action: "Verify current compartment airflow and nominal ventilation velocity",
          rationale: "Ensures adequate air turnover in the immediate crew breathing envelope.",
          estimatedMinutes: 2,
          completed: false,
        },
        {
          id: "act-2",
          stepNumber: 2,
          action: "Attach pulse oximeter finger sensor to record resting SpO2 and pulse",
          rationale: "Establishes acute baseline metrics for flight surgeon downlink comparison.",
          estimatedMinutes: 3,
          completed: false,
        },
        {
          id: "act-3",
          stepNumber: 3,
          action: "Rest in neutral zero-g posture with minimal head rotation",
          rationale: "Reduces autonomic strain and neurovestibular sensory conflict.",
          estimatedMinutes: 10,
          completed: false,
        },
      ];
    }

    let headline = `First-Response Interim Protocol: ${context.compartmentName}`;
    if (context.primarySymptomCategory === "CRITICAL_EMERGENCY") {
      headline = `EMERGENCY MEDICAL ESCALATION: ${context.compartmentName}`;
    } else if (context.primarySymptomCategory === "MUSCLE_SORENESS") {
      headline = `Exercise Recovery & Musculoskeletal Protocol`;
    } else if (context.primarySymptomCategory === "SLEEP_DISTURBANCE") {
      headline = `Crew Quarters Sleep Habitability Protocol`;
    }

    return {
      headline,
      symptomText: context.symptomText,
      compartmentName: context.compartmentName,
      telemetryReadings: context.telemetryReadings,
      interimActions: actions,
      intent: context.intent,
      followupQuestions: context.followupQuestions,
      resources,
      latchedRuleId: context.latchedRuleId,
      flightRuleTitle: context.flightRuleTitle,
      biologicalLatencyLag: context.biologicalLatencyLag,
      physiologicalRationale: context.physiologicalRationale,
      confidenceMatch: context.confidenceMatch,
      astronautId: context.astronautId,
    };
  },
});
