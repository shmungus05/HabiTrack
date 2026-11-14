/**
 * Client-side Gemini 2.5 Flash RAG generative engine.
 * Direct browser execution with zero backend server dependencies.
 */

import type { CitedEvidence } from "../../types/api";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_INSTRUCTION = `
You are HabiTrack, an onboard clinical decision-support co-pilot for ISS Expedition 71.
You assist astronauts, flight surgeons, and mission specialists in monitoring environmental factors, vital signs, and NASA Flight Rules.

Guidelines:
1. Be helpful, concise, professional, and clear.
2. If NASA research context is provided, ground your answer in it and reference findings.
3. If the user greeting or general conversation (e.g. "hi", "hello", "how are you"), respond naturally and warmly as the onboard AI assistant without inventing citations.
4. Non-Causal Epistemic Guardrail: Never claim single-variable clinical causation (avoid asserting that X "caused" or "cured" Y). Use correlation terminology ("temporally associated with", "correlated with").
5. Keep responses concise (typically 2-4 sentences unless detailed analysis is requested).
`.trim();

export interface GeminiResponse {
  answer: string;
  provider: string;
}

export async function generateGeminiRagResponse(
  userQuery: string,
  evidence: CitedEvidence[] = [],
  crewContext?: string | null
): Promise<GeminiResponse> {
  const apiKey =
    (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ||
    (typeof window !== "undefined" ? localStorage.getItem("habitrack_gemini_api_key") : null);

  if (!apiKey) {
    throw new Error("No Gemini API key available");
  }

  // Construct prompt with RAG citations if relevant
  let promptContent = "";

  if (evidence.length > 0) {
    const citationsText = evidence
      .map((e) => `[${e.doc_id}: ${e.section_heading}] ${e.excerpt}`)
      .join("\n\n");
    promptContent = `Relevant Evidence from NASA Human Research Program:\n${citationsText}\n\nCrew Query: "${userQuery}"`;
  } else {
    promptContent = `Crew Query: "${userQuery}"`;
  }

  if (crewContext) {
    promptContent = `Active Crewmember: ${crewContext}\n${promptContent}`;
  }

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
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 600,
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
1. Ground your reasoning in spaceflight physiology: cephalic fluid shift, microgravity lack of thermal buoyancy (causing CO2 pocketing around the head), lack of convective sweat evaporation, forced air drying of the cornea, or barometric adaptation.
2. Formulate EXACTLY 3 practical, physical stabilization actions the crewmember can physically perform inside the spacecraft RIGHT NOW before the flight surgeon arrives:
   - Step 1: Immediate local hardware / compartment environmental check (e.g., check diffuser exhaust fan for blockage, adjust ventilation louvers, inspect return grilles).
   - Step 2: Immediate physical / hydration stabilization measure (e.g., ingest 500 mL water with electrolytes to support venous return, instill preservative-free artificial tears, gentle Valsalva maneuver, anchor feet to deck).
   - Step 3: Location relocation, PPE, or vital monitoring step (e.g., relocate to higher-turnover US Lab Destiny, attach pulse oximeter finger probe, rest in neutral body posture).
3. Match to an authentic NASA Flight Rule:
   - FR-ECLSS-001 (Elevated Cabin CO2 & CDRA High-Flow Mitigation)
   - FR-MED-71-04 (Spacecraft Hypercapnia & Headache Mitigation)
   - FR-ECLSS-012 (Cabin Low-Humidity Ocular Protection)
   - FR-EVA-003 (Autonomic Exertion Strain & Heat Dissipation)
4. Non-causal constraint: Avoid asserting clinical causation or prescribing medications. Focus on physical and environmental stabilization countermeasures.
5. Return JSON ONLY matching the requested schema.
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
  const apiKey =
    (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ||
    (typeof window !== "undefined" ? localStorage.getItem("habitrack_gemini_api_key") : null);

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
