# SPEC-004: Mastra AI Integration Specification for HABITAT TRACE

## Status: Approved Architecture Specification
## Target Directory: `src/mastra/`
## Framework: Mastra (`@mastra/core` + `zod`)
## Platform: Client-Side TypeScript (Vite + React 18)

---

## 1. Directory & File Map

```
D:\HabiTrack\src\mastra\
├── index.ts                         # Singleton Mastra container (export const mastra)
├── agents\
│   └── firstResponderAgent.ts       # Mastra Agent: Onboard First-Response Co-Pilot
├── workflows\
│   └── clinicalTriageWorkflow.ts   # Mastra Workflow: 5-step deterministic DAG
├── steps\
│   ├── parseSymptomStep.ts          # Step: Compartment detection & symptom parsing
│   ├── correlateTelemetryStep.ts    # Step: 5-factor environmental risk correlation
│   ├── generateInterimActionsStep.ts# Step: 3-step physical stabilization countermeasures
│   ├── epistemicGuardrailStep.ts    # Step: Non-causal phrasing & disclaimer filter
│   └── buildSurgeonPacketStep.ts    # Step: Flight surgeon ground handoff serializer
└── tools\
    ├── telemetryTool.ts             # Tool: Real-time environmental readings
    ├── flightRulesTool.ts           # Tool: NASA Flight Rules lookup (e.g. FR-MED-71-04)
    └── researchRagTool.ts           # Tool: 384-d vector embeddings retrieval
```

---

## 2. Key Responsibilities per Mastra Primitive

- **`createTool`**: Exposes environmental sensor snapshots ($ppCO_2$, temperature, humidity) and NASA flight rule catalog entries to the agent.
- **`createStep`**: Type-safe Zod-validated pipeline steps for symptom classification, environmental correlation, interim physical countermeasure generation, and epistemic guardrails.
- **`createWorkflow`**: Chains the steps into a deterministic DAG (`.step().then().commit()`), ensuring the exact 3 stabilization actions are calculated before the surgeon arrives.
- **`createAgent`**: Natural language conversational assistant configured with the "First-Response Interim Co-Pilot" persona.
- **`Mastra`**: Exported application instance bound to [SymptomChatbotModule.tsx](file:///D:/HabiTrack/src/features/symptoms/SymptomChatbotModule.tsx) and [AssistantDrawer.tsx](file:///D:/HabiTrack/src/components/AssistantDrawer.tsx).
