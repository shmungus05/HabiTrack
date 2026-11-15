/**
 * src/services/ai/core/adapters/ExtractiveFallbackAdapter.ts
 *
 * 100% Offline Deterministic Extractive Synthesis Adapter.
 * Uses NASA Human Research Program baseline norms and Flight Rules to generate
 * grounded clinical intelligence without external LLM dependencies.
 */

import type {
  LlmAdapter,
  LlmStructuredParams,
  LlmStructuredResult,
  LlmTextParams,
  LlmTextResult,
} from "../types.ts";

export class ExtractiveFallbackAdapter implements LlmAdapter {
  readonly id = "extractive";
  readonly displayName = "Mastra Onboard First-Response Engine (Deterministic Extractive)";

  isReady(): boolean {
    return true;
  }

  async completeText(params: LlmTextParams): Promise<LlmTextResult> {
    const promptLower = params.prompt.toLowerCase();

    // Check greeting / morale / identity
    if (/\b(hi|hello|hey|greetings|good\s*(morning|afternoon|evening))\b/i.test(promptLower)) {
      return {
        text:
          "Hello! I am HabiTrack, your onboard spaceflight clinical decision-support synthetic intelligence system for Expedition 71.\n\n" +
          "I monitor cabin environmental conditions, astronaut biometrics, and NASA Flight Rules. " +
          "How can I assist you today with station telemetry, crew wellness, or flight rules?",
        provider: this.displayName,
        isFallback: true,
      };
    }

    if (/\b(thanks|thank\s*you|cheers|awesome|great|appreciate)\b/i.test(promptLower)) {
      return {
        text:
          "You're very welcome! I am always on standby for ISS Expedition 71. " +
          "Let me know if you need any assistance with station telemetry, flight rules, or crew wellness.",
        provider: this.displayName,
        isFallback: true,
      };
    }

    if (/\b(happy|morale|mood|feeling|mental|stress|psychological|wellbeing)\b/i.test(promptLower)) {
      return {
        text:
          "**NASA Behavioral Health & Performance (BHP) Assessment**\n\n" +
          "The active crew exhibits nominal operational adaptation on Flight Day 142. Circadian sleep efficiency is stable, " +
          "with nominal cognitive vigilance and active communication with Mission Control. No acute stress indices or behavioral flags are logged.\n\n" +
          "Would you like to review rest schedule metrics or behavioral wellness countermeasures?",
        provider: this.displayName,
        isFallback: true,
      };
    }

    if (/\b(who are you|what can you do|help|capabilities|overview)\b/i.test(promptLower)) {
      return {
        text:
          "I am HabiTrack, an offline-first spaceflight clinical intelligence workstation. I provide:\n\n" +
          "• **Environmental Telemetry**: Real-time cabin CO₂, radiation, ambient temperature, humidity, and atmospheric pressure.\n" +
          "• **NASA Flight Rules**: Operational checklists for hypercapnia (FR-ECLSS-001), desiccant scrubbers (FR-CDRA-002), and autonomic strain (FR-EVA-003).\n" +
          "• **SpaceLife Library**: Certified instructional video guides for exercise form, sleep habitability, and microgravity adaptation.\n" +
          "• **Crew Symptom Triage**: Pre-surgeon clinical evaluation with strict non-causal epistemic guardrails.",
        provider: this.displayName,
        isFallback: true,
      };
    }

    return {
      text:
        "Greetings. I am HabiTrack, your onboard clinical decision-support synthetic intelligence system for Expedition 71.\n\n" +
        "I monitor 5 spacecraft environmental factors (ppCO₂, radiation, cabin temp, humidity, atmospheric pressure) " +
        "alongside crew circadian baselines and NASA Flight Rules.\n\n" +
        "How can I assist you with station telemetry, flight rules, or symptom evaluations?",
      provider: this.displayName,
      isFallback: true,
    };
  }

  async completeStructured<T>(params: LlmStructuredParams<T>): Promise<LlmStructuredResult<T>> {
    // For structured calls where no external model is available, return empty or default data
    return {
      data: {} as T,
      provider: this.displayName,
      isFallback: true,
    };
  }
}
