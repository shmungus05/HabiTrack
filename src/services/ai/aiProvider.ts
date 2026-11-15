/**
 * src/services/ai/aiProvider.ts (Unified Synthetic Intelligence Provider)
 *
 * Unified SI Provider Dispatcher for HabiTrack.
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
  generateClinicalTriageSI,
  type DynamicTriageSIResponse,
  type DynamicTriageAIResponse,
  type ChatHistoryTurn,
} from "./geminiClient.ts";
import {
  generateLocalRagResponse,
  generateLocalClinicalTriage,
  isLocalModelReady,
} from "./localModelService.ts";
import {
  generateSargalayChatCompletion,
  getSargalayApiKey,
  getSargalayModel,
  getSargalayModelLabel,
  type SargalayChatMessage,
} from "./sargalayClient.ts";
import {
  generateOllamaChatCompletion,
  type OllamaChatMessage,
} from "./ollamaClient.ts";

export type SIModelMode = "frontier" | "local";
export type AIModelMode = SIModelMode;

export interface UnifiedRagResult {
  answer: string;
  provider: string;
  isFallback: boolean;
}

/**
 * Dispatches knowledge queries to the selected model mode or active gateway.
 */
export async function generateUnifiedRagResponse(params: {
  mode: SIModelMode;
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

  // 1. Local Ollama Execution (preferred offline runtime, then WebGPU)
  if (mode === "local" && typeof window !== "undefined") {
    try {
      const ollamaMessages: OllamaChatMessage[] = [
        {
          role: "system",
          content:
            "You are HabiTrack Flight SI, an onboard clinical decision-support and crew health synthetic intelligence system for ISS Expedition 71. Ground your answers in spaceflight physiology and NASA Flight Rules, maintaining non-causal epistemic guardrails.",
        },
      ];

      if (history.length > 0) {
        for (const h of history) {
          if (h.text && h.text.trim()) {
            ollamaMessages.push({
              role: h.role === "user" ? "user" : "assistant",
              content: h.text,
            });
          }
        }
      }

      let promptText = "";
      if (evidence.length > 0) {
        promptText += `Relevant NASA Biomedical Evidence:\n${evidence.map((e) => `[${e.doc_id}: ${e.section_heading}] ${e.excerpt}`).join("\n\n")}\n\n`;
      }
      if (telemetryContext) {
        promptText += `Station Telemetry (${telemetryContext.compartment || "Onboard"}):\n- CO2: ${telemetryContext.co2Ppm} ppm | Temp: ${telemetryContext.tempC}°C | Humidity: ${telemetryContext.humidityPct}% | Rad: ${telemetryContext.radiationRateMGy} mGy/d | Pressure: ${telemetryContext.pressureMmHg} mmHg\n\n`;
      }
      if (crewContext) {
        promptText += `Active Crewmember: ${crewContext}\n\n`;
      }
      promptText += `Crew Query: "${userQuery}"`;

      ollamaMessages.push({ role: "user", content: promptText });

      const ollamaRes = await generateOllamaChatCompletion({
        messages: ollamaMessages,
        temperature: 0.3,
        maxTokens: 800,
      });

      return {
        answer: ollamaRes.content,
        provider: `Ollama Local (${ollamaRes.modelUsed})`,
        isFallback: false,
      };
    } catch (ollamaErr) {
      console.warn("[siProvider] Local Ollama call failed, checking WebGPU or fallback:", ollamaErr);
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
          console.warn("[siProvider] Local WebGPU model inference failed:", localErr);
        }
      }
    }
  }

  // 2. Frontier Execution (Sargalay Gateway preferred, then direct Gemini)
  if (mode === "frontier") {
    const sargalayKey = getSargalayApiKey();
    if (sargalayKey) {
      try {
        const messages: SargalayChatMessage[] = [
          {
            role: "system",
            content:
              "You are HabiTrack Flight SI, an advanced onboard clinical decision-support and crew health synthetic intelligence system for ISS Expedition 71. Ground your answers in spaceflight physiology and NASA Flight Rules, maintaining non-causal epistemic guardrails.",
          },
        ];

        if (history.length > 0) {
          for (const h of history) {
            if (h.text && h.text.trim()) {
              messages.push({
                role: h.role === "user" ? "user" : "assistant",
                content: h.text,
              });
            }
          }
        }

        let promptText = "";
        if (evidence.length > 0) {
          promptText += `Relevant NASA Biomedical Evidence:\n${evidence.map((e) => `[${e.doc_id}: ${e.section_heading}] ${e.excerpt}`).join("\n\n")}\n\n`;
        }
        if (telemetryContext) {
          promptText += `Station Telemetry (${telemetryContext.compartment || "Onboard"}):\n- CO2: ${telemetryContext.co2Ppm} ppm | Temp: ${telemetryContext.tempC}°C | Humidity: ${telemetryContext.humidityPct}% | Rad: ${telemetryContext.radiationRateMGy} mGy/d | Pressure: ${telemetryContext.pressureMmHg} mmHg\n\n`;
        }
        if (crewContext) {
          promptText += `Active Crewmember: ${crewContext}\n\n`;
        }
        promptText += `Crew Query: "${userQuery}"`;

        messages.push({ role: "user", content: promptText });

        const res = await generateSargalayChatCompletion({
          messages,
          preferredModel: getSargalayModel(),
          temperature: 0.6,
          maxTokens: 800,
        });

        return {
          answer: res.content,
          provider: `${getSargalayModelLabel(res.modelUsed)} (via Sargalay Gateway)`,
          isFallback: res.isFallback,
        };
      } catch (sargalayErr) {
        console.warn("[siProvider] Sargalay Gateway call failed, attempting fallback:", sargalayErr);
      }
    }

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
      console.warn("[siProvider] Frontier Gemini call failed or unconfigured:", geminiErr);
    }
  }

  // 4. Deterministic Extractive Fallback
  let fallbackText = "";
  if (evidence.length === 0) {
    fallbackText =
      `Greetings. I am HabiTrack, your onboard clinical decision-support synthetic intelligence system for Expedition 71.\n\n` +
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
export async function generateUnifiedTriageSI(params: {
  mode: SIModelMode;
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
}): Promise<DynamicTriageSIResponse> {
  const { mode, ...payload } = params;

  if (mode === "local" && typeof window !== "undefined") {
    try {
      const systemInstruction =
        "You are an expert spaceflight clinical triage assistant. Respond strictly with valid JSON conforming to the DynamicTriageSIResponse schema.";
      const prompt = `Perform clinical triage for reported symptom: "${payload.symptomText}" in compartment "${payload.compartmentName}". Telemetry: CO2 ${payload.snapshot.co2Ppm} ppm, Temp ${payload.snapshot.tempC}°C. Return JSON with fields: symptom, category, primaryEtiology, ruleId, ruleTitle, ruleAction, recommendation, recommendedActions, immediateChecklist, escalationRequired, rationale, disclaimer, differentialConsiderations, telemetryAssessment.`;

      const ollamaRes = await generateOllamaChatCompletion({
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt },
        ],
        format: "json",
        temperature: 0.1,
      });

      let cleaned = ollamaRes.content.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json\s*/, "").replace(/```$/, "").trim();
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```\s*/, "").replace(/```$/, "").trim();
      }
      return JSON.parse(cleaned) as DynamicTriageSIResponse;
    } catch (ollamaErr) {
      console.warn("[siProvider] Local Ollama triage failed, attempting WebGPU or cloud fallback:", ollamaErr);
      if (isLocalModelReady()) {
        try {
          return await generateLocalClinicalTriage(payload);
        } catch (err) {
          console.warn("[siProvider] Local WebGPU clinical triage inference failed, attempting cloud fallback:", err);
        }
      }
    }
  }

  // Default to Gemini (Frontier)
  return await generateClinicalTriageSI(payload);
}

// Backward-compatible alias
export const generateUnifiedTriageAI = generateUnifiedTriageSI;
