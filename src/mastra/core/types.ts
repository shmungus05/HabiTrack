/**
 * Core type definitions for browser-native Mastra orchestration.
 * Mirrors @mastra/core contracts using Zod schemas for 100% client-side execution.
 */

import type { z } from "zod";

export interface ExecutionContext<TContext = any> {
  context: TContext;
  mastra?: any;
}

export interface MastraToolConfig<TInput extends z.ZodTypeAny = z.ZodTypeAny, TOutput extends z.ZodTypeAny = z.ZodTypeAny> {
  id: string;
  description: string;
  inputSchema: TInput;
  outputSchema?: TOutput;
  execute: (params: ExecutionContext<z.infer<TInput>>) => Promise<z.infer<TOutput>> | z.infer<TOutput>;
}

export interface MastraTool<TInput extends z.ZodTypeAny = z.ZodTypeAny, TOutput extends z.ZodTypeAny = z.ZodTypeAny> {
  id: string;
  description: string;
  inputSchema: TInput;
  outputSchema?: TOutput;
  execute: (params: ExecutionContext<z.infer<TInput>>) => Promise<z.infer<TOutput>>;
}

export interface MastraStepConfig<TInput extends z.ZodTypeAny = z.ZodTypeAny, TOutput extends z.ZodTypeAny = z.ZodTypeAny> {
  id: string;
  inputSchema?: TInput;
  outputSchema?: TOutput;
  execute: (params: ExecutionContext<z.infer<TInput>>) => Promise<z.infer<TOutput>> | z.infer<TOutput>;
}

export interface MastraStep<TInput extends z.ZodTypeAny = z.ZodTypeAny, TOutput extends z.ZodTypeAny = z.ZodTypeAny> {
  id: string;
  inputSchema?: TInput;
  outputSchema?: TOutput;
  execute: (params: ExecutionContext<z.infer<TInput>>) => Promise<z.infer<TOutput>>;
}

export interface MastraWorkflowConfig<TInput extends z.ZodTypeAny = z.ZodTypeAny, TOutput extends z.ZodTypeAny = z.ZodTypeAny> {
  id: string;
  inputSchema?: TInput;
  outputSchema?: TOutput;
}

export interface MastraAgentConfig {
  name: string;
  instructions: string;
  tools?: Record<string, MastraTool>;
  modelName?: string;
}
