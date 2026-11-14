/**
 * Central Mastra orchestrator for HabiTrack.
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
    "first-responder-agent": firstResponderAgent,
  },
  workflows: {
    clinicalTriage: clinicalTriageWorkflow,
    "clinical-triage-workflow": clinicalTriageWorkflow,
  },
  tools: {
    telemetry: telemetryTool,
    "get-compartment-telemetry": telemetryTool,
    flightRules: flightRulesTool,
    "get-flight-rule": flightRulesTool,
    researchRag: researchRagTool,
    "search-research-rag": researchRagTool,
  },
});
