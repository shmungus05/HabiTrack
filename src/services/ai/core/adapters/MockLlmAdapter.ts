/**
 * src/services/ai/core/adapters/MockLlmAdapter.ts
 *
 * Deterministic in-memory Mock Adapter for zero-network test durability.
 * Provides configurable response hooks and records all prompts and instructions.
 */

import type {
  LlmAdapter,
  LlmStructuredParams,
  LlmStructuredResult,
  LlmTextParams,
  LlmTextResult,
} from "../types.ts";

export interface MockRecordedCall {
  method: "completeText" | "completeStructured";
  params: unknown;
  timestamp: number;
}

export class MockLlmAdapter implements LlmAdapter {
  readonly id = "mock";
  readonly displayName = "Mock Test LLM (In-Memory)";
  ready = true;

  calls: MockRecordedCall[] = [];
  mockTextHandler?: (params: LlmTextParams) => string | Promise<string>;
  mockStructuredHandler?: <T>(params: LlmStructuredParams<T>) => T | Promise<T>;

  isReady(): boolean {
    return this.ready;
  }

  setReady(isReady: boolean): void {
    this.ready = isReady;
  }

  async completeText(params: LlmTextParams): Promise<LlmTextResult> {
    this.calls.push({ method: "completeText", params, timestamp: Date.now() });

    if (!this.ready) {
      throw new Error("MockLlmAdapter is currently marked as unready.");
    }

    if (this.mockTextHandler) {
      const custom = await this.mockTextHandler(params);
      return {
        text: custom,
        provider: this.displayName,
        isFallback: false,
      };
    }

    // Default realistic mock response
    return {
      text: `Mocked response for: "${params.prompt.slice(0, 60)}"`,
      provider: this.displayName,
      isFallback: false,
    };
  }

  async completeStructured<T>(params: LlmStructuredParams<T>): Promise<LlmStructuredResult<T>> {
    this.calls.push({ method: "completeStructured", params, timestamp: Date.now() });

    if (!this.ready) {
      throw new Error("MockLlmAdapter is currently marked as unready.");
    }

    if (this.mockStructuredHandler) {
      const custom = await this.mockStructuredHandler<T>(params);
      return {
        data: custom,
        provider: this.displayName,
        isFallback: false,
      };
    }

    // If no custom handler is registered, provide a fallback structured response
    return {
      data: {} as T,
      provider: this.displayName,
      isFallback: false,
    };
  }

  reset(): void {
    this.calls = [];
    this.ready = true;
    this.mockTextHandler = undefined;
    this.mockStructuredHandler = undefined;
  }
}
