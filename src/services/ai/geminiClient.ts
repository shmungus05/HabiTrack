/**
 * Client-side Gemini 2.5 Flash RAG generative engine.
 * Direct browser execution with zero backend server dependencies.
 */

import type { CitedEvidence } from "../../types/api";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_INSTRUCTION = `
You are HabiTrack Flight Co-Pilot, an advanced onboard clinical decision-support and crew health intelligence AI for ISS Expedition 71.
You assist astronauts, flight surgeons, and mission specialists in monitoring environmental factors, vital signs, NASA Flight Rules, and crew wellbeing.

Core Operating Directives:
1. Natural Conversational Fluency: Speak naturally, warmly, intelligently, and empathetically like ChatGPT / Claude. Hold multi-turn conversations seamlessly, retaining context of prior remarks and queries.
2. Grounded Biomedical Knowledge: When biomedical questions, symptoms, or telemetry excursions are discussed, ground your reasoning in spaceflight physiology (cephalic fluid shifts, lack of thermal buoyancy leading to CO2 pocketing, circadian desynchrony, radiation, microgravity musculoskeletal unloading).
3. Non-Causal Epistemic Guardrail: In clinical observations, avoid claiming single-variable clinical causation (avoid asserting that X directly caused Y). Use correlation terminology ("temporally associated with", "correlated with", "concordant with").
4. Crew Wellness & Morale: When asked about crew wellbeing, happiness, mood, or daily life in space, respond thoughtfully, warmly, and realistically about astronaut psychological adaptation, habitability, and mission support without generating rigid clinical forms.
5. Markdown Formatting: Use clean markdown with clear paragraphs, bullet points, and bold text for readability on the flight deck console.
`.trim();

export interface ChatHistoryTurn {
  role: "user" | "model";
  text: string;
}

export interface GeminiResponse {
  answer: string;
  provider: string;
}

export function getGeminiApiKey(): string | null {
  return (
    (typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)
      : undefined) ||
    (typeof window !== "undefined" ? localStorage.getItem("habitrack_gemini_api_key") : null) ||
    null
  );
}

export function setGeminiApiKey(key: string): void {
  if (typeof window !== "undefined") {
    const trimmed = key.trim();
    if (trimmed) {
      localStorage.setItem("habitrack_gemini_api_key", trimmed);
    } else {
      localStorage.removeItem("habitrack_gemini_api_key");
    }
    window.dispatchEvent(new CustomEvent("habitrack_api_key_updated", { detail: { key: trimmed } }));
  }
}

export async function testGeminiApiKey(testKey?: string): Promise<{ success: boolean; message: string }> {
  const key = testKey?.trim() || getGeminiApiKey();
  if (!key) {
    return { success: false, message: "No Gemini API key provided." };
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Ping test. Respond with 'PONG' only." }] }],
        generationConfig: { maxOutputTokens: 10, temperature: 0.1 },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return {
        success: false,
        message: err?.error?.message || `API error HTTP ${response.status}`,
      };
    }

    return { success: true, message: "Gemini 2.5 Flash connection verified successfully!" };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Network error contacting Gemini API",
    };
  }
}

export async function generateGeminiRagResponse(
  userQuery: string,
  evidence: CitedEvidence[] = [],
  crewContext?: string | null,
  history: ChatHistoryTurn[] = [],
  telemetryContext?: {
    co2Ppm: number;
    tempC: number;
    humidityPct: number;
    radiationRateMGy: number;
    pressureMmHg: number;
    compartment?: string;
  } | null
): Promise<GeminiResponse> {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new Error("No Gemini API key available");
  }

  // Construct prompt with RAG citations if relevant
  let promptContent = "";

  if (evidence.length > 0) {
    const citationsText = evidence
      .map((e) => `[${e.doc_id}: ${e.section_heading}] ${e.excerpt}`)
      .join("\n\n");
    promptContent = `Relevant Evidence from NASA Human Research Program:\n${citationsText}\n\n`;
  }

  if (telemetryContext) {
    promptContent += `Current Compartment Telemetry (${telemetryContext.compartment || "Onboard"}):\n- CO2: ${telemetryContext.co2Ppm} ppm | Temp: ${telemetryContext.tempC}°C | Humidity: ${telemetryContext.humidityPct}% | Rad: ${telemetryContext.radiationRateMGy} mGy/d | Pressure: ${telemetryContext.pressureMmHg} mmHg\n\n`;
  }

  if (crewContext) {
    promptContent += `Active Crewmember: ${crewContext}\n\n`;
  }

  promptContent += `Crew Query: "${userQuery}"`;

  // Format multi-turn conversation contents
  const contents = [
    ...history
      .filter((h) => h.text && h.text.trim().length > 0)
      .map((h) => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.text }],
      })),
    {
      role: "user",
      parts: [{ text: promptContent }],
    },
  ];

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents,
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 800,
      },
    }),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(
      errorJson?.error?.message || `Gemini API returned status ${response.status}`
    );
  }

  const data = await response.json();
  const rawAnswer =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
    "No response generated.";

  return {
    answer: rawAnswer,
    provider: "Gemini 2.5 Flash (Direct Browser Execution)",
  };
}

export interface DynamicTriageAIResponse {
  headline: string;
  conversationalOverview?: string;
  physiologicalRationale: string;
  biologicalLatencyLag: string;
  confidenceMatch: string;
  latchedRuleId: string;
  flightRuleTitle: string;
  interimActions: Array<{
    id: string;
    stepNumber: number;
    action: string;
    rationale: string;
    estimatedMinutes: number;
    completed: boolean;
  }>;
}

const CLINICAL_TRIAGE_SYSTEM_PROMPT = `
You are the Onboard Clinical First-Response AI for ISS Expedition 71.
Your role is rapid triage and immediate physical stabilization countermeasures during Loss of Signal (LOS) or when Earth flight surgeons are unavailable.

Operating Directives:
1. Provide a natural, empathetic, conversational summary in "conversationalOverview" (2-3 sentences speaking directly to the astronaut, validating their symptom, explaining the physiological context like microgravity fluid shifts or ventilation, and reassuring them).
2. Ground your reasoning in spaceflight physiology: cephalic fluid shift, microgravity lack of thermal buoyancy (causing CO2 pocketing around the head), lack of convective sweat evaporation, forced air drying of the cornea, or barometric adaptation.
3. Formulate EXACTLY 3 practical, physical stabilization actions the crewmember can physically perform inside the spacecraft RIGHT NOW before the flight surgeon arrives:
   - Step 1: Immediate local hardware / compartment environmental check (e.g., check diffuser exhaust fan for blockage, adjust ventilation louvers, inspect return grilles).
   - Step 2: Immediate physical / hydration stabilization measure (e.g., ingest 500 mL water with electrolytes to support venous return, instill preservative-free artificial tears, gentle Valsalva maneuver, anchor feet to deck).
   - Step 3: Location relocation, PPE, or vital monitoring step (e.g., relocate to higher-turnover US Lab Destiny, attach pulse oximeter finger probe, rest in neutral body posture).
4. Match to an authentic NASA Flight Rule:
   - FR-ECLSS-001 (Elevated Cabin CO2 & CDRA High-Flow Mitigation)
   - FR-MED-71-04 (Spacecraft Hypercapnia & Headache Mitigation)
   - FR-ECLSS-012 (Cabin Low-Humidity Ocular Protection)
   - FR-EVA-003 (Autonomic Exertion Strain & Heat Dissipation)
5. Non-causal constraint: Avoid asserting clinical causation or prescribing medications. Focus on physical and environmental stabilization countermeasures.
6. Return JSON ONLY matching the requested schema.
`.trim();

export async function generateClinicalTriageAI(params: {
  symptomText: string;
  compartmentName: string;
  snapshot: {
    co2Ppm: number;
    tempC: number;
    humidityPct: number;
    radiationRateMGy: number;
    pressureMmHg: number;
    airflowProfile?: string;
  };
  astronautId?: string;
}): Promise<DynamicTriageAIResponse> {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new Error("No Gemini API key available for dynamic clinical triage");
  }

  const promptContent = `
Astronaut ID: ${params.astronautId || "ASTRO-01"}
Current Compartment: ${params.compartmentName}
Reported Symptom / Discomfort: "${params.symptomText}"

Live 5-Factor Telemetry in Compartment:
- Carbon Dioxide (ppCO2): ${params.snapshot.co2Ppm} ppm
- Cabin Ambient Temperature: ${params.snapshot.tempC} °C
- Relative Humidity: ${params.snapshot.humidityPct} %
- Space Radiation Rate: ${params.snapshot.radiationRateMGy} mGy/d
- Cabin Atmospheric Pressure: ${params.snapshot.pressureMmHg} mmHg
- Airflow Profile: ${params.snapshot.airflowProfile || "Nominal Circulation"}

Generate the 3 immediate physical stabilization countermeasures and clinical rationale in JSON format.
`.trim();

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: promptContent }],
        },
      ],
      systemInstruction: {
        parts: [{ text: CLINICAL_TRIAGE_SYSTEM_PROMPT }],
      },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 900,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(
      errorJson?.error?.message || `Gemini API returned status ${response.status}`
    );
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!rawText) {
    throw new Error("Empty response from Gemini clinical triage engine");
  }

  const parsed = JSON.parse(rawText) as DynamicTriageAIResponse;

  // Validate structure
  if (!parsed.interimActions || !Array.isArray(parsed.interimActions)) {
    throw new Error("Invalid interim actions structure returned by AI");
  }

  return {
    headline: parsed.headline || `First-Response Interim Protocol: ${params.compartmentName}`,
    conversationalOverview: parsed.conversationalOverview?.trim() || undefined,
    physiologicalRationale:
      parsed.physiologicalRationale ||
      `Telemetry evaluation indicated operational parameters requiring physical stabilization.`,
    biologicalLatencyLag: parsed.biologicalLatencyLag || "Immediate (0 - 15 Minutes)",
    confidenceMatch: parsed.confidenceMatch || "85% (Concordance Model)",
    latchedRuleId: parsed.latchedRuleId || "FR-MED-71-04",
    flightRuleTitle:
      parsed.flightRuleTitle || "Spacecraft Physiological Stabilization Protocol",
    interimActions: parsed.interimActions.map((act, index) => ({
      id: act.id || `act-${index + 1}`,
      stepNumber: act.stepNumber || index + 1,
      action: act.action,
      rationale: act.rationale || "Supports microgravity physiological stabilization.",
      estimatedMinutes: act.estimatedMinutes || 3,
      completed: false,
    })),
  };
}
