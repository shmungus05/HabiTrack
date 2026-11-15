/**
 * src/services/ai/core/adapters/OllamaAdapter.ts
 *
 * Local Ollama Adapter connecting directly to local station bridge (port 11434).
 * Delivers zero-latency, 100% air-gapped offline clinical reasoning.
 * Implements the LlmAdapter Seam for FlightSI.
 */

import {
  generateOllamaChatCompletion,
  getActiveOllamaModel,
  type OllamaChatMessage,
} from "../../ollamaClient.ts";
import type {
  LlmAdapter,
  LlmStructuredParams,
  LlmStructuredResult,
  LlmTextParams,
  LlmTextResult,
} from "../types.ts";

export class OllamaAdapter implements LlmAdapter {
  private customModel?: string;

  constructor(customModel?: string) {
    this.customModel = customModel;
  }

  get id(): string {
    return this.customModel || getActiveOllamaModel() || "qwen2.5:7b";
  }

  get displayName(): string {
    return `Ollama Local (${this.id})`;
  }

  isReady(): boolean {
    return true;
  }

  async completeText(params: LlmTextParams): Promise<LlmTextResult> {
    const messages: OllamaChatMessage[] = [];

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

    const result = await generateOllamaChatCompletion({
      messages,
      model: this.id,
      temperature: params.temperature ?? 0.3,
      maxTokens: params.maxOutputTokens ?? 1024,
    });

    return {
      text: result.content,
      provider: `Ollama Local (${result.modelUsed})`,
      isFallback: false,
    };
  }

  async completeStructured<T>(params: LlmStructuredParams<T>): Promise<LlmStructuredResult<T>> {
    const systemPrompt = [
      params.systemInstruction || "You are an expert spaceflight clinical triage assistant.",
      "Respond strictly with valid JSON conforming to the requested schema. Do not include markdown codeblocks or conversational text.",
    ].join("\n\n");

    const messages: OllamaChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: params.prompt },
    ];

    const result = await generateOllamaChatCompletion({
      messages,
      model: this.id,
      format: "json",
      temperature: params.temperature ?? 0.1,
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
        provider: `Ollama Local (${result.modelUsed})`,
        isFallback: false,
      };
    } catch (parseError) {
      console.warn("[OllamaAdapter] JSON parsing failed, raw content:", result.content);
      throw new Error(`Failed to parse structured JSON from Ollama output: ${parseError}`);
    }
  }
}
