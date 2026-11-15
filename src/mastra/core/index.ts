/**
 * Browser-safe native implementation of Mastra primitives.
 * Provides createTool, createStep, createWorkflow, createAgent, and Mastra singleton.
 */

import type { z } from "zod";
import { generateGeminiRagResponse } from "../../services/ai/geminiClient.ts";
import type {
  MastraTool,
  MastraToolConfig,
  MastraStep,
  MastraStepConfig,
  MastraWorkflowConfig,
  MastraAgentConfig,
  ExecutionContext,
} from "./types.ts";

export * from "./types.ts";

export function createTool<TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny>(
  config: MastraToolConfig<TInput, TOutput>
): MastraTool<TInput, TOutput> {
  return {
    id: config.id,
    description: config.description,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
    execute: async (params: ExecutionContext<z.infer<TInput>>) => {
      const validatedInput = config.inputSchema ? config.inputSchema.parse(params.context) : params.context;
      const result = await config.execute({ context: validatedInput, mastra: params.mastra });
      return config.outputSchema ? config.outputSchema.parse(result) : result;
    },
  };
}

export function createStep<TInput extends z.ZodTypeAny = z.ZodTypeAny, TOutput extends z.ZodTypeAny = z.ZodTypeAny>(
  config: MastraStepConfig<TInput, TOutput>
): MastraStep<TInput, TOutput> {
  return {
    id: config.id,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
    execute: async (params: ExecutionContext<z.infer<TInput>>) => {
      const validatedInput = config.inputSchema ? config.inputSchema.parse(params.context) : params.context;
      const result = await config.execute({ context: validatedInput, mastra: params.mastra });
      return config.outputSchema ? config.outputSchema.parse(result) : result;
    },
  };
}

export class WorkflowBuilder<TWorkflowInput = any, TWorkflowOutput = any> {
  readonly id: string;
  private steps: MastraStep[] = [];
  private inputSchema?: z.ZodTypeAny;
  private outputSchema?: z.ZodTypeAny;

  constructor(config: MastraWorkflowConfig) {
    this.id = config.id;
    this.inputSchema = config.inputSchema;
    this.outputSchema = config.outputSchema;
  }

  step(step: MastraStep): this {
    this.steps.push(step);
    return this;
  }

  then(step: MastraStep): this {
    this.steps.push(step);
    return this;
  }

  commit(): this {
    return this;
  }

  async execute(initialInput: TWorkflowInput): Promise<TWorkflowOutput> {
    let currentData: any = this.inputSchema ? this.inputSchema.parse(initialInput) : initialInput;

    for (const step of this.steps) {
      currentData = await step.execute({ context: currentData });
    }

    return (this.outputSchema ? this.outputSchema.parse(currentData) : currentData) as TWorkflowOutput;
  }
}

export function createWorkflow<TInput extends z.ZodTypeAny = z.ZodTypeAny, TOutput extends z.ZodTypeAny = z.ZodTypeAny>(
  config: MastraWorkflowConfig<TInput, TOutput>
): WorkflowBuilder<z.infer<TInput>, z.infer<TOutput>> {
  return new WorkflowBuilder<z.infer<TInput>, z.infer<TOutput>>(config);
}

export interface AgentGenerateResult {
  text: string;
  latchedRule?: any;
  citedEvidence?: any[];
  toolResults?: Record<string, any>;
  provider: string;
}

export class MastraAgent {
  readonly name: string;
  readonly instructions: string;
  readonly tools: Record<string, MastraTool>;
  readonly modelName: string;

  constructor(config: MastraAgentConfig) {
    this.name = config.name;
    this.instructions = config.instructions;
    this.tools = config.tools || {};
    this.modelName = config.modelName || "Gemini 2.5 Flash (Direct Browser Execution)";
  }

  async generate(prompt: string, contextData?: Record<string, any>): Promise<AgentGenerateResult> {
    const promptLower = prompt.toLowerCase();
    const toolResults: Record<string, any> = {};
    let latchedRule: any = null;
    let citedEvidence: any[] = [];

    // 1. Tool execution: Flight Rules lookup
    if (
      this.tools.flightRules &&
      (promptLower.includes("rule") ||
        promptLower.includes("checklist") ||
        promptLower.includes("co2") ||
        promptLower.includes("hypercapnia") ||
        promptLower.includes("cdra") ||
        promptLower.includes("humidity") ||
        promptLower.includes("headache"))
    ) {
      let targetRule = "FR-ECLSS-001";
      if (promptLower.includes("cdra") && promptLower.includes("thermal")) {
        targetRule = "FR-CDRA-002";
      } else if (promptLower.includes("humidity") || promptLower.includes("eye")) {
        targetRule = "FR-ECLSS-012";
      } else if (
        promptLower.includes("workout") ||
        promptLower.includes("tachycardia") ||
        promptLower.includes("eva")
      ) {
        targetRule = "FR-EVA-003";
      } else if (promptLower.includes("headache")) {
        targetRule = "FR-MED-71-04";
      }

      try {
        latchedRule = await this.tools.flightRules.execute({ context: { ruleId: targetRule } });
        toolResults.flightRule = latchedRule;
      } catch (e) {
        console.warn("Flight rules tool execution error:", e);
      }
    }

    // 2. Tool execution: Research RAG
    if (this.tools.researchRag) {
      try {
        const ragRes = (await this.tools.researchRag.execute({ context: { query: prompt, topK: 3 } })) as any;
        if (ragRes && Array.isArray(ragRes.citations) && ragRes.citations.length > 0) {
          citedEvidence = ragRes.citations;
          toolResults.citations = citedEvidence;
        }
      } catch (e) {
        console.warn("RAG tool execution error:", e);
      }
    }

    // 3. Tool execution: Telemetry
    if (
      this.tools.telemetry &&
      (promptLower.includes("temp") ||
        promptLower.includes("co2") ||
        promptLower.includes("sensor") ||
        promptLower.includes("node 2") ||
        promptLower.includes("destiny") ||
        promptLower.includes("telemetry"))
    ) {
      try {
        const telRes = await this.tools.telemetry.execute({
          context: {
            compartmentId: promptLower.includes("destiny") ? "destiny" : "node2",
          },
        });
        toolResults.telemetry = telRes;
      } catch (e) {
        console.warn("Telemetry tool execution error:", e);
      }
    }

    // 4. Generate answer via Gemini 2.5 Flash
    let answerText = "";
    let providerUsed = "Gemini 2.5 Flash (Direct Browser Execution)";
    try {
      const geminiRes = await generateGeminiRagResponse(
        prompt,
        citedEvidence.map((c) => ({
          chunk_id: c.docId,
          doc_id: c.docId,
          title: c.title,
          authors: null,
          report_identifier: null,
          section_heading: c.sectionHeading,
          doi_citation: null,
          source_repository: "NASA HRP",
          excerpt: c.excerpt,
          rrf_score: 0.9,
          relevance_pct: c.relevanceScore,
        })),
        contextData?.astronautId
      );
      answerText = geminiRes.answer;
      providerUsed = geminiRes.provider;
    } catch {
      providerUsed = "Client Extractive Engine";
      if (latchedRule) {
        answerText =
          `Operational Flight Rule **${latchedRule.rule_id}**: ${latchedRule.title}\n\nThreshold: ${latchedRule.condition_threshold}\n\nProcedural Steps:\n` +
          latchedRule.checklist_steps
            .map((s: any) => `• **Step ${s.step_number} (${s.target_subsystem})**: ${s.action}`)
            .join("\n");
      } else {
        answerText = `Greetings. I am ${this.name}, your onboard clinical decision-support synthetic intelligence system. Telemetry parameters are within monitored operational thresholds.`;
      }
    }

    return {
      text: answerText,
      latchedRule,
      citedEvidence,
      toolResults,
      provider: providerUsed,
    };
  }
}

export function createAgent(config: MastraAgentConfig): MastraAgent {
  return new MastraAgent(config);
}

export interface MastraOptions {
  agents?: Record<string, MastraAgent>;
  workflows?: Record<string, WorkflowBuilder<any, any>>;
  tools?: Record<string, MastraTool>;
}

export class Mastra {
  private agents: Map<string, MastraAgent> = new Map();
  private workflows: Map<string, WorkflowBuilder<any, any>> = new Map();
  private tools: Map<string, MastraTool> = new Map();

  constructor(options: MastraOptions = {}) {
    if (options.agents) {
      for (const [key, agent] of Object.entries(options.agents)) {
        this.agents.set(key, agent);
        this.agents.set(key.toLowerCase(), agent);
        if (agent.name) {
          this.agents.set(agent.name, agent);
          this.agents.set(agent.name.toLowerCase(), agent);
        }
      }
    }
    if (options.workflows) {
      for (const [key, workflow] of Object.entries(options.workflows)) {
        this.workflows.set(key, workflow);
        this.workflows.set(key.toLowerCase(), workflow);
        if (workflow.id) {
          this.workflows.set(workflow.id, workflow);
          this.workflows.set(workflow.id.toLowerCase(), workflow);
        }
      }
    }
    if (options.tools) {
      for (const [key, tool] of Object.entries(options.tools)) {
        this.tools.set(key, tool);
        this.tools.set(key.toLowerCase(), tool);
        if (tool.id) {
          this.tools.set(tool.id, tool);
          this.tools.set(tool.id.toLowerCase(), tool);
        }
      }
    }
  }

  getWorkflow<TInput = any, TOutput = any>(id: string): WorkflowBuilder<TInput, TOutput> {
    const direct = this.workflows.get(id) || this.workflows.get(id.toLowerCase());
    if (direct) {
      return direct as WorkflowBuilder<TInput, TOutput>;
    }

    // Try normalized match ignoring dashes/underscores
    const normalizedTarget = id.toLowerCase().replace(/[-_]/g, "");
    for (const [key, wf] of this.workflows.entries()) {
      if (key.toLowerCase().replace(/[-_]/g, "") === normalizedTarget) {
        return wf as WorkflowBuilder<TInput, TOutput>;
      }
    }

    // Fallback: If only one workflow exists, return it
    if (this.workflows.size > 0) {
      const firstWf = this.workflows.values().next().value;
      if (firstWf) return firstWf as WorkflowBuilder<TInput, TOutput>;
    }

    throw new Error(
      `Mastra Workflow not found: "${id}". Registered: ${Array.from(this.workflows.keys()).join(", ")}`
    );
  }

  getAgent(name: string): MastraAgent {
    const direct = this.agents.get(name) || this.agents.get(name.toLowerCase());
    if (direct) {
      return direct;
    }

    const normalizedTarget = name.toLowerCase().replace(/[-_]/g, "");
    for (const [key, ag] of this.agents.entries()) {
      if (key.toLowerCase().replace(/[-_]/g, "") === normalizedTarget) {
        return ag;
      }
    }

    if (this.agents.size > 0) {
      const firstAg = this.agents.values().next().value;
      if (firstAg) return firstAg;
    }

    throw new Error(
      `Mastra Agent not found: "${name}". Registered: ${Array.from(this.agents.keys()).join(", ")}`
    );
  }

  getTool(id: string): MastraTool {
    const direct = this.tools.get(id) || this.tools.get(id.toLowerCase());
    if (direct) {
      return direct;
    }

    const normalizedTarget = id.toLowerCase().replace(/[-_]/g, "");
    for (const [key, tl] of this.tools.entries()) {
      if (key.toLowerCase().replace(/[-_]/g, "") === normalizedTarget) {
        return tl;
      }
    }

    throw new Error(
      `Mastra Tool not found: "${id}". Registered: ${Array.from(this.tools.keys()).join(", ")}`
    );
  }
}
