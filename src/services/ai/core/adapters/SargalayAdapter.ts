/**
 * src/services/ai/core/adapters/SargalayAdapter.ts
 *
 * Cloud OpenAI-compatible Gateway Adapter for Sargalay (https://api.sargalay.com/v1).
 * Supports resilient multi-model failover across Gemini 2.5 Flash, DeepSeek V3, and GPT-4o-mini.
 * Implements the LlmAdapter Seam for FlightSI.
 */

import {
  generateSargalayChatCompletion,
  getSargalayApiKey,
  getSargalayModel,
  getSargalayModelLabel,
  type SargalayChatMessage,
} from "../../sargalayClient.ts";
import type {
  LlmAdapter,
  LlmStructuredParams,
  LlmStructuredResult,
  LlmTextParams,
  LlmTextResult,
} from "../types.ts";

export class SargalayAdapter implements LlmAdapter {
  get id(): string {
    return getSargalayModel();
  }

  get displayName(): string {
    return `${getSargalayModelLabel()} (via Sargalay Gateway)`;
  }

  isReady(): boolean {
    return Boolean(getSargalayApiKey());
  }

  async completeText(params: LlmTextParams): Promise<LlmTextResult> {
    const apiKey = getSargalayApiKey();
    if (!apiKey) {
      throw new Error("No Sargalay API key available.");
    }

    const messages: SargalayChatMessage[] = [];

    if (params.systemInstruction) {
      messages.push({
        role: "system",
        content: params.systemInstruction,
      });
    }

    if (params.history && params.history.length > 0) {
      for (const turn of params.history) {
        if (turn.text && turn.text.trim().length > 0) {
          messages.push({
            role: turn.role === "user" ? "user" : "assistant",
            content: turn.text,
          });
        }
      }
    }

    messages.push({
      role: "user",
      content: params.prompt,
    });

    const result = await generateSargalayChatCompletion({
      messages,
      preferredModel: this.id,
      temperature: params.temperature ?? 0.6,
      maxTokens: params.maxOutputTokens ?? 800,
    });

    return {
      text: result.content,
      provider: `${getSargalayModelLabel(result.modelUsed)} (via Sargalay)`,
      isFallback: result.isFallback,
    };
  }

  async completeStructured<T>(params: LlmStructuredParams<T>): Promise<LlmStructuredResult<T>> {
    const apiKey = getSargalayApiKey();
    if (!apiKey) {
      throw new Error("No Sargalay API key available for structured completion.");
    }

    const systemPrompt = [
      params.systemInstruction || "You are an expert spaceflight clinical triage assistant.",
      "Respond strictly with valid JSON conforming to the requested schema. Do not wrap in markdown or backticks.",
    ].join("\n\n");

    const messages: SargalayChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: params.prompt },
    ];

    const result = await generateSargalayChatCompletion({
      messages,
      preferredModel: this.id,
      temperature: params.temperature ?? 0.2,
      maxTokens: params.maxOutputTokens ?? 1200,
    });

    try {
      let cleaned = result.content.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json\s*/, "").replace(/```$/, "").trim();
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```\s*/, "").replace(/```$/, "").trim();
      }

      const parsed = JSON.parse(cleaned) as T;
      return {
        data: parsed,
        provider: `${getSargalayModelLabel(result.modelUsed)} (via Sargalay)`,
        isFallback: result.isFallback,
      };
    } catch (parseError) {
      console.warn("[SargalayAdapter] JSON parsing failed, raw content:", result.content);
      throw new Error(`Failed to parse structured JSON from Sargalay output: ${parseError}`);
    }
  }
}
