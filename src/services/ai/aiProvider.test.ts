import { generateUnifiedRagResponse } from "./aiProvider.ts";
import { isLocalModelReady } from "./localModelService.ts";
import type { CitedEvidence } from "../../types/api.ts";

let assertions = 0;

function check(condition: boolean, message: string): void {
  assertions += 1;
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests(): Promise<void> {
  console.log("Running aiProvider unified dispatcher tests...");

  // Test 1: Local mode when unloaded falls back gracefully to deterministic synthesis
  check(isLocalModelReady() === false, "Local model should not be initialized in Node test runner");

  const sampleEvidence: CitedEvidence[] = [
    {
      chunk_id: "test-c1",
      doc_id: "NASA-TM-2021-01",
      title: "ECLSS Study",
      authors: "NASA Life Sciences",
      report_identifier: "TM-2021-01",
      section_heading: "Hypercapnia & Headaches",
      excerpt: "Elevated ppCO2 above 4.0 mmHg is temporally associated with cephalic congestion.",
      doi_citation: null,
      source_repository: "NASA HRP",
      rrf_score: 0.95,
      relevance_pct: 95,
    },
  ];

  const localFallbackResult = await generateUnifiedRagResponse({
    mode: "local",
    userQuery: "What are the effects of high cabin CO2?",
    evidence: sampleEvidence,
  });

  check(localFallbackResult.isFallback, "Should be marked as fallback when model is not loaded");
  check(
    localFallbackResult.answer.includes("Hypercapnia & Headaches"),
    "Fallback response should contain extractive evidence"
  );
  check(
    localFallbackResult.provider.includes("Mastra Onboard First-Response Engine"),
    "Should identify Mastra engine as provider"
  );
  console.log("[PASS] Test 1 passed: Local mode graceful fallback");

  // Test 2: Frontier mode response or graceful fallback
  const frontierResult = await generateUnifiedRagResponse({
    mode: "frontier",
    userQuery: "Hello assistant",
    evidence: [],
  });

  check(
    Boolean(frontierResult.answer && frontierResult.answer.length > 0),
    "Frontier mode should produce a non-empty response"
  );
  check(
    frontierResult.answer.includes("HabiTrack") ||
      frontierResult.provider.includes("Sargalay") ||
      frontierResult.provider.includes("Gemini"),
    "Should provide standard welcome greeting or AI response"
  );
  console.log(`[PASS] Test 2 passed: Frontier mode dispatch verified (${frontierResult.provider})`);

  console.log(`\nPASS · ${assertions} assertions · SI provider unified dispatcher (Frontier vs Local)`);
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  throw err;
});
