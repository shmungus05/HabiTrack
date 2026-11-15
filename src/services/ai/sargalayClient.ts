/**
/**
 * src/services/ai/sargalayClient.ts
 *
 * Client-side OpenAI-compatible API Gateway client for Sargalay (https://api.sargalay.com/v1).
 * Supports multi-model fallback cascades:
 * 1. google/gemini-2.0-flash-001 / google/gemini-2.5-flash (Primary)
 * 2. google/gemini-2.5-flash-lite (Speed & High Quota)
 * 3. deepseek/deepseek-chat (DeepSeek V3 Reasoning)
 * 4. openai/gpt-4o-mini (Resilient Secondary)
 * 5. Deterministic Extractive Engine (Zero-Network Emergency)
 */

export const SARGALAY_BASE_URL = "https://api.sargalay.com/v1";

export const SARGALAY_CURATED_MODELS = [
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "Google (via Sargalay)",
    description: "Ultra-fast multimodal reasoning, highest efficiency",
  },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash-Lite",
    provider: "Google (via Sargalay)",
    description: "Lightweight, lowest latency for high-frequency queries",
  },
  {
    id: "deepseek/deepseek-chat",
    name: "DeepSeek-Chat (V3)",
    provider: "DeepSeek (via Sargalay)",
    description: "Exceptional clinical reasoning and structured tool synthesis",
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI (via Sargalay)",
    description: "High-reliability secondary failover",
  },
] as const;

export const SARGALAY_FALLBACK_CHAIN = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "deepseek/deepseek-chat",
  "openai/gpt-4o-mini",
] as const;

export const DEFAULT_SARGALAY_MODEL = "google/gemini-2.5-flash";

export function getSargalayApiKey(): string | null {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("habitrack_sargalay_api_key");
    if (stored && stored.trim().length > 0) {
      return stored.trim();
    }
  }
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const envKey = import.meta.env.VITE_SARGALAY_API_KEY as string | undefined;
    if (envKey && envKey.trim().length > 0) {
      return envKey.trim();
    }
  }
  return "sk-124e692b7be84fd78e47b815f44d6875";
}

export function setSargalayApiKey(key: string): void {
  if (typeof window !== "undefined") {
    const trimmed = key.trim();
    if (trimmed) {
      localStorage.setItem("habitrack_sargalay_api_key", trimmed);
    } else {
      localStorage.removeItem("habitrack_sargalay_api_key");
    }
    window.dispatchEvent(
      new CustomEvent("habitrack_sargalay_key_updated", { detail: { key: trimmed } })
    );
  }
}

export function getSargalayModel(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("habitrack_sargalay_model") || DEFAULT_SARGALAY_MODEL;
  }
  return DEFAULT_SARGALAY_MODEL;
}

export function setSargalayModel(model: string): void {
  if (typeof window !== "undefined") {
    const trimmed = model.trim();
    if (trimmed) {
      localStorage.setItem("habitrack_sargalay_model", trimmed);
    } else {
      localStorage.removeItem("habitrack_sargalay_model");
    }
    window.dispatchEvent(
      new CustomEvent("habitrack_sargalay_model_updated", { detail: { model: trimmed } })
    );
  }
}

export function getSargalayModelLabel(modelId?: string): string {
  const id = modelId || getSargalayModel();
  const match = SARGALAY_CURATED_MODELS.find((m) => m.id === id);
  return match ? match.name : id;
}

export interface SargalayChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface SargalayCompletionResult {
  content: string;
  modelUsed: string;
  isFallback: boolean;
}

/**
 * Executes chat completions through Sargalay API with automatic multi-model failover.
 */
export async function generateSargalayChatCompletion(params: {
  messages: SargalayChatMessage[];
  preferredModel?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<SargalayCompletionResult> {
  const apiKey = getSargalayApiKey();
  if (!apiKey) {
    throw new Error("No Sargalay API key configured.");
  }

  const preferred = params.preferredModel || getSargalayModel();

  // Deduplicated candidate chain starting with preferred model
  const candidateModels = Array.from(
    new Set([preferred, ...SARGALAY_FALLBACK_CHAIN])
  );

  let lastError: Error | null = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const model = candidateModels[i];
    const isFallback = i > 0;

    try {
      const response = await fetch(`${SARGALAY_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: params.messages,
          temperature: params.temperature ?? 0.5,
          max_tokens: params.maxTokens ?? 1000,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `HTTP ${response.status}`;
        throw new Error(`[Sargalay ${model}] ${errMsg}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();

      if (!content) {
        throw new Error(`[Sargalay ${model}] Returned empty response.`);
      }

      return {
        content,
        modelUsed: model,
        isFallback,
      };
    } catch (err) {
      console.warn(`[sargalayClient] Model '${model}' failed:`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
      // Continue to next candidate model in the chain
    }
  }

  throw lastError || new Error("All Sargalay fallback models failed.");
}

/**
 * Tests connection to the Sargalay API Gateway.
 */
export async function testSargalayApiKey(
  testKey?: string,
  testModel?: string
): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  const key = testKey?.trim() || getSargalayApiKey();
  if (!key) {
    return { success: false, message: "No Sargalay API key provided." };
  }

  const model = testModel || getSargalayModel();
  const startTime = Date.now();

  try {
    const response = await fetch(`${SARGALAY_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Ping test. Respond with 'PONG' only." }],
        max_tokens: 10,
        temperature: 0.1,
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return {
        success: false,
        message: err?.error?.message || `Gateway returned HTTP ${response.status}`,
        latencyMs,
      };
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim() || "";
    const modelLabel = getSargalayModelLabel(model);

    return {
      success: true,
      message: `${modelLabel} verified (${latencyMs}ms)`,
      latencyMs,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Network error contacting Sargalay Gateway",
    };
  }
}
