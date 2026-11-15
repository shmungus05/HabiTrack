/**
 * src/services/ai/ollamaClient.ts
 *
 * Client for local Ollama station bridge (defaulting to http://127.0.0.1:11434).
 * Supports zero-cloud offline clinical decision support, active model probing,
 * and seamless fallback across local models (qwen2.5:7b, tommy:latest, llama3.2, etc.).
 */

export interface OllamaModelDetail {
  name: string;
  size: number;
  parameterSize?: string;
  quantization?: string;
}

export interface OllamaStatusResult {
  online: boolean;
  endpoint: string;
  models: OllamaModelDetail[];
  activeModel: string | null;
  error?: string;
}

export interface OllamaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaChatCompletionParams {
  messages: OllamaChatMessage[];
  model?: string;
  format?: "json";
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface OllamaChatCompletionResult {
  content: string;
  modelUsed: string;
  latencyMs: number;
}

const OLLAMA_PROBE_ENDPOINTS = [
  "/api/ollama", // Vite proxy endpoint (safe for browser CORS)
  "http://127.0.0.1:11434",
  "http://localhost:11434",
];

let cachedWorkingEndpoint: string | null = null;
let cachedActiveModel: string = "qwen2.5:7b";

/**
 * Discovers and returns the working Ollama endpoint.
 */
export async function getWorkingOllamaEndpoint(): Promise<string | null> {
  if (cachedWorkingEndpoint) {
    try {
      const res = await fetch(`${cachedWorkingEndpoint}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) return cachedWorkingEndpoint;
    } catch {
      cachedWorkingEndpoint = null;
    }
  }

  for (const ep of OLLAMA_PROBE_ENDPOINTS) {
    try {
      const res = await fetch(`${ep}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        cachedWorkingEndpoint = ep;
        return ep;
      }
    } catch {
      // Continue probe
    }
  }

  return null;
}

/**
 * Checks current Ollama daemon health and queries installed local models.
 */
export async function checkOllamaStatus(): Promise<OllamaStatusResult> {
  const endpoint = await getWorkingOllamaEndpoint();
  if (!endpoint) {
    return {
      online: false,
      endpoint: "http://127.0.0.1:11434",
      models: [],
      activeModel: null,
      error: "Ollama daemon unreachable on port 11434.",
    };
  }

  try {
    const res = await fetch(`${endpoint}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(2500),
    });

    if (!res.ok) {
      return {
        online: false,
        endpoint,
        models: [],
        activeModel: null,
        error: `Ollama returned HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as {
      models?: Array<{
        name: string;
        size: number;
        details?: { parameter_size?: string; quantization_level?: string };
      }>;
    };

    const models: OllamaModelDetail[] = (data.models || []).map((m) => ({
      name: m.name,
      size: m.size,
      parameterSize: m.details?.parameter_size,
      quantization: m.details?.quantization_level,
    }));

    if (models.length > 0) {
      // Retain previous active model if still present, otherwise choose first
      if (!models.some((m) => m.name === cachedActiveModel)) {
        cachedActiveModel = models[0].name;
      }
    }

    return {
      online: true,
      endpoint,
      models,
      activeModel: cachedActiveModel,
    };
  } catch (err) {
    return {
      online: false,
      endpoint,
      models: [],
      activeModel: null,
      error: err instanceof Error ? err.message : "Failed to query Ollama tags",
    };
  }
}

/**
 * Explicitly sets or loads the active Ollama model.
 */
export async function loadOllamaModel(
  modelName?: string
): Promise<{ success: boolean; model: string; message: string; latencyMs: number }> {
  const start = Date.now();
  const status = await checkOllamaStatus();

  if (!status.online) {
    return {
      success: false,
      model: modelName || cachedActiveModel,
      message: "Cannot connect to local Ollama. Please ensure 'ollama serve' is running.",
      latencyMs: Date.now() - start,
    };
  }

  const targetModel =
    modelName ||
    status.activeModel ||
    (status.models.length > 0 ? status.models[0].name : "qwen2.5:7b");

  cachedActiveModel = targetModel;

  // Warm up / verify model by sending a lightweight prompt
  try {
    const endpoint = status.endpoint;
    const res = await fetch(`${endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: targetModel,
        messages: [{ role: "user", content: "ping" }],
        stream: false,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return {
        success: false,
        model: targetModel,
        message: `Model '${targetModel}' responded with HTTP ${res.status}`,
        latencyMs: Date.now() - start,
      };
    }

    return {
      success: true,
      model: targetModel,
      message: `Model '${targetModel}' successfully loaded into VRAM. Ready for offline inference.`,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      model: targetModel,
      message: err instanceof Error ? err.message : "Model warmup request timed out",
      latencyMs: Date.now() - start,
    };
  }
}

export function getActiveOllamaModel(): string {
  return cachedActiveModel;
}

export function setActiveOllamaModel(model: string): void {
  cachedActiveModel = model;
}

/**
 * Executes a chat completion query against local Ollama.
 */
export async function generateOllamaChatCompletion(
  params: OllamaChatCompletionParams
): Promise<OllamaChatCompletionResult> {
  const start = Date.now();
  const endpoint = await getWorkingOllamaEndpoint();

  if (!endpoint) {
    throw new Error("Local Ollama is offline or unreachable on port 11434.");
  }

  const model = params.model || cachedActiveModel || "qwen2.5:7b";

  const requestBody: Record<string, unknown> = {
    model,
    messages: params.messages,
    stream: false,
    options: {
      temperature: params.temperature ?? 0.3,
      num_predict: params.maxTokens ?? 1024,
    },
  };

  if (params.format === "json") {
    requestBody.format = "json";
  }

  const timeoutMs = params.timeoutMs ?? 20000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Ollama error HTTP ${res.status}: ${errText || res.statusText}`);
    }

    const data = (await res.json()) as {
      message?: { content: string };
      done?: boolean;
    };

    const content = data.message?.content?.trim() || "";
    if (!content) {
      throw new Error("Ollama returned an empty response.");
    }

    return {
      content,
      modelUsed: model,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}
