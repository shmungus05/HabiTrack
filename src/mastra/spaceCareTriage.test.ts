/**
 * Unit & Integration Tests: SpaceCare AI Context Differencing & Watchable References
 *
 * Verifies that:
 * 1. "I have a headache" triggers HEADACHE_HYPERCAPNIA, latches FR-ECLSS-001, and issues immediate ventilation steps with ZERO video clutter.
 * 2. "I have a sore / muscle soreness" triggers MUSCLE_SORENESS, generates follow-up questions, and attaches watchable library video guides.
 * 3. "Cannot sleep in bunk" triggers SLEEP_DISTURBANCE and attaches sleep habitability guides.
 * 4. "Severe chest pain" triggers CRITICAL_EMERGENCY escalation.
 * 5. Greetings ("Hi") and morale questions ("is astronaut happy") NEVER attach random videos and NEVER dump raw research chunks.
 */

import { parseSymptomStep } from "./steps/parseSymptomStep.ts";
import { searchSpaceLifeGuides } from "./tools/spaceLifeLibraryTool.ts";
import { clinicalTriageWorkflow } from "./workflows/clinicalTriageWorkflow.ts";
import { queryAssistant } from "../services/api.ts";

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
    `${message} (expected ${String(expected)}, received ${String(actual)})`
  );
}

const TEST_SNAPSHOT = {
  co2Ppm: 3200,
  tempC: 22.5,
  humidityPct: 42.0,
  radiationRateMGy: 0.18,
  pressureMmHg: 758.0,
};

async function testHeadacheHypercapniaDifferentiation(): Promise<void> {
  const result = await parseSymptomStep.execute({
    context: {
      symptomText: "I have a severe headache in Node 2",
      currentSnapshot: TEST_SNAPSHOT,
      astronautId: "ASTRO-01",
    },
  });

  equal(
    result.primarySymptomCategory,
    "HEADACHE_HYPERCAPNIA",
    "Should categorize 'headache' as HEADACHE_HYPERCAPNIA"
  );
  equal(result.detectedCompartmentId, "node2", "Should detect Node 2 compartment");
  equal(result.intent, "health_concern", "Should flag health_concern intent");
}

async function testMuscleSorenessDifferentiation(): Promise<void> {
  const result = await parseSymptomStep.execute({
    context: {
      symptomText: "I have a sore in my lower back after squat workout",
      currentSnapshot: TEST_SNAPSHOT,
      astronautId: "ASTRO-01",
    },
  });

  equal(
    result.primarySymptomCategory,
    "MUSCLE_SORENESS",
    "Should categorize 'sore' as MUSCLE_SORENESS"
  );
  equal(result.intent, "exercise_guidance", "Should flag exercise_guidance intent");
  check(
    Boolean(result.followupQuestions && result.followupQuestions.length > 0),
    "Should generate clarification follow-up questions for soreness"
  );
}

async function testSleepDisturbanceDifferentiation(): Promise<void> {
  const result = await parseSymptomStep.execute({
    context: {
      symptomText: "Cannot sleep in crew quarters due to stuffy air",
      currentSnapshot: TEST_SNAPSHOT,
      astronautId: "ASTRO-01",
    },
  });

  equal(
    result.primarySymptomCategory,
    "SLEEP_DISTURBANCE",
    "Should categorize 'sleep' as SLEEP_DISTURBANCE"
  );
  equal(result.intent, "sleep_guidance", "Should flag sleep_guidance intent");
}

async function testCriticalEmergencyDifferentiation(): Promise<void> {
  const result = await parseSymptomStep.execute({
    context: {
      symptomText: "I have acute chest pain and shortness of breath",
      currentSnapshot: TEST_SNAPSHOT,
      astronautId: "ASTRO-01",
    },
  });

  equal(
    result.primarySymptomCategory,
    "CRITICAL_EMERGENCY",
    "Should recognize acute chest pain as CRITICAL_EMERGENCY"
  );
}

function testSpaceLifeLibraryRetrieval(): void {
  // 1. Casual words / greetings must NOT return videos
  const hiResources = searchSpaceLifeGuides({ query: "Hi" });
  equal(hiResources.length, 0, "Query 'Hi' must return 0 videos");

  const happyResources = searchSpaceLifeGuides({ query: "is astronaut happy" });
  equal(happyResources.length, 0, "Query 'is astronaut happy' must return 0 videos");

  // 2. Search for exercise / soreness recovery
  const exerciseResources = searchSpaceLifeGuides({
    query: "muscle soreness after ARED squat",
    category: "exercise",
    symptomCodes: ["FATIGUE", "MUSCLE_SORENESS"],
    limit: 2,
  });

  check(exerciseResources.length > 0, "Should retrieve at least one exercise guide");
  const aredGuide = exerciseResources.find((r) => r.id === "guide-ared-01");
  check(Boolean(aredGuide), "Should find guide-ared-01 for ARED exercise and soreness");
  check(Boolean(aredGuide?.mediaUrl.endsWith(".mp4")), "Media URL must be a valid playable MP4 stream");
  check(
    Boolean(aredGuide?.chapters && aredGuide.chapters.length > 0),
    "Guide must contain chapter markers"
  );

  // 3. Search for sleep station habitability
  const sleepResources = searchSpaceLifeGuides({
    query: "sleep habitability in Node 2",
    category: "sleep",
    limit: 2,
  });

  check(sleepResources.length > 0, "Should retrieve at least one sleep guide");
  const sleepGuide = sleepResources.find((r) => r.id === "guide-sleep-03");
  check(Boolean(sleepGuide), "Should find guide-sleep-03 for sleep habitability");
  check(Boolean(sleepGuide?.mediaUrl.endsWith(".mp4")), "Sleep guide must contain playable stream");
}

async function testFullClinicalTriageWorkflowExecution(): Promise<void> {
  // Test 1: Full headache workflow (Must NOT attach workout/sleep videos)
  const headacheRun: any = await clinicalTriageWorkflow.execute({
    symptomText: "I have a throbbing headache in Node 2 quarters",
    currentSnapshot: TEST_SNAPSHOT,
    astronautId: "ASTRO-01",
  });

  equal(headacheRun.latchedRuleId, "FR-ECLSS-001", "Headache must latch hypercapnia flight rule");
  check(
    headacheRun.interimActions.some((a: any) =>
      a.action.toLowerCase().includes("diffuser")
    ),
    "Headache must include immediate ventilation inspection step"
  );
  check(
    !headacheRun.resources || headacheRun.resources.length === 0,
    "Headache triage must not attach irrelevant workout videos"
  );

  // Test 2: Full muscle soreness workflow (MUST attach ARED video)
  const sorenessRun: any = await clinicalTriageWorkflow.execute({
    symptomText: "I have muscle soreness in legs after ARED squats",
    currentSnapshot: TEST_SNAPSHOT,
    astronautId: "ASTRO-01",
  });

  check(
    Boolean(sorenessRun.resources && sorenessRun.resources.length > 0),
    "Soreness run must attach watchable library resources"
  );
  check(
    sorenessRun.resources.some((r: any) => r.id === "guide-ared-01"),
    "Soreness run must recommend guide-ared-01"
  );
  check(
    Boolean(sorenessRun.followupQuestions && sorenessRun.followupQuestions.length > 0),
    "Soreness run must provide follow-up question chips"
  );
  check(
    sorenessRun.headline.toLowerCase().includes("recovery"),
    "Headline must frame soreness as recovery rather than emergency evacuation"
  );
}

async function testConversationalSynthesizerIntegrity(): Promise<void> {
  // 1. "Hi" query
  const greetingResp = await queryAssistant("Hi");
  check(
    Boolean(greetingResp.answer && greetingResp.answer.includes("Hello!")),
    "Greeting must return a friendly co-pilot answer"
  );
  equal(greetingResp.cited_evidence.length, 0, "Greeting must not dump research literature");
  equal((greetingResp.resources ?? []).length, 0, "Greeting must not attach videos");

  // 2. "is astronaut happy" query
  const moodResp = await queryAssistant("is astronaut happy", 5, "ASTRO-01");
  check(
    Boolean(moodResp.answer && moodResp.answer.includes("Behavioral Health & Performance")),
    "Mood query must return Behavioral Health & Performance assessment"
  );
  equal(moodResp.cited_evidence.length, 0, "Mood query must not dump cosmic ray literature");
  equal((moodResp.resources ?? []).length, 0, "Mood query must not attach workout videos");
}

async function runAllTests(): Promise<void> {
  await testHeadacheHypercapniaDifferentiation();
  await testMuscleSorenessDifferentiation();
  await testSleepDisturbanceDifferentiation();
  await testCriticalEmergencyDifferentiation();
  testSpaceLifeLibraryRetrieval();
  await testFullClinicalTriageWorkflowExecution();
  await testConversationalSynthesizerIntegrity();

  console.log(`PASS · ${assertions} assertions · SpaceCare AI context differencing & watchable references`);
}

runAllTests().catch((err) => {
  console.error("TEST FAILED:", err);
  throw err;
});
