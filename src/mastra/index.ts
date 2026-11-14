/**
 * Central Mastra orchestrator for WAYFINDER V3.
 * 100% Pure TypeScript, zero-backend, browser-native agent & workflow engine.
 */

import { Mastra } from "./core";
import { firstResponderAgent } from "./agents/firstResponderAgent";
import { clinicalTriageWorkflow } from "./workflows/clinicalTriageWorkflow";
import { telemetryTool } from "./tools/telemetryTool";
import { flightRulesTool } from "./tools/flightRulesTool";
import { researchRagTool } from "./tools/researchRagTool";

export * from "./core";
export * from "./tools/telemetryTool";
export * from "./tools/flightRulesTool";
export * from "./tools/researchRagTool";
export * from "./workflows/clinicalTriageWorkflow";
export * from "./agents/firstResponderAgent";

export const mastra = new Mastra({
  agents: {
    firstResponder: firstResponderAgent,
  },
  workflows: {
    clinicalTriage: clinicalTriageWorkflow,
  },
  tools: {
    telemetry: telemetryTool,
    flightRules: flightRulesTool,
    researchRag: researchRagTool,
  },
});
