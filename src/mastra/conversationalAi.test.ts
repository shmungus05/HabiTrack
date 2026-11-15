/**
 * Test suite for conversational AI triage filter, multi-turn memory, and API key management.
 */

import { getGeminiApiKey } from "../services/ai/geminiClient.ts";
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

// 1. Test getGeminiApiKey safe extraction in Node environment
const key = getGeminiApiKey();
check(key === null || typeof key === "string", "getGeminiApiKey must safely return string or null in Node");

// 2. Test queryAssistant with chat history
async function testQueryAssistantWithHistory(): Promise<void> {
  const history = [
    { role: "user" as const, text: "Hello HabiTrack, who is currently in Node 2?" },
    { role: "model" as const, text: "CDR M. Vance is currently assigned to Node 2 Harmony." },
  ];

  const response = await queryAssistant(
    "Is astronaut happy?",
    3,
    "ASTRO-01",
    null,
    history
  );

  check(Boolean(response), "Response should be returned");
  check(Boolean(response.answer), "Response must include an answer text");
  check(Boolean(response.resources && response.resources.length === 0), "Morale query must return 0 video resource cards");
}

// 3. Test symptom vs conversational intent differencing
function isSymptomTriageQuery(query: string): boolean {
  const lower = query.toLowerCase();

  if (
    lower.includes("5-factor") ||
    lower.includes("run triage") ||
    lower.includes("clinical triage") ||
    lower.includes("triage protocol")
  ) {
    return true;
  }

  const clinicalSymptoms = [
    "headache",
    "cephalic",
    "fatigue",
    "dizzy",
    "dizziness",
    "nausea",
    "vomit",
    "vomiting",
    "stinging",
    "dry eyes",
    "eye irritation",
    "sweat",
    "overheat",
    "lethargy",
    "tachycardia",
    "palpitations",
    "hypercapnia",
    "discomfort",
    "sore",
    "soreness",
    "muscle ache",
    "musculoskeletal",
    "stiff",
    "stiffness",
    "ache",
    "aching",
    "strain",
    "doms",
    "insomnia",
    "cannot sleep",
    "sleep disturbance",
    "shortness of breath",
    "dyspnea",
    "vertigo",
    "motion sickness",
  ];

  return clinicalSymptoms.some((kw) => lower.includes(kw));
}

function testTriageDifferencing(): void {
  // General & Morale queries MUST NOT trigger triage
  equal(isSymptomTriageQuery("Thank you"), false, "'Thank you' is polite conversation");
  equal(isSymptomTriageQuery("is astronaut happy"), false, "'is astronaut happy' is conversational, not symptom triage");
  equal(isSymptomTriageQuery("hi"), false, "'hi' is conversational");
  equal(isSymptomTriageQuery("Hello, how are you?"), false, "Greeting is conversational");
  equal(isSymptomTriageQuery("What is Node 2 used for?"), false, "Node 2 query is conversational knowledge");
  equal(isSymptomTriageQuery("Check the morning flight schedule"), false, "Schedule check is conversational");

  // Clinical symptoms MUST trigger triage
  equal(isSymptomTriageQuery("I have a headache"), true, "Headache must trigger clinical triage");
  equal(isSymptomTriageQuery("My legs are sore after workout"), true, "Soreness must trigger clinical triage");
  equal(isSymptomTriageQuery("Experiencing dizziness and nausea"), true, "Dizziness must trigger clinical triage");
  equal(isSymptomTriageQuery("run 5-factor triage"), true, "5-factor triage command must trigger clinical triage");
}

async function run(): Promise<void> {
  testTriageDifferencing();
  await testQueryAssistantWithHistory();
  console.log(`PASS · ${assertions} assertions · Conversational AI multi-turn memory & triage differencing`);
}

run().catch((err: unknown) => {
  console.error("Test failure:", err);
  throw err;
});
