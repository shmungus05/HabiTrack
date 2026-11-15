/**
 * src/services/ai/core/adapters/GeminiFrontierAdapter.ts
 *
 * Cloud REST Adapter for Google Gemini 2.5 Flash / Flash-Lite models.
 * Implements the LlmAdapter Seam with direct browser-to-cloud execution.
 */

import {
  getGeminiApiKey,
  getGeminiApiUrl,
  getGeminiModel,
  getGeminiModelLabel,
} from "../../geminiClient.ts";
import type {
  LlmAdapter,
  LlmStructuredParams,
  LlmStructuredResult,
  LlmTextParams,
  LlmTextResult,
} from "../types.ts";

export class GeminiFrontierAdapter implements LlmAdapter {
  get id(): string {
    return getGeminiModel();
  }

  get displayName(): string {
    return `${getGeminiModelLabel()} (Direct Browser Execution)`;
  }

  isReady(): boolean {
    return Boolean(getGeminiApiKey());
  }

  async completeText(params: LlmTextParams): Promise<LlmTextResult> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error("No Gemini API key available.");
    }

    const contents = [
      ...(params.history || [])
        .filter((h) => h.text && h.text.trim().length > 0)
        .map((h) => ({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.text }],
        })),
      {
        role: "user",
        parts: [{ text: params.prompt }],
      },
    ];

    const endpoint = getGeminiApiUrl();
    const payload: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: params.temperature ?? 0.6,
        maxOutputTokens: params.maxOutputTokens ?? 800,
      },
    };

    if (params.systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: params.systemInstruction }],
      };
    }

    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(
        errorJson?.error?.message || `Gemini API returned HTTP ${response.status}`
      );
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "No response generated.";

    return {
      text,
      provider: this.displayName,
      isFallback: false,
    };
  }

  async completeStructured<T>(params: LlmStructuredParams<T>): Promise<LlmStructuredResult<T>> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error("No Gemini API key available for structured completion.");
    }

    const endpoint = getGeminiApiUrl();
    const payload: Record<string, unknown> = {
      contents: [
        {
          parts: [{ text: params.prompt }],
        },
      ],
      generationConfig: {
        temperature: params.temperature ?? 0.2,
        maxOutputTokens: params.maxOutputTokens ?? 1000,
        responseMimeType: "application/json",
      },
    };

    if (params.systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: params.systemInstruction }],
      };
    }

    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(
        errorJson?.error?.message || `Gemini API returned HTTP ${response.status}`
      );
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!rawText) {
      throw new Error("Empty structured response from Gemini API.");
    }

    const parsed = JSON.parse(rawText) as T;
    return {
      data: parsed,
      provider: this.displayName,
      isFallback: false,
    };
  }
}
