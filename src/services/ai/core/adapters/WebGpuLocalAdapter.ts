/**
 * src/services/ai/core/adapters/WebGpuLocalAdapter.ts
 *
 * In-browser WebGPU Adapter executing Llama-3.2-1B-Instruct via @mlc-ai/web-llm.
 * Implements the LlmAdapter Seam for 100% offline, serverless client-side SI.
 */

import {
  isLocalModelReady,
  generateLocalRagResponse,
  generateLocalClinicalTriage,
  LOCAL_MODEL_DISPLAY_NAME,
} from "../../localModelService.ts";
import type {
  LlmAdapter,
  LlmStructuredParams,
  LlmStructuredResult,
  LlmTextParams,
  LlmTextResult,
} from "../types.ts";

export class WebGpuLocalAdapter implements LlmAdapter {
  readonly id = "local-webgpu";
  readonly displayName = `${LOCAL_MODEL_DISPLAY_NAME} (Offline WebGPU)`;

  isReady(): boolean {
    return isLocalModelReady();
  }

  async completeText(params: LlmTextParams): Promise<LlmTextResult> {
    if (!this.isReady()) {
      throw new Error("WebGPU local model is not initialized or still loading.");
    }

    const historyTurns = (params.history || []).map((h) => ({
      role: (h.role === "user" ? "user" : "model") as "user" | "model",
      text: h.text,
    }));

    const result = await generateLocalRagResponse(
      params.prompt,
      [],
      null,
      historyTurns,
      null
    );

    return {
      text: result.answer,
      provider: this.displayName,
      isFallback: false,
    };
  }

  async completeStructured<T>(params: LlmStructuredParams<T>): Promise<LlmStructuredResult<T>> {
    if (!this.isReady()) {
      throw new Error("WebGPU local model is not initialized or still loading.");
    }

    // If clinical triage structured payload is requested:
    const triageData = await generateLocalClinicalTriage({
      symptomText: params.prompt,
      compartmentName: "ISS Habitat",
      snapshot: {
        co2Ppm: 2400,
        tempC: 22.5,
        humidityPct: 45,
        radiationRateMGy: 0.35,
        pressureMmHg: 760,
      },
    });

    return {
      data: triageData as unknown as T,
      provider: this.displayName,
      isFallback: false,
    };
  }
}
