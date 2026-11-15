/**
 * src/services/ai/core/flightSI.test.ts
 *
 * Comprehensive, zero-network test suite for the Deep FlightSI Module.
 * Tests seam adapters, intent classification, 5-factor triage, epistemic guardrails,
 * and multi-turn context retention using MockLlmAdapter.
 */

import { MockLlmAdapter } from "./adapters/MockLlmAdapter.ts";
import { ExtractiveFallbackAdapter } from "./adapters/ExtractiveFallbackAdapter.ts";
import {
  FlightSIImpl,
  MANDATORY_EPISTEMIC_DISCLAIMER,
  searchResearchChunks,
} from "./FlightSI.ts";
import type { ShiftHandoverBriefing } from "../../../features/handover/types.ts";

let assertions = 0;

function check(condition: boolean, message: string): void {
  assertions += 1;
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function equal<T>(actual: T, expected: T, message: string): void {
  check(
    actual === expected,
    `${message} (expected "${String(expected)}", received "${String(actual)}")`
  );
}

async function runAllTests(): Promise<void> {
  console.log("Starting FlightSI Deep Module test suite...");

  // ---------------------------------------------------------------------------
  // Test 1: Intent Classification
  // ---------------------------------------------------------------------------
  const flightSi = new FlightSIImpl(new ExtractiveFallbackAdapter());

  equal(
    flightSi.classifyIntent("How do I perform deadlifts on ARED?"),
    "exercise_guidance",
    "Should identify exercise guidance intent"
  );

  equal(
    flightSi.classifyIntent("I am having trouble sleeping in my crew bunk"),
    "sleep_guidance",
    "Should identify sleep guidance intent"
  );

  equal(
    flightSi.classifyIntent("Crew morale check: feeling anxious and stressed today"),
    "mental_wellbeing",
    "Should identify mental wellbeing intent"
  );

  equal(
    flightSi.classifyIntent("I have a dull frontal headache and itchy eyes"),
    "health_concern",
    "Should identify health concern intent"
  );

  equal(
    flightSi.classifyIntent("Where are the food rations and hygiene kits stored?"),
    "daily_living",
    "Should identify daily living intent"
  );

  equal(
    flightSi.classifyIntent("What is the inclination angle of the ISS orbit?"),
    "general_question",
    "Should identify general question intent"
  );

  console.log("[PASS] Test 1: Intent classification verified across all 6 categories.");

  // ---------------------------------------------------------------------------
  // Test 2: Compartment Detection
  // ---------------------------------------------------------------------------
  equal(
    flightSi.detectCompartment("Working at the science rack in US Lab Destiny").id,
    "destiny",
    "Should detect US Lab Destiny"
  );

  equal(
    flightSi.detectCompartment("Resting in Node 2 Harmony crew quarters").id,
    "node2",
    "Should detect Node 2 Harmony"
  );

  equal(
    flightSi.detectCompartment("Inspecting ESA payloads in Columbus").id,
    "columbus",
    "Should detect Columbus module"
  );

  equal(
    flightSi.detectCompartment("Taking earth observation photos from Cupola").id,
    "cupola",
    "Should detect Cupola"
  );

  equal(
    flightSi.detectCompartment("General query with manual override", "Columbus Orbital Facility").name,
    "Columbus Orbital Facility",
    "Should respect manual compartment override"
  );

  console.log("[PASS] Test 2: Spacecraft compartment detection verified.");

  // ---------------------------------------------------------------------------
  // Test 3: Symptom Category Classification
  // ---------------------------------------------------------------------------
  equal(
    flightSi.classifySymptomCategory("Throbbing headache and elevated cabin CO2"),
    "HEADACHE_HYPERCAPNIA",
    "Should detect hypercapnic headache"
  );

  equal(
    flightSi.classifySymptomCategory("Delayed onset muscle soreness (DOMS) after ARED squats"),
    "MUSCLE_SORENESS",
    "Should detect muscle soreness"
  );

  equal(
    flightSi.classifySymptomCategory("Frequent awakenings and insomnia in sleep station"),
    "SLEEP_DISTURBANCE",
    "Should detect sleep disturbance"
  );

  equal(
    flightSi.classifySymptomCategory("Dry stinging eye sensation from ventilation vent"),
    "OCULAR_IRRITATION",
    "Should detect ocular irritation"
  );

  equal(
    flightSi.classifySymptomCategory("Feeling overheated with persistent sweat sheeting"),
    "THERMAL_EXERTION",
    "Should detect thermal exertion"
  );

  equal(
    flightSi.classifySymptomCategory("Dizziness, nausea, and motion sickness during adaptation"),
    "NEUROVESTIBULAR_DIZZINESS",
    "Should detect neurovestibular dizziness"
  );

  equal(
    flightSi.classifySymptomCategory("CRITICAL: sudden chest pain and cannot breathe"),
    "CRITICAL_EMERGENCY",
    "Should detect critical emergency"
  );

  console.log("[PASS] Test 3: Symptom category classification verified.");

  // ---------------------------------------------------------------------------
  // Test 4: Clinical Triage Execution & Countermeasures (Deterministic Seam)
  // ---------------------------------------------------------------------------
  const triageRes = await flightSi.triageSymptom({
    symptomText: "Mild throbbing headache in Node 2 after 2 hours of rack maintenance",
    astronautId: "ASTRO-01",
    snapshot: {
      co2Ppm: 3450,
      tempC: 23.1,
      humidityPct: 42,
      radiationRateMGy: 0.38,
      pressureMmHg: 758,
    },
  });

  equal(triageRes.latchedRuleId, "FR-ECLSS-001", "Should latch FR-ECLSS-001 for CO2 headache");
  equal(triageRes.compartmentId, "node2", "Should detect Node 2 compartment");
  equal(triageRes.interimActions.length, 3, "Must produce exactly 3 interim stabilization actions");
  check(triageRes.interimActions[0].action.length > 10, "Action 1 must contain actionable instructions");
  check(triageRes.interimActions[1].action.includes("water") || triageRes.interimActions[1].action.includes("Hydrate"), "Action 2 should address hydration/venous return");
  equal(triageRes.surgeonHandoffPacket.astronautId, "ASTRO-01", "Handoff packet must contain astronaut ID");
  equal(triageRes.symptomConsent.status, "PENDING", "Symptom consent must be initially PENDING");
  equal(triageRes.disclaimer, MANDATORY_EPISTEMIC_DISCLAIMER, "Must attach mandatory disclaimer");

  console.log("[PASS] Test 4: Clinical triage execution and countermeasure generation verified.");

  // ---------------------------------------------------------------------------
  // Test 5: Epistemic Guardrail Sanitizer
  // ---------------------------------------------------------------------------
  const dirtyText = "High CO2 causes acute headache and proves that we must prescribe medication to cure it.";
  const { text: cleanText, tripwireTriggered } = flightSi.sanitizeEpistemicGuardrails(dirtyText);

  check(tripwireTriggered, "Should flag tripwire for prohibited causal language");
  check(!cleanText.includes("causes"), "Prohibited word 'causes' must be replaced");
  check(!cleanText.includes("proves"), "Prohibited word 'proves' must be replaced");
  check(!cleanText.includes("prescribe"), "Prohibited word 'prescribe' must be replaced");
  check(!cleanText.includes("cure"), "Prohibited word 'cure' must be replaced");
  check(cleanText.includes("[temporally correlated with]"), "Replacement token must be inserted");

  console.log("[PASS] Test 5: Epistemic guardrail sanitizer properly replaces prohibited causal terms.");

  // ---------------------------------------------------------------------------
  // Test 6: MockLlmAdapter Injection & Multi-Turn Memory
  // ---------------------------------------------------------------------------
  const mockAdapter = new MockLlmAdapter();
  mockAdapter.mockTextHandler = (params) => {
    check(Boolean(params.history && params.history.length === 2), "History turns must be delivered to adapter");
    return "CDR M. Vance's vitals remain nominal following countermeasure session.";
  };

  const flightSiWithMock = new FlightSIImpl(mockAdapter);
  const turnResult = await flightSiWithMock.interact({
    query: "How is the commander adapting to the new sleep shift?",
    astronautId: "ASTRO-01",
    history: [
      { role: "user", text: "Report crew status in Node 2." },
      { role: "model", text: "CDR M. Vance is currently in Node 2." },
    ],
  });

  equal(mockAdapter.calls.length, 1, "Mock adapter must record exactly 1 call");
  equal(
    turnResult.text,
    "CDR M. Vance's vitals remain nominal following countermeasure session.",
    "Should return mock adapter response"
  );
  check(!turnResult.isFallback, "Should not be marked as fallback when adapter succeeds");

  console.log("[PASS] Test 6: MockLlmAdapter multi-turn history pass-through verified.");

  // ---------------------------------------------------------------------------
  // Test 7: Automatic Fallback Cascade when Adapter is Unready
  // ---------------------------------------------------------------------------
  const unreadyMock = new MockLlmAdapter();
  unreadyMock.setReady(false); // Model unready / loading

  const flightSiWithCascade = new FlightSIImpl(unreadyMock, new ExtractiveFallbackAdapter());
  const fallbackResult = await flightSiWithCascade.interact({
    query: "Hi HabiTrack",
    astronautId: "ASTRO-01",
  });

  check(fallbackResult.isFallback, "Must fall back gracefully when primary adapter is unready");
  check(fallbackResult.text.includes("HabiTrack"), "Fallback response must contain welcome greeting");

  console.log("[PASS] Test 7: Fallback cascade executes cleanly without throwing exceptions.");

  // ---------------------------------------------------------------------------
  // Test 8: Research Chunks Search Verification
  // ---------------------------------------------------------------------------
  const chunks = searchResearchChunks("hypercapnia co2 headache", 3);
  check(chunks.length > 0, "Should find research chunks for hypercapnia");
  check(chunks[0].relevance_pct >= 68, "Relevance score must be >= 68%");
  check(chunks[0].excerpt.length > 0, "Excerpt must not be empty");

  console.log("[PASS] Test 8: NASA biomedical research chunk search verified.");

  // ---------------------------------------------------------------------------
  // Test 9: Shift Handover Briefing Generation
  // ---------------------------------------------------------------------------
  const sampleBriefing: ShiftHandoverBriefing = {
    window: {
      hours: 12,
      startIso: new Date().toISOString(),
      endIso: new Date().toISOString(),
      timezone: "UTC",
      mode: "normal",
      isClockMismatched: false,
    },
    crew: [
      {
        astronautId: "ASTRO-01",
        callsign: "CDR M. Vance",
        crewRole: "Commander",
        changes: [],
      },
    ],
    pendingReviews: [],
    dataQuality: {
      valid: 100,
      suspect: 0,
      stale: 0,
      gap: 0,
      imputed: 0,
      importedSources: [],
      missingStreams: [],
    },
    evidencePointers: [],
    focusPrompts: ["Monitor CDRA bed cycle desorption temps."],
    disclaimer: MANDATORY_EPISTEMIC_DISCLAIMER,
    generatedBy: "deterministic",
  };

  const briefingResult = await flightSi.generateShiftBriefing({
    windowHours: 12,
    briefingData: sampleBriefing,
  });

  check(briefingResult.narrativeText.length > 50, "Briefing narrative must be rendered");
  equal(briefingResult.generatedBy, "deterministic", "Should use deterministic compiler when offline");

  console.log("[PASS] Test 9: Shift Handover Briefing compilation verified.");

  console.log(`\nPASS · ${assertions} assertions · FlightSI Deep Module test suite completed cleanly.`);
}

runAllTests().catch((err) => {
  console.error("FlightSI test failed:", err);
  throw err;
});
