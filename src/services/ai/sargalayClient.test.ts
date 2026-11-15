import {
  getSargalayApiKey,
  getSargalayModel,
  getSargalayModelLabel,
  generateSargalayChatCompletion,
  testSargalayApiKey,
  SARGALAY_FALLBACK_CHAIN,
} from "./sargalayClient.ts";

let assertions = 0;

function check(condition: boolean, message: string): void {
  assertions += 1;
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests(): Promise<void> {
  console.log("Starting Sargalay AI Gateway unit tests...");

  // Test 1: Key retrieval & default key
  const apiKey = getSargalayApiKey();
  check(Boolean(apiKey), "Sargalay API key should be available");
  check(Boolean(apiKey && apiKey.startsWith("sk-")), "Sargalay API key should start with sk-");
  console.log("[PASS] Test 1: API Key discovery verified.");

  // Test 2: Model configuration & labels
  const model = getSargalayModel();
  check(Boolean(model), "Default model should be defined");
  const label = getSargalayModelLabel(model);
  check(Boolean(label), "Model label should resolve cleanly");
  check(SARGALAY_FALLBACK_CHAIN.length >= 3, "Fallback chain must contain at least 3 models");
  console.log(`[PASS] Test 2: Model configuration verified (Default: ${label}).`);

  // Test 3: Live Ping Test against Sargalay Gateway
  console.log("Testing connection against Sargalay Gateway...");
  const pingResult = await testSargalayApiKey(apiKey || undefined, "google/gemini-2.5-flash");
  check(pingResult.success, `Ping test should succeed: ${pingResult.message}`);
  check(typeof pingResult.latencyMs === "number" && pingResult.latencyMs > 0, "Latency should be measured");
  console.log(`[PASS] Test 3: Sargalay Gateway Ping verified (${pingResult.latencyMs}ms).`);

  // Test 4: Live Completion with multi-model fallback readiness
  console.log("Testing chat completion via Sargalay...");
  const completion = await generateSargalayChatCompletion({
    messages: [
      { role: "system", content: "You are a concise mission assistant." },
      { role: "user", content: "Reply with the word 'NOMINAL' only." },
    ],
    maxTokens: 10,
    temperature: 0.1,
  });

  check(completion.content.length > 0, "Completion content should not be empty");
  check(Boolean(completion.modelUsed), "Model used should be reported");
  console.log(`[PASS] Test 4: Chat completion verified via ${completion.modelUsed}: "${completion.content}"`);

  console.log(`\nPASS · ${assertions} assertions · Sargalay AI Gateway unit tests completed cleanly.`);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  throw err;
});
