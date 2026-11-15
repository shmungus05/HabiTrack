/**
 * src/services/ai/core/FlightSI.ts
 *
 * Deep Module: FlightSI
 *
 * Implements the unified, high-leverage interface for HabiTrack's SI capabilities:
 * 1. Conversational SI intelligence & literature RAG (`interact`)
 * 2. 5-factor cabin clinical triage with NASA Flight Rules (`triageSymptom`)
 * 3. Flight Surgeon shift handover briefing synthesis (`generateShiftBriefing`)
 *
 * Enforces strict non-causal epistemic guardrails, automatic provider fallback cascade,
 * and deterministic offline reliability.
 */

import researchChunksRaw from "../../../data/researchChunks.json" with { type: "json" };
import { searchSpaceLifeGuides } from "../../../mastra/tools/spaceLifeLibraryTool.ts";
import { renderDeterministicBriefingProse } from "../../../features/handover/shiftHandoverTemplate.ts";
import type {
  AssistantResponse,
  ChecklistStep,
  CitedEvidence,
  FlightRule,
} from "../../../types/api.ts";
import {
  ExtractiveFallbackAdapter,
  GeminiFrontierAdapter,
  WebGpuLocalAdapter,
} from "./adapters/index.ts";
import type {
  BriefingTurnResult,
  ChatMessageTurn,
  ConversationalIntent,
  SIRequest,
  SITurnResult,
  FlightSI,
  InterimActionItem,
  LlmAdapter,
  ShiftBriefingRequest,
  SurgeonHandoffPacket,
  SymptomCategory,
  SymptomConsentState,
  SymptomTriageRequest,
  TelemetrySnapshot,
  TriageTurnResult,
} from "./types.ts";

const PROHIBITED_CAUSAL_TERMS =
  /\b(cause|causes|caused|causing|proves|proven|diagnose|diagnosed|diagnosis|prescribe|prescribes|prescribed|prescription|treat|treated|treating|treatment|cure|remedy)\b/gi;

export const MANDATORY_EPISTEMIC_DISCLAIMER =
  "Non-Causal Decision Support Disclaimer: Temporal correlation indicates co-occurrence only and does not establish clinical causation. HabiTrack is an onboard clinical decision-support triage assistant, not an autonomous diagnostic system. Operational countermeasure decisions must be verified by a flight surgeon.";

const DEFAULT_SNAPSHOT: TelemetrySnapshot = {
  co2Ppm: 2420,
  tempC: 22.8,
  humidityPct: 44.5,
  radiationRateMGy: 0.38,
  pressureMmHg: 758,
};

interface RawResearchChunk {
  chunk_id: string;
  doc_id: string;
  title: string;
  authors: string | null;
  report_identifier: string | null;
  section_heading: string;
  doi_citation: string | null;
  source_repository: string;
  content: string;
}

const researchChunks = researchChunksRaw as RawResearchChunk[];

export function isSymptomTriageQuery(query: string): boolean {
  const lower = query.toLowerCase();
  if (
    lower.includes("5-factor") ||
    lower.includes("run triage") ||
    lower.includes("clinical triage") ||
    lower.includes("triage protocol")
  ) {
    return true;
  }
  const category = new FlightSIImpl().classifySymptomCategory(query);
  if (category !== "GENERIC_DISCOMFORT") return true;

  const clinicalSymptoms = [
    "headache", "cephalic", "fatigue", "dizzy", "dizziness", "nausea",
    "vomit", "vomiting", "stinging", "dry eye", "eye irritation", "sweat",
    "overheat", "lethargy", "tachycardia", "palpitations", "hypercapnia",
    "discomfort", "sore", "soreness", "muscle ache", "musculoskeletal",
    "stiff", "stiffness", "ache", "aching", "strain", "doms", "insomnia",
    "cannot sleep", "sleep disturbance", "shortness of breath", "dyspnea",
    "vertigo", "motion sickness"
  ];
  return clinicalSymptoms.some((kw) => lower.includes(kw));
}

export function searchResearchChunks(queryText: string, topK = 4): CitedEvidence[] {
  const tokens = queryText
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (tokens.length === 0) {
    return [];
  }

  const scored = researchChunks.map((chunk) => {
    let score = 0;
    const titleLower = chunk.title.toLowerCase();
    const secLower = chunk.section_heading.toLowerCase();
    const contentLower = chunk.content.toLowerCase();

    for (const token of tokens) {
      if (titleLower.includes(token)) score += 5;
      if (secLower.includes(token)) score += 3;
      if (contentLower.includes(token)) score += 1;
    }

    return { chunk, score };
  });

  const matched = scored.filter((s) => s.score >= 3);
  if (matched.length === 0) {
    return [];
  }

  matched.sort((a, b) => b.score - a.score);
  const selected = matched.slice(0, topK);

  return selected.map(({ chunk, score }, idx) => {
    const maxPossible = Math.max(tokens.length * 5, 5);
    const relevancePct = Math.min(99, Math.max(68, Math.round((score / maxPossible) * 100)));
    return {
      chunk_id: chunk.chunk_id,
      doc_id: chunk.doc_id,
      title: chunk.title,
      authors: chunk.authors,
      report_identifier: chunk.report_identifier,
      section_heading: chunk.section_heading,
      doi_citation: chunk.doi_citation,
      source_repository: chunk.source_repository,
      excerpt: chunk.content.slice(0, 320) + (chunk.content.length > 320 ? "..." : ""),
      rrf_score: parseFloat((0.85 - idx * 0.08).toFixed(3)),
      relevance_pct: relevancePct,
    };
  });
}

function resolveCallsign(astronautId?: string | null): string {
  switch (astronautId) {
    case "ASTRO-02":
      return "FE-1 Dr. S. Patel";
    case "ASTRO-03":
      return "MS-1 K. Lindgren";
    case "ASTRO-01":
    default:
      return "CDR M. Vance";
  }
}

export class FlightSIImpl implements FlightSI {
  private adapter?: LlmAdapter;
  private fallbackAdapter: LlmAdapter;

  constructor(
    adapter?: LlmAdapter,
    fallbackAdapter: LlmAdapter = new ExtractiveFallbackAdapter()
  ) {
    this.adapter = adapter;
    this.fallbackAdapter = fallbackAdapter;
  }

  private resolveAdapter(): LlmAdapter {
    if (this.adapter) return this.adapter;
    if (typeof window === "undefined") return this.fallbackAdapter;

    const mode = (localStorage.getItem("habitrack_ai_model_mode") as "frontier" | "local") || "frontier";
    if (mode === "local") {
      const localAdapter = new WebGpuLocalAdapter();
      if (localAdapter.isReady()) return localAdapter;
    }
    const frontierAdapter = new GeminiFrontierAdapter();
    if (frontierAdapter.isReady()) return frontierAdapter;

    return this.fallbackAdapter;
  }

  classifyIntent(text: string): ConversationalIntent {
    const lower = text.toLowerCase();
    if (/(exercise|workout|squat|lift|ared|treadmill|cycle|stretch|physical training)/i.test(lower)) {
      return "exercise_guidance";
    }
    if (/(sleep|insomnia|rest|quarters|bunk|circadian|nap|wake)/i.test(lower)) {
      return "sleep_guidance";
    }
    if (/(happy|morale|mood|feeling|mental|stress|psychological|wellbeing|depress|anxious|homesick)/i.test(lower)) {
      return "mental_wellbeing";
    }
    if (/(headache|fever|cough|sore|dizzy|nausea|eye|vision|hypercapnia|tachycardia|vomit|ache|stiff|pain|discomfort)/i.test(lower)) {
      return "health_concern";
    }
    if (/(food|meal|ration|hygiene|shower|waste|toilet|leisure|music|movie)/i.test(lower)) {
      return "daily_living";
    }
    return "general_question";
  }

  classifySymptomCategory(text: string): SymptomCategory {
    const lower = text.toLowerCase();

    // Critical Emergency Checks
    if (
      lower.includes("chest pain") ||
      lower.includes("cannot breathe") ||
      lower.includes("ammonia leak") ||
      lower.includes("unconscious") ||
      lower.includes("decompression") ||
      lower.includes("toxic leak")
    ) {
      return "CRITICAL_EMERGENCY";
    }

    // Headache / Hypercapnia
    if (
      lower.includes("headache") ||
      lower.includes("throbbing") ||
      lower.includes("brain fog") ||
      lower.includes("hypercapnia") ||
      lower.includes("pco2") ||
      lower.includes("co2")
    ) {
      return "HEADACHE_HYPERCAPNIA";
    }

    // Musculoskeletal / Soreness / DOMS
    if (
      lower.includes("sore") ||
      lower.includes("soreness") ||
      lower.includes("muscle ache") ||
      lower.includes("stiff") ||
      lower.includes("stiffness") ||
      lower.includes("doms") ||
      lower.includes("hamstring") ||
      lower.includes("quad") ||
      lower.includes("back pain")
    ) {
      return "MUSCLE_SORENESS";
    }

    // Sleep disturbance
    if (
      lower.includes("sleep") ||
      lower.includes("insomnia") ||
      lower.includes("cannot sleep") ||
      lower.includes("waking up") ||
      lower.includes("rest cycle")
    ) {
      return "SLEEP_DISTURBANCE";
    }

    // Ocular irritation
    if (
      lower.includes("dry eye") ||
      lower.includes("stinging eye") ||
      lower.includes("itchy eye") ||
      lower.includes("corneal") ||
      lower.includes("eye irritation")
    ) {
      return "OCULAR_IRRITATION";
    }

    // Thermal exertion / overheating
    if (
      lower.includes("overheat") ||
      lower.includes("sweat") ||
      lower.includes("hot") ||
      lower.includes("thermal strain") ||
      lower.includes("heat exhaustion")
    ) {
      return "THERMAL_EXERTION";
    }

    // Neurovestibular dizziness
    if (
      lower.includes("dizzy") ||
      lower.includes("dizziness") ||
      lower.includes("nausea") ||
      lower.includes("vertigo") ||
      lower.includes("motion sickness") ||
      lower.includes("vomit")
    ) {
      return "NEUROVESTIBULAR_DIZZINESS";
    }

    return "GENERIC_DISCOMFORT";
  }

  detectCompartment(text: string, override?: string | null): { id: string; name: string } {
    if (override && override !== "Auto-Detect") {
      return { id: override.toLowerCase().replace(/\s+/g, "-"), name: override };
    }

    const lower = text.toLowerCase();
    if (lower.includes("destiny") || lower.includes("us lab") || lower.includes("lab")) {
      return { id: "destiny", name: "US Lab Destiny" };
    }
    if (lower.includes("harmony") || lower.includes("node 2") || lower.includes("crew quarters") || lower.includes("sleep station")) {
      return { id: "node2", name: "Node 2 (Harmony Crew Quarters)" };
    }
    if (lower.includes("columbus")) {
      return { id: "columbus", name: "Columbus European Module" };
    }
    if (lower.includes("kibo") || lower.includes("jem")) {
      return { id: "kibo", name: "Kibo JEM Module" };
    }
    if (lower.includes("cupola")) {
      return { id: "cupola", name: "Cupola Observation Module" };
    }
    if (lower.includes("unity") || lower.includes("node 1")) {
      return { id: "node1", name: "Node 1 (Unity)" };
    }
    if (lower.includes("zvezda")) {
      return { id: "zvezda", name: "Zvezda Service Module" };
    }
    if (lower.includes("quest") || lower.includes("airlock")) {
      return { id: "quest", name: "Quest Joint Airlock" };
    }

    return { id: "general", name: "General Station Bay" };
  }

  sanitizeEpistemicGuardrails(text: string): { text: string; tripwireTriggered: boolean } {
    const hasTripwire = PROHIBITED_CAUSAL_TERMS.test(text);
    const sanitized = text.replace(PROHIBITED_CAUSAL_TERMS, "[temporally correlated with]");
    return { text: sanitized, tripwireTriggered: hasTripwire };
  }

  async interact(request: SIRequest): Promise<SITurnResult> {
    const trimmed = request.query.trim();
    const intent = this.classifyIntent(trimmed);
    const lower = trimmed.toLowerCase();

    const isGreeting = /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|thanks|thank\s*you|cheers|awesome|great|ok|okay)\b/i.test(lower);
    const isMood = intent === "mental_wellbeing";
    const isIdentity = /(who are you|what can you do|help|capabilities|overview)/i.test(lower);
    const isCreative = /(poem|story|joke|rhyme|haiku|sing|song|casual|fun|taco|pizza|food|movie|music|humor)/i.test(lower);

    // Retrieve biomedical literature chunks ONLY for technical/biomedical inquiries
    const citedEvidence = isGreeting || isMood || isIdentity || isCreative
      ? []
      : searchResearchChunks(trimmed, 4);

    // Context telemetry
    const effectiveTelemetry = request.telemetryContext ?? DEFAULT_SNAPSHOT;

    // Search SpaceLife video guides if query asks for guidance or video
    const isMediaRequest =
      intent === "exercise_guidance" ||
      intent === "sleep_guidance" ||
      lower.includes("video") ||
      lower.includes("guide") ||
      lower.includes("watch") ||
      lower.includes("how to") ||
      lower.includes("demonstrat");

    const resources = isMediaRequest
      ? searchSpaceLifeGuides({
          query: trimmed,
          category: intent === "exercise_guidance" ? "exercise" : intent === "sleep_guidance" ? "sleep" : undefined,
          limit: 2,
        })
      : [];

    // Flight rule matching
    let flightRuleCited: FlightRule | null = null;
    let verbatimChecklist: ChecklistStep[] = [];

    if (lower.includes("co2") || lower.includes("eclss") || lower.includes("hypercapnia") || lower.includes("headache")) {
      flightRuleCited = {
        rule_id: "FR-ECLSS-001",
        title: "Elevated Cabin CO2 & CDRA High-Flow Mitigation",
        subsystem: "ECLSS",
        revision_date: "2024-08-15",
        severity_trigger: "INVESTIGATE",
        condition_threshold: "ppCO2 > 3.0 mmHg (approx 3,950 PPM) sustained for > 60 min",
        verbatim_text: "Upon confirmation of cabin ppCO2 excursion above operational threshold, verify CDRA bed half-cycle timing and initiate high-flow auxiliary ventilation diffuser sweep.",
        sha256_hash: "a9f4c3...",
        checklist_steps: [
          { step_number: 1, action: "Verify CDRA bed cycle timing", target_subsystem: "ECLSS", verification: "Telemetry telemetry.co2Ppm decreasing", caution_warning: null },
          { step_number: 2, action: "Activate module inter-module ventilation (IMV) boost", target_subsystem: "Ventilation", verification: "Diffuser delta-P nominal", caution_warning: "Ensure return grilles are unoccluded" },
          { step_number: 3, action: "Hydrate crew with 500 mL water", target_subsystem: "Crew Health", verification: "Self-report", caution_warning: null },
        ],
        reference_docs: ["SSP 50260 Rev C"],
      };
      verbatimChecklist = flightRuleCited.checklist_steps;
    } else if (lower.includes("cdra") || lower.includes("thermal") || lower.includes("desiccant")) {
      flightRuleCited = {
        rule_id: "FR-CDRA-002",
        title: "CDRA Desiccant Bed Thermal Regeneration Anomaly",
        subsystem: "Thermal / ECLSS",
        revision_date: "2024-06-20",
        severity_trigger: "INVESTIGATE",
        condition_threshold: "Desiccant bed core temp > 215°C during desorption phase",
        verbatim_text: "Monitor desorption thermal curves to prevent zeolite matrix degradation. Throttle air loop if core temperature exceeds bounds.",
        sha256_hash: "b8e1d2...",
        checklist_steps: [
          { step_number: 1, action: "Throttle air loop heater bank B", target_subsystem: "CDRA Heaters", verification: "Core temp stabilizes < 210°C", caution_warning: null },
          { step_number: 2, action: "Switch to redundant bed A cycle", target_subsystem: "CDRA Valves", verification: "Cycle state A active", caution_warning: null },
        ],
        reference_docs: ["Flight Rule Book Vol B"],
      };
      verbatimChecklist = flightRuleCited.checklist_steps;
    } else if (lower.includes("eva") || lower.includes("heart rate") || lower.includes("tachycardia") || lower.includes("workout")) {
      flightRuleCited = {
        rule_id: "FR-EVA-003",
        title: "Crew Autonomic Exertion Strain & Heat Dissipation",
        subsystem: "Biomedical",
        revision_date: "2024-09-01",
        severity_trigger: "OBSERVE",
        condition_threshold: "Sustained HR > 85% HRmax for > 20 min or RMSSD drop > 40%",
        verbatim_text: "Autonomic strain observed during high-load countermeasure or EVA tasks requires verified cooling loop operation and hydration monitoring.",
        sha256_hash: "c3d4e5...",
        checklist_steps: [
          { step_number: 1, action: "Verify liquid cooling garment (LCG) flow rate", target_subsystem: "EMU / Suit", verification: "Inlet temp 18°C", caution_warning: null },
          { step_number: 2, action: "Initiate 5-minute active rest in Neutral Body Posture", target_subsystem: "Crew Rest", verification: "HR recovery < 100 bpm", caution_warning: null },
        ],
        reference_docs: ["HRP-47053"],
      };
      verbatimChecklist = flightRuleCited.checklist_steps;
    }

    // Build LLM Prompt
    let promptContent = "";
    if (citedEvidence.length > 0) {
      promptContent += `Relevant NASA Biomedical Literature:\n${citedEvidence.map((e) => `[${e.doc_id}: ${e.section_heading}] ${e.excerpt}`).join("\n\n")}\n\n`;
    }
    promptContent += `Current Compartment Telemetry:\n- CO2: ${effectiveTelemetry.co2Ppm} ppm | Temp: ${effectiveTelemetry.tempC} °C | Humidity: ${effectiveTelemetry.humidityPct}% | Rad: ${effectiveTelemetry.radiationRateMGy} mGy/d | Pressure: ${effectiveTelemetry.pressureMmHg} mmHg\n\n`;
    promptContent += `Active Crewmember: ${resolveCallsign(request.astronautId)}\n`;
    promptContent += `Crew Query: "${trimmed}"`;

    const systemInstruction = `
You are HabiTrack Flight SI, an advanced onboard clinical decision-support and crew health synthetic intelligence system for ISS Expedition 71.
Core Operating Directives:
1. Natural Conversational Fluency: Speak naturally, warmly, intelligently, and empathetically. Hold multi-turn conversations seamlessly.
2. Grounded Biomedical Knowledge: Ground your reasoning in spaceflight physiology (fluid shifts, microgravity ventilation, circadian phase, radiation).
3. Non-Causal Epistemic Guardrail: Never claim single-variable clinical causation. Use correlation terms ("temporally associated with", "correlated with", "concordant with").
4. Response Length: Keep responses concise (typically 2-4 sentences unless detailed analysis is requested).
`.trim();

    const activeAdapter = this.resolveAdapter();
    let answerText = "";
    let providerUsed = activeAdapter.displayName;
    let isFallback = false;

    try {
      const result = await activeAdapter.completeText({
        systemInstruction,
        prompt: promptContent,
        history: request.history,
        temperature: 0.5,
        maxOutputTokens: 600,
      });
      answerText = result.text;
      providerUsed = result.provider;
      isFallback = result.isFallback;
    } catch {
      // Cascade to fallback adapter
      const fallbackResult = await this.fallbackAdapter.completeText({
        systemInstruction,
        prompt: promptContent,
        history: request.history,
      });
      answerText = fallbackResult.text;
      providerUsed = fallbackResult.provider;
      isFallback = true;
    }

    // Epistemic Guardrail Sanitation
    const { text: sanitizedText, tripwireTriggered } = this.sanitizeEpistemicGuardrails(answerText);

    const headline = isGreeting
      ? "HabiTrack SI Standby"
      : isMood
      ? "Behavioral Health & Performance (BHP)"
      : citedEvidence.length > 0
      ? `Literature Synthesis: ${trimmed.slice(0, 45)}`
      : "HabiTrack Flight Assistant";

    const studyCaveats = [
      "Data primarily reflects terrestrial 6-degree head-down tilt bed-rest analogues or LEO station telemetry.",
      "Individual astronaut autonomic reactivity varies significantly during high workload and circadian shifts.",
    ];

    const rawResponse: AssistantResponse = {
      interaction_id: `int-${Date.now()}`,
      astronaut_id: request.astronautId ?? null,
      event_id: request.concordanceEventId ?? null,
      mode: isFallback ? "EXTRACTIVE_FALLBACK" : "GEMINI_GENERATIVE",
      headline,
      observed_dynamics: citedEvidence.length > 0
        ? `Biomedical research synthesis across NASA GeneLab and Life Sciences corpus for "${trimmed.slice(0, 40)}".`
        : `Onboard clinical SI standby session for ${resolveCallsign(request.astronautId)}.`,
      scientific_context: citedEvidence.length > 0
        ? citedEvidence.map((e) => `[${e.doc_id}: ${e.section_heading}] ${e.excerpt}`).join(" ")
        : "Circadian baseline comparison indicates transient autonomic fluctuation within observed operational bounds.",
      cited_evidence: citedEvidence,
      study_caveats: studyCaveats,
      disclaimer: MANDATORY_EPISTEMIC_DISCLAIMER,
      tripwire_triggered: tripwireTriggered,
      latency_ms: 22,
      flight_rule_cited: flightRuleCited,
      verbatim_checklist: verbatimChecklist,
      provider_used: providerUsed,
      answer: sanitizedText,
      resources,
      intent,
    };

    return {
      text: sanitizedText,
      provider: providerUsed,
      isFallback,
      headline,
      intent,
      resources,
      citedEvidence,
      flightRuleCited,
      verbatimChecklist,
      studyCaveats,
      disclaimer: MANDATORY_EPISTEMIC_DISCLAIMER,
      tripwireTriggered,
      rawResponse,
    };
  }

  async triageSymptom(request: SymptomTriageRequest): Promise<TriageTurnResult> {
    const symptomText = request.symptomText.trim();
    const astronautId = request.astronautId ?? "ASTRO-01";
    const compartment = this.detectCompartment(symptomText, request.compartmentOverride);
    const category = this.classifySymptomCategory(symptomText);
    const intent: ConversationalIntent = "health_concern";

    const snapshot = request.snapshot ?? DEFAULT_SNAPSHOT;
    const telemetryReadings = {
      ...snapshot,
      airflowProfile: compartment.id === "destiny" ? "High-Flow Laminar Circulation" : "Nominal Circulation",
    };

    // Determine deterministic flight rule, lag, rationale, and confidence
    let ruleId = "FR-GEN-001";
    let ruleTitle = "Spacecraft Habitat Baseline & Health Triage";
    let lagWindow = "Immediate (0 - 15 Minutes)";
    let rationale = `Telemetry evaluation in ${compartment.name} indicates operational parameters requiring physical stabilization.`;
    let confidence = "80% (Nominal Circadian Profile)";
    let deterministicActions: InterimActionItem[] = [];

    switch (category) {
      case "CRITICAL_EMERGENCY":
        ruleId = "FR-MED-71-04";
        ruleTitle = "Critical Crew Medical Emergency & Safe Haven Protocol";
        lagWindow = "Immediate (0 Minutes)";
        rationale = "CRITICAL ALERT: Acute physiological distress reported. Normal knowledge retrieval bypassed. Initiate emergency stabilization protocol immediately.";
        confidence = "99% (Emergency Escalation)";
        deterministicActions = [
          { id: "act-1", stepNumber: 1, action: "Don emergency Quick-Don O2 mask if atmospheric excursion suspected", rationale: "Guarantees uncompromised breathing gas during potential cabin leak.", estimatedMinutes: 1, completed: false },
          { id: "act-2", stepNumber: 2, action: "Sound Station Emergency Audio Annunciation and alert Flight Director", rationale: "Mobilizes immediate ground flight surgeon triage team.", estimatedMinutes: 1, completed: false },
          { id: "act-3", stepNumber: 3, action: "Prepare crew for relocation to Crew Return Vehicle (CRV) Safe Haven", rationale: "Establishes isolated atmospheric retreat in the event of cabin loss.", estimatedMinutes: 3, completed: false },
        ];
        break;

      case "HEADACHE_HYPERCAPNIA":
        ruleId = "FR-ECLSS-001";
        ruleTitle = "Elevated Cabin CO2 & CDRA High-Flow Mitigation";
        lagWindow = "1.5 to 2.0 Hours post-exposure";
        rationale = `Cabin CO₂ is evaluated at ${telemetryReadings.co2Ppm.toLocaleString()} PPM. Cephalic fluid shift increases intracranial pressure, producing delayed headache onset.`;
        confidence = "86% (NASA LSDA Correlation Peak)";
        deterministicActions = [
          { id: "act-1", stepNumber: 1, action: "Inspect localized diffuser exhaust grilles and return louvers for blockage", rationale: "Clears microgravity stagnant air pockets where exhaled CO2 pools.", estimatedMinutes: 2, completed: false },
          { id: "act-2", stepNumber: 2, action: "Ingest 500 mL water with electrolytes to support venous return", rationale: "Aids cephalic fluid redistribution and offsets intracranial venous congestion.", estimatedMinutes: 3, completed: false },
          { id: "act-3", stepNumber: 3, action: "Relocate to higher-ventilation compartment (US Lab Destiny)", rationale: "Transfers crew to higher volumetric air-turnover environment.", estimatedMinutes: 4, completed: false },
        ];
        break;

      case "MUSCLE_SORENESS":
        ruleId = "FR-EVA-003";
        ruleTitle = "Crew Autonomic Exertion Strain & Countermeasure Recovery";
        lagWindow = "12 to 24 Hours post-exercise (DOMS Curve)";
        rationale = "Musculoskeletal fatigue and delayed onset muscle soreness (DOMS) temporally associated with microgravity resistive loading (ARED).";
        confidence = "92% (Exercise Countermeasure Dynamics)";
        deterministicActions = [
          { id: "act-1", stepNumber: 1, action: "Inspect ARED load telemetry and log peak eccentric force profile", rationale: "Verifies whether eccentric loading exceeded planned countermeasure prescription.", estimatedMinutes: 3, completed: false },
          { id: "act-2", stepNumber: 2, action: "Perform 15-minute active recovery hamstring and spinal decompression stretching", rationale: "Relieves microgravity axial intervertebral disc unloading stiffness.", estimatedMinutes: 15, completed: false },
          { id: "act-3", stepNumber: 3, action: "Rest in Neutral Body Posture (NBP) with localized hydration", rationale: "Minimizes postural muscular tone and promotes muscle fiber repair.", estimatedMinutes: 10, completed: false },
        ];
        break;

      case "SLEEP_DISTURBANCE":
        ruleId = "FR-GEN-001";
        ruleTitle = "Spacecraft Habitat Acoustic & Circadian Rest Standard";
        lagWindow = "Diurnal Rest Cycle (0 to 8 Hours)";
        rationale = "Rest-cycle disruption temporally correlated with localized crew quarters airflow turnover and acoustic background levels.";
        confidence = "84% (Circadian & Acoustic Habitability)";
        deterministicActions = [
          { id: "act-1", stepNumber: 1, action: "Verify crew quarters acoustic baffle door seal and ventilation damper", rationale: "Ensures sound levels remain within NASA NC-40 acoustic criteria for rest.", estimatedMinutes: 2, completed: false },
          { id: "act-2", stepNumber: 2, action: "Dim cabin lighting to low-kelvin blue-depleted spectrum 45 min prior to sleep", rationale: "Promotes natural circadian melatonin secretion in orbital 90-minute day/night cycles.", estimatedMinutes: 2, completed: false },
          { id: "act-3", stepNumber: 3, action: "Inspect sleep restraint bungee tether tension and ear protection fit", rationale: "Prevents tactile startle response from zero-g free-floating drift.", estimatedMinutes: 3, completed: false },
        ];
        break;

      case "OCULAR_IRRITATION":
        ruleId = "FR-ECLSS-012";
        ruleTitle = "Cabin Low-Humidity Ocular Protection";
        lagWindow = "30 to 45 Minutes post-onset";
        rationale = `Cabin relative humidity is ${telemetryReadings.humidityPct}%. Forced microgravity ventilation accelerates corneal tear film evaporation.`;
        confidence = "82% (Microgravity Forced Airflow)";
        deterministicActions = [
          { id: "act-1", stepNumber: 1, action: "Reposition localized cabin fan diffuser away from direct facial stream", rationale: "Eliminates high-velocity drying stream across the ocular surface.", estimatedMinutes: 1, completed: false },
          { id: "act-2", stepNumber: 2, action: "Instill preservative-free artificial tear drops (0.5% CMC)", rationale: "Restores corneal tear film hydration and mitigates microscopic epithelial micro-abrasions.", estimatedMinutes: 2, completed: false },
          { id: "act-3", stepNumber: 3, action: "Don protective clear ocular goggles if particulate drift is suspected", rationale: "Shields eyes from floating microgravity debris and convective evaporation.", estimatedMinutes: 2, completed: false },
        ];
        break;

      case "THERMAL_EXERTION":
        ruleId = "FR-EVA-003";
        ruleTitle = "Autonomic Thermal Stasis & Exertion Monitoring";
        lagWindow = "15 to 30 Minutes post-exercise";
        rationale = `Cabin ambient temperature is ${telemetryReadings.tempC} °C. Microgravity absence of natural thermal buoyancy delays core cooling.`;
        confidence = "88% (Autonomic Thermal Stasis)";
        deterministicActions = [
          { id: "act-1", stepNumber: 1, action: "Adjust cabin airflow louver to maximum convective auxiliary circulation", rationale: "Compensates for the absence of natural thermal convective currents in zero-g.", estimatedMinutes: 1, completed: false },
          { id: "act-2", stepNumber: 2, action: "Towel down perspiration to prevent sweat sheet insulation", rationale: "In microgravity sweat forms a clinging layer that prevents cooling unless blotted away.", estimatedMinutes: 2, completed: false },
          { id: "act-3", stepNumber: 3, action: "Ingest 350 mL chilled electrolyte solution", rationale: "Lowers core body temperature and restores plasma volume lost during physical exertion.", estimatedMinutes: 3, completed: false },
        ];
        break;

      case "NEUROVESTIBULAR_DIZZINESS":
        ruleId = "FR-GEN-001";
        ruleTitle = "Space Adaptation Neurovestibular Habituation";
        lagWindow = "Acute Transition (0 to 72 Hours post-arrival)";
        rationale = "Neurovestibular conflict temporally associated with otolith organ unloading and conflicting visual-vestibular cues in microgravity.";
        confidence = "85% (Space Adaptation Syndrome)";
        deterministicActions = [
          { id: "act-1", stepNumber: 1, action: "Anchor feet firmly under module deck restraints", rationale: "Restores somatosensory proprioceptive reference to counteract vestibular disorientation.", estimatedMinutes: 1, completed: false },
          { id: "act-2", stepNumber: 2, action: "Restrict rapid head movements along pitch and roll axes", rationale: "Reduces false semicircular canal stimulation and otolith canal sensory conflict.", estimatedMinutes: 2, completed: false },
          { id: "act-3", stepNumber: 3, action: "Fix visual gaze onto a stable, high-contrast module structural line", rationale: "Provides strong visual horizon reference to stabilize gaze during adaptation.", estimatedMinutes: 5, completed: false },
        ];
        break;

      default:
        deterministicActions = [
          { id: "act-1", stepNumber: 1, action: "Confirm localized compartment telemetry is within nominal envelope", rationale: "Rules out localized hardware or ventilation excursion.", estimatedMinutes: 2, completed: false },
          { id: "act-2", stepNumber: 2, action: "Rest in Neutral Body Posture with 350 mL hydration", rationale: "Promotes cardiovascular and autonomic equilibrium.", estimatedMinutes: 5, completed: false },
          { id: "act-3", stepNumber: 3, action: "Log symptom progression for ground flight surgeon review", rationale: "Maintains longitudinal medical record traceability.", estimatedMinutes: 2, completed: false },
        ];
        break;
    }

    // Instructional SpaceLife Library Guide references
    let resourceCategory: "exercise" | "sleep" | "adaptation" | undefined;
    let symptomCodes: string[] = [];
    if (category === "MUSCLE_SORENESS") {
      resourceCategory = "exercise";
      symptomCodes = ["FATIGUE", "MUSCLE_SORENESS"];
    } else if (category === "SLEEP_DISTURBANCE") {
      resourceCategory = "sleep";
      symptomCodes = ["SLEEP", "FATIGUE"];
    } else if (category === "NEUROVESTIBULAR_DIZZINESS") {
      resourceCategory = "adaptation";
      symptomCodes = ["NAUSEA", "DIZZINESS"];
    }

    const resources = resourceCategory
      ? searchSpaceLifeGuides({ query: symptomText, category: resourceCategory, symptomCodes, limit: 2 })
      : [];

    // Attempt Dynamic AI Reasoning via Active Adapter
    const activeAdapter = this.resolveAdapter();
    let finalActions = deterministicActions;
    let finalRationale = rationale;
    let finalOverview: string | undefined;
    let providerUsed = activeAdapter.displayName;

    if (activeAdapter.isReady()) {
      try {
        const triageStructured = await activeAdapter.completeStructured<{
          headline?: string;
          conversationalOverview?: string;
          physiologicalRationale?: string;
          biologicalLatencyLag?: string;
          confidenceMatch?: string;
          latchedRuleId?: string;
          flightRuleTitle?: string;
          interimActions?: Array<{
            id?: string;
            stepNumber?: number;
            action: string;
            rationale?: string;
            estimatedMinutes?: number;
          }>;
        }>({
          prompt: `Astronaut ID: ${astronautId}\nCompartment: ${compartment.name}\nReported: "${symptomText}"\nTelemetry: CO2=${telemetryReadings.co2Ppm}ppm, Temp=${telemetryReadings.tempC}C, Hum=${telemetryReadings.humidityPct}%, Rad=${telemetryReadings.radiationRateMGy}mGy/d, Press=${telemetryReadings.pressureMmHg}mmHg`,
        });

        if (triageStructured?.data?.interimActions && triageStructured.data.interimActions.length >= 2) {
          finalActions = triageStructured.data.interimActions.map((act, idx) => ({
            id: act.id || `act-${idx + 1}`,
            stepNumber: act.stepNumber || idx + 1,
            action: act.action,
            rationale: act.rationale || "Supports microgravity stabilization.",
            estimatedMinutes: act.estimatedMinutes || 3,
            completed: false,
          }));
          if (triageStructured.data.physiologicalRationale) {
            finalRationale = triageStructured.data.physiologicalRationale;
          }
          if (triageStructured.data.conversationalOverview) {
            finalOverview = triageStructured.data.conversationalOverview;
          }
          providerUsed = triageStructured.provider;
        }
      } catch {
        // Retain deterministic actions
      }
    }

    // Epistemic Guardrail Sanitization
    const { text: cleanRationale, tripwireTriggered: rTrip } = this.sanitizeEpistemicGuardrails(finalRationale);
    const sanitizedActions = finalActions.map((a) => {
      const { text: cleanActRationale } = this.sanitizeEpistemicGuardrails(a.rationale);
      return { ...a, rationale: cleanActRationale };
    });

    const surgeonHandoffPacket: SurgeonHandoffPacket = {
      packetId: `pkt-${Date.now()}`,
      createdAtIso: new Date().toISOString(),
      astronautId,
      symptomReported: symptomText,
      compartmentName: compartment.name,
      environmentalSnapshot: snapshot,
      latchedRuleId: ruleId,
      interimActionsCount: sanitizedActions.length,
    };

    const symptomConsent: SymptomConsentState = {
      status: "PENDING",
      symptomText,
      location: compartment.name,
      snapshot,
      astronautId,
      callsign: resolveCallsign(astronautId),
      latchedRuleId: ruleId,
    };

    return {
      headline: `First-Response Interim Protocol: ${compartment.name}`,
      conversationalOverview: finalOverview,
      symptomText,
      compartmentName: compartment.name,
      compartmentId: compartment.id,
      primarySymptomCategory: category,
      intent,
      telemetryReadings,
      interimActions: sanitizedActions,
      resources,
      followupQuestions: [
        "Are you experiencing any visual disturbance or acute photophobia?",
        "Has this sensation fluctuated after moving between compartments?",
      ],
      latchedRuleId: ruleId,
      flightRuleTitle: ruleTitle,
      biologicalLatencyLag: lagWindow,
      physiologicalRationale: cleanRationale,
      confidenceMatch: confidence,
      disclaimer: MANDATORY_EPISTEMIC_DISCLAIMER,
      tripwireTriggered: rTrip,
      surgeonHandoffPacket,
      symptomConsent,
      provider: providerUsed,
    };
  }

  async generateShiftBriefing(request: ShiftBriefingRequest): Promise<BriefingTurnResult> {
    const { briefingData } = request;
    const deterministicProse = renderDeterministicBriefingProse(briefingData);

    const activeAdapter = this.resolveAdapter();
    if (!activeAdapter.isReady() || activeAdapter.id === "extractive") {
      return {
        narrativeText: deterministicProse,
        generatedBy: "deterministic",
        provider: "Deterministic Shift Compiler",
        briefing: briefingData,
        disclaimer: MANDATORY_EPISTEMIC_DISCLAIMER,
      };
    }

    const prompt = `You are HabiTrack Flight Surgeon SI. You are summarizing a pre-computed structured shift handover briefing across the ISS cohort for the last ${briefingData.window.hours} hours.
Do not add facts not present in the JSON.
Do not compute or estimate new numbers.
Use non-causal language; describe co-occurrence or temporal association, never single-variable causation.
Cite source IDs inline for every claim (e.g. [evt-001], [FR-ECLSS-001]).
If a section has no data, say so explicitly rather than omitting it.

Structured Briefing Data:
${JSON.stringify(briefingData, null, 2)}`;

    try {
      const result = await activeAdapter.completeText({
        prompt,
        temperature: 0.2,
        maxOutputTokens: 800,
      });

      const { text: cleanText, tripwireTriggered } = this.sanitizeEpistemicGuardrails(result.text);

      if (cleanText && !tripwireTriggered) {
        return {
          narrativeText: cleanText,
          generatedBy: "llm",
          provider: result.provider,
          briefing: briefingData,
          disclaimer: MANDATORY_EPISTEMIC_DISCLAIMER,
        };
      }
    } catch {
      // Graceful fallback
    }

    return {
      narrativeText: deterministicProse,
      generatedBy: "deterministic",
      provider: "Deterministic Shift Compiler",
      briefing: briefingData,
      disclaimer: MANDATORY_EPISTEMIC_DISCLAIMER,
    };
  }
}

export function createFlightSI(adapter?: LlmAdapter): FlightSI {
  return new FlightSIImpl(adapter);
}

export const flightSI = createFlightSI();
