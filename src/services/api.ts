/**
 * Pure TypeScript In-Browser API & Data Service for HabiTrack.
 *
 * Runs 100% client-side with zero external backend or Python server dependencies,
 * making the application completely hostable on Vercel, Netlify, or static CDN.
 */

import researchChunksRaw from "../data/researchChunks.json" with { type: "json" };
import officialNasaGuidesRaw from "../data/officialNasaGuides.json" with { type: "json" };
import { flightSI } from "./ai/core/FlightSI.ts";
import { generateGeminiRagResponse } from "./ai/geminiClient.ts";
import { generateUnifiedRagResponse, type SIModelMode, type AIModelMode } from "./ai/aiProvider.ts";
import { generate180DayTelemetry, generate180DayEvents } from "./telemetryGenerator.ts";
import { getActiveMissionTimeMs, useMissionStore } from "../stores/missionStore.ts";
import type { LibraryGuide, GuideCategory, NasaMediaItem } from "../types/library";
import { getImportedHuaweiMeasurements } from "./healthImportStorage.ts";
import { searchSpaceLifeGuides } from "../mastra/tools/spaceLifeLibraryTool.ts";
import type {
  AssistantResponse,
  Astronaut,
  Baselines,
  CitedEvidence,
  FlightRule,
  HealthEvent,
  HealthStatus,
  Measurement,
  ProviderStatusResponse,
  ReviewStatus,
  SeverityLevel,
  SymptomReport,
  SymptomReportRequest,
} from "../types/api";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RawChunk {
  chunk_id: string;
  doc_id: string;
  title: string;
  authors: string | null;
  report_identifier: string | null;
  section_heading: string;
  content: string;
  doi_citation: string | null;
  source_repository: string;
}

const researchChunks = researchChunksRaw as RawChunk[];

interface SeedDataStructure {
  health: HealthStatus;
  astronauts: Astronaut[];
  flightRules: FlightRule[];
  events: HealthEvent[];
  symptoms: SymptomReport[];
  providerStatus: ProviderStatusResponse;
  baselines: Record<string, Baselines>;
  measurements: Record<string, Measurement[]>;
}

let seedDataCache: SeedDataStructure | null = null;
let seedDataPromise: Promise<SeedDataStructure> | null = null;

const MANDATORY_DISCLAIMER =
  "Non-Causal Decision Support Disclaimer: Temporal correlation indicates " +
  "co-occurrence only and does not establish clinical causation. HabiTrack " +
  "is a clinical decision-support tool, not an autonomous diagnostic system. " +
  "Operational countermeasure decisions must be verified by flight surgeons.";

async function loadSeedData(): Promise<SeedDataStructure> {
  if (seedDataCache) {
    return seedDataCache;
  }
  if (!seedDataPromise) {
    seedDataPromise = (async () => {
      try {
        if (typeof window === "undefined" && typeof (globalThis as any).process !== "undefined") {
          const modFs: any = await new Function('return import("node:fs/promises")')();
          const modPath: any = await new Function('return import("node:path")')();
          const cwd = (globalThis as any).process.cwd();
          const filePath = modPath.resolve(cwd, "public/data/seedData.json");
          const raw = await modFs.readFile(filePath, "utf-8");
          const data = JSON.parse(raw) as SeedDataStructure;
          seedDataCache = data;
          return data;
        }

        const response = await fetch("/data/seedData.json");
        if (!response.ok) {
          throw new Error(`Failed to load /data/seedData.json (${response.status})`);
        }
        const data = (await response.json()) as SeedDataStructure;
        seedDataCache = data;
        return data;
      } catch (err) {
        console.warn("Direct fetch of /data/seedData.json failed; attempting relative fallback", err);
        const response = await fetch("./data/seedData.json");
        const data = (await response.json()) as SeedDataStructure;
        seedDataCache = data;
        return data;
      }
    })();
  }
  return seedDataPromise;
}

// Local storage keys for persisting user mutations in browser
const STORAGE_KEYS = {
  EVENT_REVIEWS: "habitrack_event_reviews_v1",
  SYMPTOMS: "habitrack_symptoms_v1",
  SYMPTOM_REVIEWS: "habitrack_symptom_reviews_v1",
};

interface StoredReview {
  review_status: ReviewStatus;
  review_notes: string | null;
}

interface StoredSymptomReview {
  review_status: ReviewStatus;
  reviewed_at: string;
  reviewed_by: string;
  review_notes?: string | null;
}

function getStoredReviews(): Record<string, StoredReview> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EVENT_REVIEWS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredReviews(reviews: Record<string, StoredReview>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.EVENT_REVIEWS, JSON.stringify(reviews));
  } catch (e) {
    console.warn("Failed to persist event review to localStorage", e);
  }
}

function getStoredSymptomReviews(): Record<string, StoredSymptomReview> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SYMPTOM_REVIEWS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredSymptomReviews(reviews: Record<string, StoredSymptomReview>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SYMPTOM_REVIEWS, JSON.stringify(reviews));
  } catch (e) {
    console.warn("Failed to persist symptom reviews to localStorage", e);
  }
}

function getStoredSymptoms(): SymptomReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SYMPTOMS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredSymptoms(symptoms: SymptomReport[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SYMPTOMS, JSON.stringify(symptoms));
  } catch (e) {
    console.warn("Failed to persist symptoms to localStorage", e);
  }
}

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// -----------------------------------------------------------------------------
// PUBLIC API IMPLEMENTATION (100% TypeScript)
// -----------------------------------------------------------------------------

async function checkOllamaOnline(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  // Try via local dev proxy first, then direct port fallback
  const endpoints = ["/api/ollama/api/tags", "http://127.0.0.1:11434/api/tags", "http://localhost:11434/api/tags"];
  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        return true;
      }
    } catch {
      // Continue to next endpoint fallback
    }
  }
  return false;
}

export async function fetchHealth(): Promise<HealthStatus> {
  const seed = await loadSeedData();
  const isOllamaOnline = await checkOllamaOnline();
  return {
    ...seed.health,
    version: "3.2.0-ts-client",
    vector_store_chunks: researchChunks.length,
    ollama_online: isOllamaOnline,
  };
}

export async function fetchAstronauts(): Promise<Astronaut[]> {
  const seed = await loadSeedData();
  return seed.astronauts;
}

export async function fetchAstronaut(astronautId: string): Promise<Astronaut> {
  const seed = await loadSeedData();
  const astro = seed.astronauts.find(
    (a) => a.astronaut_id.toLowerCase() === astronautId.toLowerCase()
  );
  if (!astro) {
    throw new ApiError(404, `Astronaut not found: ${astronautId}`);
  }
  return astro;
}

export async function fetchMeasurements(
  astronautId: string,
  windowHours = 4320,
  maxPoints = 20000
): Promise<Measurement[]> {
  const [importedHuawei] = await Promise.all([
    getImportedHuaweiMeasurements(astronautId).catch(() => [] as Measurement[]),
  ]);

  const records = generate180DayTelemetry({
    astronautId,
    nowMs: Date.now(),
    durationDays: 180,
  });

  if (records.length === 0) return importedHuawei;
  const newestTime = new Date(records[records.length - 1].timestamp).getTime();
  const cutoffTime = newestTime - windowHours * 60 * 60 * 1000;

  const filtered = records.filter(
    (m) => new Date(m.timestamp).getTime() >= cutoffTime
  );

  let result = filtered;
  if (filtered.length > maxPoints) {
    const step = Math.ceil(filtered.length / maxPoints);
    const downsampled: Measurement[] = [];
    for (let i = 0; i < filtered.length; i += step) {
      downsampled.push(filtered[i]);
    }
    result = downsampled;
  }

  return importedHuawei.length > 0 ? [...result, ...importedHuawei] : result;
}

export async function fetchBaselines(astronautId: string): Promise<Baselines> {
  const seed = await loadSeedData();
  const baselines = seed.baselines[astronautId] ?? seed.baselines["ASTRO-01"] ?? {};
  return baselines as unknown as Baselines;
}

export async function fetchEvents(
  astronautId?: string,
  severity?: SeverityLevel
): Promise<HealthEvent[]> {
  const activeTimeMs = getActiveMissionTimeMs();
  const storedReviews = getStoredReviews();
  const liveEvents = generate180DayEvents(astronautId || "ASTRO-01", activeTimeMs);

  let events = liveEvents.map((evt) => {
    const review = storedReviews[evt.event_id];
    if (review) {
      return {
        ...evt,
        review_status: review.review_status,
        review_notes: review.review_notes,
      };
    }
    return evt;
  });

  if (astronautId) {
    events = events.filter(
      (e) => e.astronaut_id.toLowerCase() === astronautId.toLowerCase()
    );
  }
  if (severity) {
    events = events.filter((e) => e.severity_level === severity);
  }

  return events;
}

export async function reviewEvent(
  eventId: string,
  reviewStatus: ReviewStatus,
  reviewNotes?: string | null
): Promise<HealthEvent> {
  const seed = await loadSeedData();
  const evt = seed.events.find((e) => e.event_id === eventId);
  if (!evt) {
    throw new ApiError(404, `Event not found: ${eventId}`);
  }

  const stored = getStoredReviews();
  stored[eventId] = {
    review_status: reviewStatus,
    review_notes: reviewNotes ?? null,
  };
  saveStoredReviews(stored);

  return {
    ...evt,
    review_status: reviewStatus,
    review_notes: reviewNotes ?? null,
  };
}

export async function fetchSymptoms(astronautId?: string): Promise<SymptomReport[]> {
  const seed = await loadSeedData();
  const custom = getStoredSymptoms();
  const reviews = getStoredSymptomReviews();

  let list = [...seed.symptoms, ...custom].map((s) => {
    const rev = reviews[s.report_id];
    if (rev) {
      return {
        ...s,
        review_status: rev.review_status,
        reviewed_at: rev.reviewed_at,
        reviewed_by: rev.reviewed_by,
        review_notes: rev.review_notes,
      };
    }
    return {
      ...s,
      review_status: s.review_status ?? ("PENDING" as ReviewStatus),
    };
  });

  if (astronautId) {
    list = list.filter(
      (s) => s.astronaut_id.toLowerCase() === astronautId.toLowerCase()
    );
  }

  // When in simulation mode, filter symptoms up to the current synchronized mission clock
  const { mode } = useMissionStore.getState();
  if (mode === "simulation") {
    const activeTimeMs = getActiveMissionTimeMs();
    list = list.filter((s) => new Date(s.occurred_at).getTime() <= activeTimeMs);
  }

  // Sort newest first
  list.sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  );
  return list;
}

export async function submitSymptom(payload: SymptomReportRequest): Promise<SymptomReport> {
  const activeTimeMs = getActiveMissionTimeMs();
  const now = new Date(activeTimeMs).toISOString();
  const report: SymptomReport = {
    report_id: generateUuid(),
    astronaut_id: payload.astronaut_id,
    symptom_code: payload.symptom_code,
    severity: payload.severity,
    occurred_at: payload.occurred_at ?? now,
    reported_at: now,
    cabin_module: payload.cabin_module ?? null,
    notes: payload.notes ?? null,
    is_synthetic: false,
    review_status: "PENDING",
  };

  const stored = getStoredSymptoms();
  stored.unshift(report);
  saveStoredSymptoms(stored);

  return report;
}

export async function acknowledgeSymptom(
  reportId: string,
  reviewedBy: string = "Flight Surgeon (Surgeon Console)",
  reviewNotes?: string | null
): Promise<SymptomReport | null> {
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " UTC";
  const reviews = getStoredSymptomReviews();
  reviews[reportId] = {
    review_status: "ACKNOWLEDGED",
    reviewed_at: now,
    reviewed_by: reviewedBy,
    review_notes: reviewNotes ?? null,
  };
  saveStoredSymptomReviews(reviews);

  // Also update habitrack_symptoms_v1 if present
  const storedSymptoms = getStoredSymptoms();
  const idx = storedSymptoms.findIndex((s) => s.report_id === reportId);
  if (idx !== -1) {
    storedSymptoms[idx] = {
      ...storedSymptoms[idx],
      review_status: "ACKNOWLEDGED",
      reviewed_at: now,
      reviewed_by: reviewedBy,
      review_notes: reviewNotes ?? null,
    };
    saveStoredSymptoms(storedSymptoms);
  }

  // Also synchronize to local diary habitrack_symptom_diary_v3
  try {
    const rawDiary = localStorage.getItem("habitrack_symptom_diary_v3");
    if (rawDiary) {
      interface DiarySyncItem {
        id: string;
        reviewStatus?: ReviewStatus;
        acknowledgedAt?: string;
        acknowledgedBy?: string;
        acknowledgmentNotes?: string | null;
      }
      const diary: DiarySyncItem[] = JSON.parse(rawDiary);
      const diaryIdx = diary.findIndex((d) => d.id === reportId);
      if (diaryIdx !== -1) {
        diary[diaryIdx] = {
          ...diary[diaryIdx],
          reviewStatus: "ACKNOWLEDGED",
          acknowledgedAt: now,
          acknowledgedBy: reviewedBy,
          acknowledgmentNotes: reviewNotes ?? null,
        };
        localStorage.setItem("habitrack_symptom_diary_v3", JSON.stringify(diary));
      }
    }
  } catch (err) {
    console.warn("Could not sync acknowledgment to local diary", err);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("habitrack_symptom_acknowledged", {
        detail: { reportId, reviewedBy, reviewedAt: now },
      })
    );
  }

  const all = await fetchSymptoms();
  return all.find((s) => s.report_id === reportId) ?? null;
}

const DOMAIN_SYNONYMS: Record<string, string[]> = {
  co2: ["co2", "carbon", "dioxide", "hypercapnia", "eclss", "cdra"],
  carbon: ["co2", "carbon", "dioxide", "hypercapnia"],
  dioxide: ["co2", "carbon", "dioxide", "hypercapnia"],
  hypercapnia: ["hypercapnia", "co2", "carbon", "dioxide", "headache"],
  headache: ["headache", "hypercapnia", "co2", "cephalad", "intracranial", "fluid"],
  radiation: ["radiation", "cosmic", "gcr", "spe", "ionizing", "biomarkers"],
  rad: ["radiation", "cosmic", "gcr", "spe", "ionizing"],
  sleep: ["sleep", "circadian", "desynchrony", "fatigue", "insomnia"],
  circadian: ["circadian", "sleep", "desynchrony", "misalignment"],
  heart: ["heart", "cardio", "cardiovascular", "hemodynamic", "baroreceptor", "tachycardia"],
  cardio: ["cardio", "cardiovascular", "heart", "hemodynamic", "remodeling"],
  cardiovascular: ["cardiovascular", "cardio", "heart", "hemodynamic", "remodeling"],
  eva: ["eva", "extravehicular", "suit", "cooling", "tachycardia"],
  eclss: ["eclss", "cdra", "ventilation", "co2", "carbon"],
  cdra: ["cdra", "desiccant", "zeolite", "thermal", "bed"],
};

function formatChunkToEvidence(chunk: RawChunk, idx: number, relevancePct = 90): CitedEvidence {
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
    rrf_score: parseFloat(Math.max(0.4, 0.88 - idx * 0.04).toFixed(3)),
    relevance_pct: Math.min(99, Math.max(68, relevancePct)),
  };
}

export function searchResearchChunks(queryText: string, topK = 4): CitedEvidence[] {
  const trimmed = queryText.trim().toLowerCase();
  if (!trimmed) {
    return researchChunks.slice(0, topK).map((c, i) => formatChunkToEvidence(c, i, 95 - i * 2));
  }

  const rawTokens = trimmed
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  if (rawTokens.length === 0) {
    return researchChunks.slice(0, topK).map((c, i) => formatChunkToEvidence(c, i, 90));
  }

  const expandedTokens = new Set<string>();
  for (const token of rawTokens) {
    expandedTokens.add(token);
    const syns = DOMAIN_SYNONYMS[token];
    if (syns) {
      syns.forEach((s) => expandedTokens.add(s));
    }
  }

  const scored = researchChunks.map((chunk) => {
    let score = 0;
    const docIdLower = (chunk.doc_id || "").toLowerCase();
    const reportLower = (chunk.report_identifier || "").toLowerCase();
    const titleLower = chunk.title.toLowerCase();
    const secLower = chunk.section_heading.toLowerCase();
    const contentLower = chunk.content.toLowerCase();

    for (const token of expandedTokens) {
      if (docIdLower.includes(token)) score += 5;
      if (reportLower.includes(token)) score += 5;
      if (titleLower.includes(token)) score += 5;
      if (secLower.includes(token)) score += 3;
      if (contentLower.includes(token)) score += 2;
    }

    return { chunk, score };
  });

  const matched = scored.filter((s) => s.score >= 1);
  if (matched.length === 0) {
    return [];
  }

  matched.sort((a, b) => b.score - a.score);
  const selected = matched.slice(0, topK);

  return selected.map(({ chunk, score }, idx) => {
    const maxPossible = Math.max(rawTokens.length * 5, 5);
    const rawPct = Math.round((score / maxPossible) * 100);
    const relevancePct = Math.min(99, Math.max(68, rawPct));
    return formatChunkToEvidence(chunk, idx, relevancePct);
  });
}

export async function explainEvent(
  eventId: string,
  astronautId: string
): Promise<AssistantResponse> {
  const seed = await loadSeedData();
  const evt = seed.events.find((e) => e.event_id === eventId);

  let flightRule = seed.flightRules[0];
  let queryText = "co2 hypercapnia headache heart rate autonomic shift";

  if (evt) {
    if (evt.contributing_stream_ids.includes("co2") || evt.event_type.includes("CO2")) {
      flightRule = seed.flightRules.find((r) => r.rule_id === "FR-ECLSS-001") ?? flightRule;
      queryText = "elevated co2 hypercapnia headache cephalic fluid shift";
    } else if (evt.contributing_stream_ids.includes("temp") || evt.event_type.includes("CDRA")) {
      flightRule = seed.flightRules.find((r) => r.rule_id === "FR-CDRA-002") ?? flightRule;
      queryText = "cdra thermal regeneration desiccant bed temperature";
    } else if (evt.event_type.includes("EXERTION") || evt.event_type.includes("AUTONOMIC")) {
      flightRule = seed.flightRules.find((r) => r.rule_id === "FR-EVA-003") ?? flightRule;
      queryText = "exercise heart rate autonomic strain cardiovascular remodeling";
    }
  }

  const evidence = searchResearchChunks(queryText, 3);
  const headline = evt
    ? `Concordance Analysis: ${evt.event_type.replace(/_/g, " ")} (${evt.severity_level})`
    : `Event Telemetry Correlation Analysis: ${eventId}`;

  let answerText: string | null = null;
  let providerUsed = "Gemini 2.5 Flash (Direct Browser Execution)";
  let mode: "GEMINI_GENERATIVE" | "EXTRACTIVE_FALLBACK" = "GEMINI_GENERATIVE";

  try {
    const geminiRes = await generateGeminiRagResponse(
      `Explain event ${eventId} (${evt?.event_type || "TELEMETRY_EXCURSION"}): ${evt?.rationale || "Sensor excursion observed"}. Contributing streams: ${evt?.contributing_stream_ids || "autonomic"}.`,
      evidence,
      astronautId
    );
    answerText = geminiRes.answer;
    providerUsed = geminiRes.provider;
  } catch (err) {
    console.warn("Direct Gemini execution unavailable, falling back to dynamic synthesizer:", err);
    mode = "EXTRACTIVE_FALLBACK";
    providerUsed = "Mastra Onboard First-Response Engine (Pure TypeScript)";
    answerText = `**${headline}**\n\nTelemetry correlation observed for ${astronautId}. Contributing streams: ${evt?.contributing_stream_ids || "vitals"}. Operational triage status: ${evt?.review_status || "PENDING_REVIEW"}.\n\n${
      evidence.length > 0
        ? evidence.map((e) => `• [${e.doc_id}: ${e.section_heading}] ${e.excerpt}`).join("\n\n")
        : "Circadian baseline comparison indicates transient autonomic fluctuation within observed operational bounds."
    }`;
  }

  const observedDynamics = evt
    ? `Telemetry correlation observed for ${astronautId}. Contributing streams: ${evt.contributing_stream_ids}. Operational triage status: ${evt.review_status}.`
    : `Sensor telemetry excursion recorded for ${astronautId}. Circadian baseline deviations detected across autonomic and environmental channels.`;

  const scientificContext =
    evidence.length > 0
      ? evidence.map((e) => `[${e.doc_id}: ${e.section_heading}] ${e.excerpt}`).join(" ")
      : "Circadian baseline comparison indicates transient autonomic fluctuation within observed operational bounds.";

  return {
    interaction_id: generateUuid(),
    astronaut_id: astronautId,
    event_id: eventId,
    mode,
    headline,
    observed_dynamics: observedDynamics,
    scientific_context: scientificContext,
    cited_evidence: evidence,
    study_caveats: [
      "Terrestrial head-down tilt bed-rest models exhibit slower fluid redistribution than true microgravity cephalic shift.",
      "Individual autonomic reactivity and PCO2 sensitivity vary based on workload and sleep disruption.",
    ],
    disclaimer: MANDATORY_DISCLAIMER,
    tripwire_triggered: false,
    latency_ms: 18,
    flight_rule_cited: flightRule,
    verbatim_checklist: flightRule?.checklist_steps ?? [],
    provider_used: providerUsed,
    answer: answerText,
  };
}

export async function queryAssistant(
  text: string,
  topK = 5,
  astronautId?: string | null,
  concordanceEventId?: string | null,
  history?: Array<{ role: "user" | "model"; text: string }>,
  telemetryContext?: {
    co2Ppm: number;
    tempC: number;
    humidityPct: number;
    radiationRateMGy: number;
    pressureMmHg: number;
    compartment?: string;
  } | null
): Promise<AssistantResponse> {
  const result = await flightSI.interact({
    query: text,
    astronautId,
    concordanceEventId,
    history,
    telemetryContext,
  });

  return result.rawResponse!;
}

export async function fetchFlightRules(
  subsystem?: string,
  severity?: string
): Promise<FlightRule[]> {
  const seed = await loadSeedData();
  let rules = seed.flightRules;
  if (subsystem) {
    rules = rules.filter((r) => r.subsystem.toLowerCase().includes(subsystem.toLowerCase()));
  }
  if (severity) {
    rules = rules.filter((r) => r.severity_trigger.toLowerCase() === severity.toLowerCase());
  }
  return rules;
}

export async function fetchFlightRule(ruleId: string): Promise<FlightRule> {
  const seed = await loadSeedData();
  const rule = seed.flightRules.find(
    (r) => r.rule_id.toLowerCase() === ruleId.toLowerCase()
  );
  if (!rule) {
    throw new ApiError(404, `Flight rule not found: ${ruleId}`);
  }
  return rule;
}

export async function fetchProviderStatus(): Promise<ProviderStatusResponse> {
  return {
    active_provider: "Mastra Pure TypeScript Agent",
    gemini_available: true,
    ollama_available: false,
    gemini_audio_testing_enabled: false,
    active_model_name: "HabiTrack Standby SI",
  };
}

const officialGuides = officialNasaGuidesRaw as LibraryGuide[];

export async function fetchLibraryGuides(
  category?: GuideCategory | "all",
  query?: string
): Promise<LibraryGuide[]> {
  let guides = [...officialGuides];
  if (category && category !== "all") {
    guides = guides.filter((g) => g.category === category);
  }
  if (query && query.trim()) {
    const q = query.toLowerCase().trim();
    guides = guides.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.summary.toLowerCase().includes(q) ||
        g.nasaDocumentId.toLowerCase().includes(q) ||
        g.instructions.some((ins) => ins.toLowerCase().includes(q)) ||
        g.relatedSymptomCodes?.some((code) => code.toLowerCase().includes(q))
    );
  }
  return guides;
}

export async function fetchLibraryGuideById(id: string): Promise<LibraryGuide | null> {
  const guide = officialGuides.find((g) => g.id === id);
  return guide ?? null;
}

const nasaSearchCache = new Map<string, NasaMediaItem[]>();
const nasaMediaUrlCache = new Map<string, string>();

export async function searchNasaMediaLibrary(
  query: string,
  mediaType: "video" | "image" | "all" = "all"
): Promise<NasaMediaItem[]> {
  const cleanQ = query.trim() || "iss astronaut";
  const typeParam = mediaType === "all" ? "video,image" : mediaType;
  const cacheKey = `${cleanQ}:${typeParam}`;
  if (nasaSearchCache.has(cacheKey)) {
    return nasaSearchCache.get(cacheKey)!;
  }

  const endpoint = `https://images-api.nasa.gov/search?q=${encodeURIComponent(cleanQ)}&media_type=${typeParam}`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`NASA Image and Video Library query failed (${response.status})`);
  }
  const data = await response.json();
  const rawItems = data.collection?.items ?? [];

  const results: NasaMediaItem[] = [];
  for (const item of rawItems.slice(0, 24)) {
    const datum = item.data?.[0];
    if (!datum) continue;
    const previewLink = item.links?.find((l: any) => l.rel === "preview")?.href;
    const thumb = previewLink ? previewLink.replace(/^http:/, "https:") : "";

    results.push({
      nasaId: datum.nasa_id,
      title: datum.title || "NASA Media Asset",
      description: datum.description || datum.secondary_creator || "",
      mediaType: datum.media_type === "video" ? "video" : "image",
      dateCreated: datum.date_created ? datum.date_created.slice(0, 10) : "",
      center: datum.center,
      thumbnailUrl: thumb,
      collectionUrl: item.href ? item.href.replace(/^http:/, "https:") : "",
    });
  }

  nasaSearchCache.set(cacheKey, results);
  return results;
}

export async function resolveNasaMediaDirectUrl(item: NasaMediaItem): Promise<string> {
  if (nasaMediaUrlCache.has(item.collectionUrl)) {
    return nasaMediaUrlCache.get(item.collectionUrl)!;
  }
  if (!item.collectionUrl) {
    return item.thumbnailUrl;
  }

  try {
    const res = await fetch(item.collectionUrl);
    if (!res.ok) throw new Error("Collection fetch failed");
    const files: string[] = await res.json();

    let resolved = "";
    if (item.mediaType === "video") {
      // Upgraded crisp 720p HD resolution without the 200MB+ ~orig.mp4 lag
      const medium = files.find((f) => f.includes("~medium.mp4"));
      const small = files.find((f) => f.includes("~small.mp4"));
      const preview = files.find((f) => f.includes("~preview.mp4"));
      const mobile = files.find((f) => f.includes("~mobile.mp4"));
      const anyMp4 = files.find((f) => f.endsWith(".mp4") && !f.includes("~orig.mp4"));
      resolved = medium || small || preview || mobile || anyMp4 || files[0] || "";
    } else {
      const medium = files.find((f) => f.includes("~medium.jpg"));
      const large = files.find((f) => f.includes("~large.jpg"));
      const orig = files.find((f) => f.includes("~orig.jpg"));
      const anyJpg = files.find((f) => f.endsWith(".jpg") || f.endsWith(".png"));
      resolved = medium || large || orig || anyJpg || files[0] || "";
    }

    if (resolved) {
      resolved = resolved.replace(/^http:/, "https:");
      nasaMediaUrlCache.set(item.collectionUrl, resolved);
      return resolved;
    }
    return item.thumbnailUrl;
  } catch (err) {
    console.warn("Failed to resolve NASA direct URL, falling back to thumbnail", err);
    return item.thumbnailUrl;
  }
}


