/**
 * src/services/ai/aiProvider.ts
 *
 * Unified AI Provider Dispatcher for HabiTrack.
 * Dispatches between:
 * 1. "frontier" -> Google Gemini 2.5 Flash via REST API
 * 2. "local"    -> In-Browser WebGPU Llama-3.2-1B-Instruct
 *
 * Provides automatic fallback to deterministic flight rules and extractive
 * evidence when offline or when models/keys are unavailable.
 */

import type { CitedEvidence } from "../../types/api.ts";
import {
  generateGeminiRagResponse,
  generateClinicalTriageAI,
  type DynamicTriageAIResponse,
  type ChatHistoryTurn,
} from "./geminiClient.ts";
import {
  generateLocalRagResponse,
  generateLocalClinicalTriage,
  isLocalModelReady,
} from "./localModelService.ts";

export type AIModelMode = "frontier" | "local";

export interface UnifiedRagResult {
  answer: string;
  provider: string;
  isFallback: boolean;
}

/**
 * Dispatches knowledge queries to the selected model mode.
 */
export async function generateUnifiedRagResponse(params: {
  mode: AIModelMode;
  userQuery: string;
  evidence?: CitedEvidence[];
  crewContext?: string | null;
  history?: ChatHistoryTurn[];
  telemetryContext?: {
    co2Ppm: number;
    tempC: number;
    humidityPct: number;
    radiationRateMGy: number;
    pressureMmHg: number;
    compartment?: string;
  } | null;
}): Promise<UnifiedRagResult> {
  const {
    mode,
    userQuery,
    evidence = [],
    crewContext,
    history = [],
    telemetryContext = null,
  } = params;

  // 1. Local WebGPU Execution
  if (mode === "local") {
    if (isLocalModelReady()) {
      try {
        const localRes = await generateLocalRagResponse(
          userQuery,
          evidence,
          crewContext,
          history,
          telemetryContext
        );
        return {
          answer: localRes.answer,
          provider: localRes.provider,
          isFallback: false,
        };
      } catch (localErr) {
        console.warn("[aiProvider] Local model inference failed:", localErr);
      }
    } else {
      console.warn("[aiProvider] Local model selected but not yet loaded.");
    }
  }

  // 2. Frontier (Gemini 2.5 Flash) Execution
  if (mode === "frontier") {
    try {
      const geminiRes = await generateGeminiRagResponse(
        userQuery,
        evidence,
        crewContext,
        history,
        telemetryContext
      );
      return {
        answer: geminiRes.answer,
        provider: geminiRes.provider,
        isFallback: false,
      };
    } catch (geminiErr) {
      console.warn("[aiProvider] Frontier Gemini call failed or unconfigured:", geminiErr);
    }
  }

  // 3. Deterministic Extractive Fallback
  let fallbackText = "";
  if (evidence.length === 0) {
    fallbackText =
      `Greetings. I am HabiTrack, your onboard clinical decision-support co-pilot for Expedition 71.\n\n` +
      `I monitor 5 spacecraft environmental factors (ppCO₂, radiation, cabin temp, humidity, atmospheric pressure) ` +
      `alongside crew circadian baselines and NASA Flight Rules.\n\n` +
      `How can I assist you with station telemetry, flight rules, or symptom evaluations?`;
  } else {
    fallbackText =
      `Relevant biomedical evidence from the NASA Human Research Program literature corpus:\n\n` +
      evidence.map((e) => `• **[${e.doc_id}: ${e.section_heading}]** ${e.excerpt}`).join("\n\n");
  }

  return {
    answer: fallbackText,
    provider: "Mastra Onboard First-Response Engine (Deterministic Extractive)",
    isFallback: true,
  };
}

/**
 * Dispatches clinical triage generation to either Frontier or Local model.
 */
export async function generateUnifiedTriageAI(params: {
  mode: AIModelMode;
  symptomText: string;
  compartmentName: string;
  snapshot: {
    co2Ppm: number;
    tempC: number;
    humidityPct: number;
    radiationRateMGy: number;
    pressureMmHg: number;
    airflowProfile?: string;
  };
  astronautId?: string;
}): Promise<DynamicTriageAIResponse> {
  const { mode, ...payload } = params;

  if (mode === "local" && isLocalModelReady()) {
    try {
      return await generateLocalClinicalTriage(payload);
    } catch (err) {
      console.warn("[aiProvider] Local clinical triage inference failed, attempting cloud fallback:", err);
    }
  }

  // Default to Gemini (Frontier)
  return await generateClinicalTriageAI(payload);
}
