/**
 * src/services/ai/localModelService.ts
 *
 * Dedicated in-browser WebGPU execution engine for Llama-3.2-1B-Instruct-q4f16_1.
 * Uses @mlc-ai/web-llm running in a dedicated Web Worker to ensure 100% offline
 * execution with zero backend server dependencies and zero UI thread stutter.
 */

import {
  CreateWebWorkerMLCEngine,
  CreateMLCEngine,
  type MLCEngineInterface,
  type InitProgressReport,
  type AppConfig,
} from "@mlc-ai/web-llm";

import type { CitedEvidence } from "../../types/api.ts";
import type { DynamicTriageAIResponse } from "./geminiClient.ts";

export const LOCAL_MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
export const LOCAL_MODEL_DISPLAY_NAME = "Llama-3.2-1B-Instruct (WebGPU Local)";

export interface LocalModelProgress {
  progress: number; // 0.0 to 1.0
  text: string;
}

export type LocalModelStatus = "unloaded" | "loading" | "ready" | "error";

let engineInstance: MLCEngineInterface | null = null;
let currentWorker: Worker | null = null;
let isInitializing = false;

const SYSTEM_INSTRUCTION = `
You are HabiTrack, an onboard clinical decision-support co-pilot for ISS Expedition 71.
You assist astronauts, flight surgeons, and mission specialists in monitoring environmental factors, vital signs, and NASA Flight Rules.

Guidelines:
1. Be helpful, concise, professional, and clear.
2. If NASA research context is provided, ground your answer in it and reference findings.
3. If greeting or general conversation (e.g. "hi", "hello", "how are you"), respond naturally and warmly as the onboard AI assistant.
4. Non-Causal Epistemic Guardrail: Never claim single-variable clinical causation (avoid asserting that X "caused" or "cured" Y). Use correlation terminology ("temporally associated with", "correlated with").
5. Keep responses concise (typically 2-4 sentences unless detailed analysis is requested).
`.trim();

/**
 * Checks whether WebGPU is available in the current browser environment.
 */
export async function checkWebGpuSupport(): Promise<{ supported: boolean; reason?: string }> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { supported: false, reason: "Non-browser environment" };
  }

  const nav = navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } };
  if (!nav.gpu) {
    return {
      supported: false,
      reason: "WebGPU is not enabled in this browser. Please enable WebGPU or update your GPU drivers.",
    };
  }

  try {
    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) {
      return { supported: false, reason: "No compatible WebGPU hardware adapter found." };
    }
    return { supported: true };
  } catch (err) {
    return {
      supported: false,
      reason: err instanceof Error ? err.message : "WebGPU adapter probe failed.",
    };
  }
}

/**
 * Builds the AppConfig pointing first to local self-hosted assets in /models/,
 * with fallback to the public MLC repository.
 */
function buildAppConfig(): AppConfig {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : typeof self !== "undefined" && self.location
      ? self.location.origin
      : "";
  const localModelUrl = `${origin}/models/${LOCAL_MODEL_ID}/`;
  const localWasmUrl = `${origin}/models/${LOCAL_MODEL_ID}/Llama-3.2-1B-Instruct-q4f16_1_cs1k-webgpu.wasm`;

  return {
    model_list: [
      {
        model: localModelUrl,
        model_id: LOCAL_MODEL_ID,
        model_lib: localWasmUrl,
        vram_required_MB: 880,
        low_resource_required: true,
        required_features: ["shader-f16"],
        overrides: {
          context_window_size: 4096,
        },
      },
    ],
  };
}

/**
 * Purges any corrupted HTML-poisoned responses stored in the browser's CacheStorage.
 * If Vite or another server returned index.html for unmapped model routes previously,
 * CacheStorage saved that HTML with HTTP 200, causing subsequent JSON.parse calls to crash.
 */
export async function purgeCorruptedWebLLMCache(forceAll = false): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      if (name.startsWith("webllm/")) {
        if (forceAll) {
          await caches.delete(name);
          console.warn(`[WebLLM] Purged complete cache: ${name}`);
          continue;
        }
        const cache = await caches.open(name);
        const requests = await cache.keys();
        for (const req of requests) {
          const res = await cache.match(req);
          if (res) {
            const contentType = res.headers.get("content-type") || "";
            // If the response is text/html, it's an erroneous SPA fallback rather than valid JSON/WASM/weights
            if (contentType.includes("text/html")) {
              await cache.delete(req);
              console.warn(`[WebLLM] Evicted corrupted HTML response for ${req.url} from ${name}`);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("[WebLLM] Error while purging caches:", err);
  }
}

/**
 * Initializes and loads the Llama-3.2-1B model into browser WebGPU memory.
 */
export async function initLocalModel(
  onProgress?: (progress: LocalModelProgress) => void
): Promise<MLCEngineInterface> {
  if (engineInstance) {
    return engineInstance;
  }

  if (isInitializing) {
    throw new Error("Model initialization is already in progress.");
  }

  isInitializing = true;

  try {
    const gpuCheck = await checkWebGpuSupport();
    if (!gpuCheck.supported) {
      throw new Error(gpuCheck.reason || "WebGPU not supported.");
    }

    // Automatically evict any HTML-poisoned responses from browser CacheStorage first
    await purgeCorruptedWebLLMCache();

    const appConfig = buildAppConfig();

    const progressCallback = (report: InitProgressReport) => {
      if (onProgress) {
        onProgress({
          progress: report.progress,
          text: report.text,
        });
      }
    };

    // Attempt 1: Try dedicated Web Worker to avoid blocking UI thread
    try {
      currentWorker = new Worker(
        new URL("../../workers/webllm.worker.ts", import.meta.url),
        { type: "module" }
      );

      engineInstance = await CreateWebWorkerMLCEngine(
        currentWorker,
        LOCAL_MODEL_ID,
        {
          appConfig,
          initProgressCallback: progressCallback,
        }
      );
    } catch (workerErr) {
      console.warn(
        "Web Worker initialization failed, falling back to main-thread MLCEngine:",
        workerErr
      );
      if (currentWorker) {
        currentWorker.terminate();
        currentWorker = null;
      }

      const errStr = workerErr instanceof Error ? workerErr.message : String(workerErr);
      if (errStr.includes("<!doctype") || errStr.includes("Unexpected token '<'")) {
        console.warn("[WebLLM] Detected corrupted HTML cache in worker. Purging webllm/ caches...");
        await purgeCorruptedWebLLMCache(true);
      }

      // Attempt 2: Fallback to direct MLCEngine on main thread
      engineInstance = await CreateMLCEngine(LOCAL_MODEL_ID, {
        appConfig,
        initProgressCallback: progressCallback,
      });
    }

    return engineInstance;
  } catch (err) {
    const errStr = err instanceof Error ? err.message : String(err);
    if (errStr.includes("<!doctype") || errStr.includes("Unexpected token '<'")) {
      console.warn("[WebLLM] Detected corrupted HTML cache on main thread. Purging all webllm caches...");
      await purgeCorruptedWebLLMCache(true);
    }
    throw err;
  } finally {
    isInitializing = false;
  }
}

/**
 * Checks if the local engine is initialized and ready.
 */
export function isLocalModelReady(): boolean {
  return engineInstance !== null;
}

/**
 * Unloads the local model from WebGPU memory and terminates the worker.
 */
export async function unloadLocalModel(): Promise<void> {
  if (engineInstance) {
    try {
      await engineInstance.unload();
    } catch (e) {
      console.warn("Error during model unload:", e);
    }
    engineInstance = null;
  }

  if (currentWorker) {
    currentWorker.terminate();
    currentWorker = null;
  }
}

export interface ChatHistoryTurn {
  role: "user" | "model" | "assistant";
  text: string;
}

/**
 * Generates an evidence-grounded RAG response using Llama-3.2-1B-Instruct locally.
 */
export async function generateLocalRagResponse(
  userQuery: string,
  evidence: CitedEvidence[] = [],
  crewContext?: string | null,
  history: ChatHistoryTurn[] = [],
  telemetryContext?: {
    co2Ppm: number;
    tempC: number;
    humidityPct: number;
    radiationRateMGy: number;
    pressureMmHg: number;
    compartment?: string;
  } | null
): Promise<{ answer: string; provider: string }> {
  if (!engineInstance) {
    throw new Error("Local model is not initialized. Please load the model first.");
  }

  let promptContent = "";
  if (telemetryContext) {
    promptContent += `[Current Compartment: ${telemetryContext.compartment || "ISS Cabin"}] ppCO2: ${telemetryContext.co2Ppm} ppm | Temp: ${telemetryContext.tempC} °C | Humidity: ${telemetryContext.humidityPct}% | Rad: ${telemetryContext.radiationRateMGy} mGy/d | Press: ${telemetryContext.pressureMmHg} mmHg\n\n`;
  }

  if (evidence.length > 0) {
    const citationsText = evidence
      .map((e) => `[${e.doc_id}: ${e.section_heading}] ${e.excerpt}`)
      .join("\n\n");
    promptContent += `Relevant Evidence from NASA Human Research Program:\n${citationsText}\n\nCrew Query: "${userQuery}"`;
  } else {
    promptContent += `Crew Query: "${userQuery}"`;
  }

  if (crewContext) {
    promptContent = `Active Crewmember: ${crewContext}\n${promptContent}`;
  }

  // Format chat messages including recent history
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: SYSTEM_INSTRUCTION },
  ];

  // Add up to 3 turns of recent conversation history (concisely bounded to prevent KV-cache bloat)
  const recentHistory = history.slice(-3);
  for (const h of recentHistory) {
    const trimmedText = h.text.length > 220 ? `${h.text.slice(0, 220)}...` : h.text;
    messages.push({
      role: h.role === "model" ? "assistant" : "user",
      content: trimmedText,
    });
  }

  messages.push({ role: "user", content: promptContent });

  const reply = await engineInstance.chat.completions.create({
    messages,
    temperature: 0.35,
    max_tokens: 250,
  });

  const rawAnswer = reply.choices[0]?.message?.content?.trim() || "No response generated.";

  return {
    answer: rawAnswer,
    provider: `${LOCAL_MODEL_DISPLAY_NAME} (Offline WebGPU)`,
  };
}

/**
 * Generates dynamic clinical triage actions using the local Llama-3.2-1B model.
 */
export async function generateLocalClinicalTriage(params: {
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
  if (!engineInstance) {
    throw new Error("Local model is not initialized. Please load the model first.");
  }

  const prompt = `
You are the Onboard Clinical First-Response AI for ISS Expedition 71.
Perform rapid triage and generate stabilization countermeasures for:
Astronaut: ${params.astronautId || "ASTRO-01"}
Location: ${params.compartmentName}
Symptom: "${params.symptomText}"
Telemetry: CO2=${params.snapshot.co2Ppm} ppm, Temp=${params.snapshot.tempC} C, Humidity=${params.snapshot.humidityPct}%, Pressure=${params.snapshot.pressureMmHg} mmHg

Return JSON ONLY formatted as:
{
  "headline": "Brief assessment",
  "physiologicalRationale": "Spaceflight physiology explanation (non-causal)",
  "biologicalLatencyLag": "Estimated physiological onset window",
  "confidenceMatch": "High (94%)",
  "latchedRuleId": "FR-ECLSS-001",
  "flightRuleTitle": "Mitigation Flight Rule",
  "interimActions": [
    { "id": "act-1", "stepNumber": 1, "action": "Action 1", "rationale": "Why", "estimatedMinutes": 5, "completed": false },
    { "id": "act-2", "stepNumber": 2, "action": "Action 2", "rationale": "Why", "estimatedMinutes": 5, "completed": false },
    { "id": "act-3", "stepNumber": 3, "action": "Action 3", "rationale": "Why", "estimatedMinutes": 5, "completed": false }
  ]
}
`.trim();

  const reply = await engineInstance.chat.completions.create({
    messages: [
      {
        role: "system",
        content:
          "You are a clinical decision support co-pilot. Output pure JSON only without markdown code blocks.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 450,
  });

  const content = reply.choices[0]?.message?.content?.trim() || "";

  // Extract JSON using regex in case of conversational wrapper
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as DynamicTriageAIResponse;
      if (parsed && Array.isArray(parsed.interimActions) && parsed.interimActions.length > 0) {
        return parsed;
      }
    } catch {
      // Fall through to error
    }
  }

  throw new Error("Local model did not produce valid structured triage JSON.");
}
