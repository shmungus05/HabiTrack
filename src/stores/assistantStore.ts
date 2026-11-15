/**
 * web/src/stores/assistantStore.ts: Unified Standby SI chatbot conversation thread,
 * Mastra 5-factor clinical triage engine, push-to-talk voice state,
 * flight rule latching, and cross-crew context isolation.
 */

import { create } from "zustand";

import {
  explainEvent,
  fetchFlightRule,
  fetchProviderStatus,
  queryAssistant,
  submitSymptom,
} from "../services/api";
import { mastra } from "../mastra";
import {
  cancelSpeech,
  playQuindarTone,
  speakText,
  type VoicePersona,
} from "../lib/speech";
import type {
  AssistantResponse,
  FlightRule,
  HealthEvent,
  ProviderStatusResponse,
  SpaceCareResourceReference,
} from "../types/api";
import { useCohortStore } from "./cohortStore";
import { useRoleStore } from "./roleStore";
import {
  fetchAndBuildShiftHandover,
  renderDeterministicBriefingProse,
  type ShiftHandoverBriefing,
} from "../features/handover";
import { flightSI } from "../services/ai/core/FlightSI";
import { containsProhibitedCausalTerms } from "../features/health-report/healthReportCompiler";
import { generateGeminiRagResponse } from "../services/ai/geminiClient";
import type { SIModelMode, AIModelMode } from "../services/ai/aiProvider";
import {
  checkWebGpuSupport,
  initLocalModel,
  isLocalModelReady,
  unloadLocalModel as unloadWebLlm,
  type LocalModelStatus,
} from "../services/ai/localModelService";
import {
  checkOllamaStatus,
  loadOllamaModel,
} from "../services/ai/ollamaClient";

export type PttState = "IDLE" | "LISTENING" | "PROCESSING";
export type AssistantTab = "chat" | "checklists" | "evidence";

export interface InterimActionItem {
  id: string;
  stepNumber: number;
  action: string;
  rationale: string;
  estimatedMinutes: number;
  completed: boolean;
}

export interface SurgeonHandoffPacket {
  packetId: string;
  createdAtIso: string;
  astronautId: string;
  symptomReported: string;
  compartmentName: string;
  environmentalSnapshot: {
    co2Ppm: number;
    tempC: number;
    humidityPct: number;
    radiationRateMGy: number;
    pressureMmHg: number;
  };
  latchedRuleId: string;
  interimActionsCount: number;
}

export interface TelemetrySnapshot {
  co2Ppm: number;
  tempC: number;
  humidityPct: number;
  radiationRateMGy: number;
  pressureMmHg: number;
}

export interface SymptomConsentState {
  status: "PENDING" | "CONFIRMED" | "DISMISSED";
  symptomText: string;
  location: string;
  snapshot: TelemetrySnapshot;
  astronautId: string;
  callsign?: string;
  latchedRuleId?: string;
  confirmedAt?: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  provider?: string | null;
  response?: AssistantResponse;
  location?: string;
  snapshot?: TelemetrySnapshot;
  interimActions?: InterimActionItem[];
  lagWindow?: string;
  latchedRuleId?: string;
  flightRuleTitle?: string;
  confidenceMatch?: string;
  disclaimer?: string;
  surgeonHandoffPacket?: SurgeonHandoffPacket;
  symptomConsent?: SymptomConsentState;
  resources?: SpaceCareResourceReference[];
  followupQuestions?: string[];
  intent?: string;
  shiftHandover?: ShiftHandoverBriefing;
}

interface AssistantState {
  isOpen: boolean;
  isLoading: boolean;
  activeTab: AssistantTab;
  pttState: PttState;
  speechTranscript: string;
  messages: ChatMessage[];
  activeEvent: HealthEvent | null;
  activeExplanation: AssistantResponse | null;
  latchedRule: FlightRule | null;
  providerStatus: ProviderStatusResponse | null;
  selectedCompartment: string;
  error: string | null;

  // SI Voice Mode State
  isVoiceModalOpen: boolean;
  isSpeaking: boolean;
  speakingMessageId: string | null;
  autoSpeakEnabled: boolean;
  quindarBeepsEnabled: boolean;
  voiceRate: number;
  voicePersona: VoicePersona;
  selectedVoiceName: string | null;
  voicePitch: number;

  // SI Model Selection & Local WebGPU Lifecycle
  aiModelMode: SIModelMode;
  siModelMode?: SIModelMode;
  localModelStatus: LocalModelStatus;
  localModelProgress: number; // 0 to 100
  localModelStatusText: string;
  localModelError: string | null;
  isWebGpuSupported: boolean | null;

  // Actions
  openDrawer: (tab?: AssistantTab) => void;
  closeDrawer: () => void;
  openVoiceModal: () => void;
  closeVoiceModal: () => void;
  setAiModelMode: (mode: SIModelMode) => void;
  setSiModelMode?: (mode: SIModelMode) => void;
  checkWebGpu: () => Promise<boolean>;
  loadLocalModel: () => Promise<void>;
  unloadLocalModel: () => Promise<void>;
  toggleAutoSpeak: () => void;
  setQuindarBeepsEnabled: (enabled: boolean) => void;
  setVoiceRate: (rate: number) => void;
  setVoicePersona: (persona: VoicePersona) => void;
  setSelectedVoiceName: (voiceName: string | null) => void;
  setVoicePitch: (pitch: number) => void;
  speakMessage: (messageId: string, text: string) => Promise<void>;
  stopSpeaking: () => void;
  setActiveTab: (tab: AssistantTab) => void;
  setPttState: (state: PttState) => void;
  setSpeechTranscript: (transcript: string) => void;
  setSelectedCompartment: (compartment: string) => void;
  latchRule: (rule: FlightRule | null) => void;
  openForEvent: (event: HealthEvent) => Promise<void>;
  submitQuery: (text: string, eventId?: string | null) => Promise<void>;
  toggleInterimAction: (messageId: string, actionId: string) => void;
  confirmSymptomConsent: (messageId: string) => Promise<void>;
  dismissSymptomConsent: (messageId: string) => void;
  loadFlightRule: (ruleId: string) => Promise<void>;
  refreshProviderStatus: () => Promise<void>;
  clearChat: () => void;
  reset: () => void;
}

let requestSequence = 0;

const DEFAULT_SNAPSHOT: TelemetrySnapshot = {
  co2Ppm: 3197,
  tempC: 22.8,
  humidityPct: 43.9,
  radiationRateMGy: 0.20,
  pressureMmHg: 758.2,
};

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  id: "welcome-msg",
  sender: "assistant",
  text: "Hello, I am HabiTrack Standby Assistant. Ask me directly about any symptoms, telemetry excursions, or mission procedures. I will provide direct answers grounded in certified NASA Flight Rules, live compartment telemetry, and research documents.",
  timestamp: "Ready",
};

const SI_MODEL_MODE_STORAGE_KEY = "habitrack_si_model_mode";
const LEGACY_AI_MODEL_MODE_STORAGE_KEY = "habitrack_ai_model_mode";

function readPersistedAiModelMode(): SIModelMode {
  if (typeof window === "undefined") return "frontier";
  try {
    const saved =
      localStorage.getItem(SI_MODEL_MODE_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_AI_MODEL_MODE_STORAGE_KEY);
    return saved === "local" ? "local" : "frontier";
  } catch {
    return "frontier";
  }
}

const EMPTY_STATE = {
  isOpen: false,
  isLoading: false,
  activeTab: "chat" as AssistantTab,
  pttState: "IDLE" as PttState,
  speechTranscript: "",
  messages: [DEFAULT_WELCOME_MESSAGE],
  activeEvent: null,
  activeExplanation: null,
  latchedRule: null,
  providerStatus: null,
  selectedCompartment: "Auto-Detect",
  error: null,
  isVoiceModalOpen: false,
  isSpeaking: false,
  speakingMessageId: null,
  autoSpeakEnabled: false,
  quindarBeepsEnabled: true,
  voiceRate: 1.05,
  voicePersona: ((typeof window !== "undefined" && localStorage.getItem("habitrack_voice_persona")) || "nova") as VoicePersona,
  selectedVoiceName: (typeof window !== "undefined" && localStorage.getItem("habitrack_voice_name")) || null,
  voicePitch: (typeof window !== "undefined" && Number(localStorage.getItem("habitrack_voice_pitch"))) || 1.0,

  aiModelMode: readPersistedAiModelMode(),
  localModelStatus: isLocalModelReady() ? ("ready" as LocalModelStatus) : ("unloaded" as LocalModelStatus),
  localModelProgress: 0,
  localModelStatusText: isLocalModelReady() ? "Ready in VRAM" : "Unloaded",
  localModelError: null as string | null,
  isWebGpuSupported: null as boolean | null,
};

function formatNow(): string {
  return (
    new Date().toLocaleTimeString("en-US", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " UTC"
  );
}

function isSymptomTriageQuery(query: string, _compartment: string): boolean {
  const lower = query.toLowerCase();

  // Explicit triage or clinical assessment triggers
  if (
    lower.includes("5-factor") ||
    lower.includes("run triage") ||
    lower.includes("clinical triage") ||
    lower.includes("triage protocol")
  ) {
    return true;
  }

  // Pure clinical symptoms and physiological distress markers
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

function recordSymptomToLocalDiary(
  symptomText: string,
  location: string,
  snapshot: TelemetrySnapshot,
  astronautId?: string,
  callsign?: string
) {
  try {
    const raw = localStorage.getItem("habitrack_symptom_diary_v3");
    const current = raw ? JSON.parse(raw) : [];
    const targetAstronautId = astronautId || "ASTRO-01";
    const targetCallsign =
      callsign ||
      (targetAstronautId === "ASTRO-01"
        ? "CDR M. Vance"
        : targetAstronautId === "ASTRO-02"
        ? "FE-1 Dr. S. Patel"
        : "MS-1 K. Lindgren");

    const newEntry = {
      id: `sym-${Date.now()}`,
      astronautId: targetAstronautId,
      callsign: targetCallsign,
      symptom: symptomText.slice(0, 32),
      severity: "Moderate",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " UTC",
      location: location || "Node 2 (Harmony)",
      duration: "30 mins",
      description: symptomText,
      environmentalFactor: `CO₂: ${snapshot.co2Ppm} PPM · Rad: ${snapshot.radiationRateMGy} mGy/d · Temp: ${snapshot.tempC} °C`,
      reviewStatus: "PENDING",
      acknowledgedAt: null,
      acknowledgedBy: null,
      acknowledgmentNotes: null,
    };
    localStorage.setItem("habitrack_symptom_diary_v3", JSON.stringify([newEntry, ...current]));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("habitrack_symptom_logged", { detail: newEntry }));
    }
  } catch {
    // Best-effort local storage sync
  }
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  ...EMPTY_STATE,

  openDrawer: (tab = "chat") => set({ isOpen: true, activeTab: tab }),

  closeDrawer: () => set({ isOpen: false }),

  openVoiceModal: () => set({ isVoiceModalOpen: true }),

  closeVoiceModal: () => {
    get().stopSpeaking();
    set({ isVoiceModalOpen: false });
  },

  setAiModelMode: (mode: SIModelMode) => {
    set({ aiModelMode: mode, siModelMode: mode });
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(SI_MODEL_MODE_STORAGE_KEY, mode);
        localStorage.setItem(LEGACY_AI_MODEL_MODE_STORAGE_KEY, mode);
      } catch {
        // Ignore storage error
      }
    }
  },
  setSiModelMode: (mode: SIModelMode) => {
    get().setAiModelMode(mode);
  },

  checkWebGpu: async () => {
    const res = await checkWebGpuSupport();
    set({ isWebGpuSupported: res.supported });
    return res.supported;
  },

  loadLocalModel: async () => {
    set({
      localModelStatus: "loading",
      localModelProgress: 15,
      localModelStatusText: "Probing local station Ollama (port 11434)...",
      localModelError: null,
    });

    try {
      const ollamaRes = await loadOllamaModel();
      if (ollamaRes.success) {
        set({
          localModelStatus: "ready",
          localModelProgress: 100,
          localModelStatusText: `Loaded ${ollamaRes.model} in VRAM (Ollama Online)`,
          localModelError: null,
          aiModelMode: "local",
          siModelMode: "local",
        });
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(SI_MODEL_MODE_STORAGE_KEY, "local");
            localStorage.setItem(LEGACY_AI_MODEL_MODE_STORAGE_KEY, "local");
          } catch {
            // ignore
          }
        }
        return;
      }
    } catch {
      // Ollama not reachable, fall through to WebGPU check
    }

    if (isLocalModelReady()) {
      set({
        localModelStatus: "ready",
        localModelProgress: 100,
        localModelStatusText: "Ready in VRAM (Offline Ready)",
        localModelError: null,
      });
      return;
    }

    set({
      localModelStatus: "loading",
      localModelProgress: 35,
      localModelStatusText: "Initializing WebGPU pipeline...",
      localModelError: null,
    });

    try {
      await initLocalModel((progress) => {
        set({
          localModelProgress: Math.round(progress.progress * 100),
          localModelStatusText: progress.text || "Loading model weights...",
        });
      });

      set({
        localModelStatus: "ready",
        localModelProgress: 100,
        localModelStatusText: "Model loaded in VRAM (Offline Ready)",
        localModelError: null,
        aiModelMode: "local",
        siModelMode: "local",
      });
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(SI_MODEL_MODE_STORAGE_KEY, "local");
          localStorage.setItem(LEGACY_AI_MODEL_MODE_STORAGE_KEY, "local");
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error("[assistantStore] Local model load failed:", err);
      set({
        localModelStatus: "error",
        localModelError:
          err instanceof Error
            ? err.message
            : "Failed to connect to local Ollama or initialize WebGPU local model.",
        localModelStatusText: "Initialization failed",
      });
    }
  },

  unloadLocalModel: async () => {
    try {
      await unloadWebLlm();
      set({
        localModelStatus: "unloaded",
        localModelProgress: 0,
        localModelStatusText: "Unloaded",
        localModelError: null,
      });
    } catch (err) {
      console.warn("Failed to unload local model:", err);
    }
  },

  toggleAutoSpeak: () => set((state) => ({ autoSpeakEnabled: !state.autoSpeakEnabled })),

  setQuindarBeepsEnabled: (quindarBeepsEnabled) => set({ quindarBeepsEnabled }),

  setVoiceRate: (voiceRate) => set({ voiceRate }),

  setVoicePersona: (voicePersona) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("habitrack_voice_persona", voicePersona);
    }
    set({ voicePersona });
  },

  setSelectedVoiceName: (selectedVoiceName) => {
    if (typeof window !== "undefined") {
      if (selectedVoiceName) {
        localStorage.setItem("habitrack_voice_name", selectedVoiceName);
      } else {
        localStorage.removeItem("habitrack_voice_name");
      }
    }
    set({ selectedVoiceName });
  },

  setVoicePitch: (voicePitch) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("habitrack_voice_pitch", String(voicePitch));
    }
    set({ voicePitch });
  },

  speakMessage: async (messageId: string, text: string) => {
    // If already speaking this message, toggle stop
    if (get().speakingMessageId === messageId && get().isSpeaking) {
      get().stopSpeaking();
      return;
    }

    get().stopSpeaking();

    if (get().quindarBeepsEnabled) {
      playQuindarTone("intro");
    }

    set({ isSpeaking: true, speakingMessageId: messageId });

    await speakText(text, {
      rate: get().voiceRate,
      pitch: get().voicePitch,
      persona: get().voicePersona,
      voiceName: get().selectedVoiceName,
      onEnd: () => {
        if (get().quindarBeepsEnabled) {
          playQuindarTone("outro");
        }
        set({ isSpeaking: false, speakingMessageId: null });
      },
      onError: () => {
        set({ isSpeaking: false, speakingMessageId: null });
      },
    });
  },

  stopSpeaking: () => {
    cancelSpeech();
    set({ isSpeaking: false, speakingMessageId: null });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setPttState: (pttState) => set({ pttState }),

  setSpeechTranscript: (speechTranscript) => set({ speechTranscript }),

  setSelectedCompartment: (selectedCompartment) => set({ selectedCompartment }),

  latchRule: (latchedRule) => set({ latchedRule }),

  toggleInterimAction: (messageId: string, actionId: string) => {
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId || !msg.interimActions) return msg;
        return {
          ...msg,
          interimActions: msg.interimActions.map((act) =>
            act.id === actionId ? { ...act, completed: !act.completed } : act
          ),
        };
      }),
    }));
  },

  confirmSymptomConsent: async (messageId: string) => {
    const msg = get().messages.find((m) => m.id === messageId);
    if (!msg || !msg.symptomConsent || msg.symptomConsent.status !== "PENDING") return;

    const consent = msg.symptomConsent;
    const confirmedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " UTC";

    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId && m.symptomConsent
          ? {
              ...m,
              symptomConsent: {
                ...m.symptomConsent,
                status: "CONFIRMED",
                confirmedAt,
              },
            }
          : m
      ),
    }));

    // 1. Record to persistent local diary
    recordSymptomToLocalDiary(
      consent.symptomText,
      consent.location,
      consent.snapshot,
      consent.astronautId,
      consent.callsign
    );

    // 2. Submit to station records in api.ts
    try {
      const lower = consent.symptomText.toLowerCase();
      const code = lower.includes("fatigue")
        ? "FATIGUE"
        : lower.includes("dizzy") || lower.includes("spinning")
        ? "DIZZINESS"
        : lower.includes("nausea")
        ? "NAUSEA"
        : "HEADACHE";

      await submitSymptom({
        astronaut_id: consent.astronautId,
        symptom_code: code,
        severity: 2,
        cabin_module: consent.location,
        notes: consent.symptomText,
      });
    } catch {
      // Best-effort station health record sync
    }
  },

  dismissSymptomConsent: (messageId: string) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId && m.symptomConsent
          ? {
              ...m,
              symptomConsent: {
                ...m.symptomConsent,
                status: "DISMISSED",
              },
            }
          : m
      ),
    }));
  },

  openForEvent: async (event: HealthEvent) => {
    const sequence = ++requestSequence;
    const astronautId = useCohortStore.getState().activeAstronautId;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: `Explain event ${event.event_id} (${event.event_type.replace(/_/g, " ")}): ${event.rationale}`,
      timestamp: formatNow(),
    };

    set((state) => ({
      isOpen: true,
      isLoading: true,
      error: null,
      activeTab: "chat",
      activeEvent: event,
      messages: [...state.messages, userMsg],
    }));

    try {
      const explanation = await explainEvent(event.event_id, astronautId);
      if (sequence !== requestSequence) return;

      const rule = explanation.flight_rule_cited;
      const answerText =
        explanation.answer ||
        `**${explanation.headline}**\n\n${explanation.observed_dynamics}\n\n${explanation.scientific_context}`;

      const botMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: "assistant",
        text: answerText,
        timestamp: formatNow(),
        response: explanation,
      };

      set((state) => ({
        activeExplanation: explanation,
        latchedRule: rule,
        isLoading: false,
        activeTab: rule ? "checklists" : "chat",
        messages: [...state.messages, botMsg],
      }));
    } catch (error) {
      if (sequence !== requestSequence) return;
      set({
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to retrieve evidence for this event.",
      });
    }
  },

  submitQuery: async (text: string, eventId?: string | null) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const sequence = ++requestSequence;
    const astronautId = useCohortStore.getState().activeAstronautId;
    const currentCompartment = get().selectedCompartment;
    const inVoiceMode = get().isVoiceModalOpen;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: trimmed,
      timestamp: formatNow(),
      location: currentCompartment !== "Auto-Detect" ? currentCompartment : undefined,
    };

    set((state) => ({
      isOpen: inVoiceMode ? state.isOpen : true,
      isLoading: true,
      error: null,
      activeTab: "chat",
      speechTranscript: trimmed,
      messages: [...state.messages, userMsg],
    }));

    // Check if query is a Flight Surgeon Shift Handover Briefing command
    const isHandoverQuery =
      /\b(shift\s*handover|handover|brief\s*me|shift\s*briefing|last\s+\d+\s*(?:hours|hour|h))\b/i.test(trimmed);

    if (isHandoverQuery) {
      const currentRole = useRoleStore.getState().role;
      if (currentRole !== "flight_surgeon") {
        if (sequence !== requestSequence) return;
        const botMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          sender: "assistant",
          text: "Shift Handover Briefings are restricted to the Flight Surgeon perspective. Switch to the Flight Surgeon role in Mission Control to view cohort shift summaries.",
          timestamp: formatNow(),
        };
        set((state) => ({
          isLoading: false,
          messages: [...state.messages, botMsg],
        }));
        return;
      }

      // Flight Surgeon Handover Briefing Path
      const hoursMatch = trimmed.match(/\b(\d+)\s*(?:hours|hour|h)\b/i);
      const windowHours = hoursMatch ? parseInt(hoursMatch[1], 10) : 12;

      try {
        const briefing = await fetchAndBuildShiftHandover(windowHours);
        if (sequence !== requestSequence) return;

        const briefingRes = await flightSI.generateShiftBriefing({
          windowHours,
          briefingData: briefing,
        });

        const botMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          sender: "assistant",
          text: briefingRes.narrativeText,
          timestamp: formatNow(),
          provider: briefingRes.provider,
          shiftHandover: briefingRes.briefing,
          disclaimer: briefingRes.disclaimer,
        };

        set((state) => ({
          isLoading: false,
          messages: [...state.messages, botMsg],
        }));

        if (get().autoSpeakEnabled || get().isVoiceModalOpen) {
          get().speakMessage(botMsg.id, botMsg.text);
        }
        return;
      } catch (err) {
        if (sequence !== requestSequence) return;
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : "Unable to generate shift handover briefing.",
        });
        return;
      }
    }

    // Check if query is a clinical symptom evaluation or 5-factor triage
    if (isSymptomTriageQuery(trimmed, currentCompartment)) {
      try {
        const triageResult = await flightSI.triageSymptom({
          symptomText: trimmed,
          compartmentOverride: currentCompartment !== "Auto-Detect" ? currentCompartment : undefined,
          snapshot: DEFAULT_SNAPSHOT,
          astronautId: astronautId ?? "ASTRO-01",
        });

        if (sequence !== requestSequence) return;

        let responseContent = triageResult.conversationalOverview;
        if (!responseContent) {
          if (triageResult.primarySymptomCategory === "MUSCLE_SORENESS") {
            responseContent = `I understand you are experiencing soreness or musculoskeletal stiffness. Based on your mission profile, this is temporally associated with microgravity resistance training (ARED) or aerobic countermeasures.\n\n` +
              `**Physiological Context**: ${triageResult.physiologicalRationale}\n\n` +
              `**Recovery Latency**: Peak soreness resolves within **${triageResult.biologicalLatencyLag}** (${triageResult.confidenceMatch}).\n\n` +
              `Below are recommended recovery actions and verified instructional guides from the SpaceLife Library:`;
          } else if (triageResult.primarySymptomCategory === "SLEEP_DISTURBANCE") {
            responseContent = `Evaluated sleep habitability and rest-cycle environment in **${triageResult.compartmentName}**.\n\n` +
              `**Habitability Assessment**: ${triageResult.physiologicalRationale}\n\n` +
              `**Rest Window Dynamics**: **${triageResult.biologicalLatencyLag}** (${triageResult.confidenceMatch}).\n\n` +
              `Below are sleep station rigging procedures and verified guides:`;
          } else if (triageResult.primarySymptomCategory === "CRITICAL_EMERGENCY") {
            responseContent = `**CRITICAL MEDICAL ESCALATION**\n\n${triageResult.physiologicalRationale}\n\nImmediate operational protocol latched: **${triageResult.flightRuleTitle}** (${triageResult.latchedRuleId}).`;
          } else {
            responseContent = `Evaluated report against current environmental telemetry in **${triageResult.compartmentName}**.\n\n` +
              `**Physiological Excursion**: ${triageResult.physiologicalRationale}\n\n` +
              `**Biological Latency Lag**: Expected onset peak is **${triageResult.biologicalLatencyLag}** (${triageResult.confidenceMatch}).`;
          }
        }

        const botMsg: ChatMessage = {
          id: `si-${Date.now()}`,
          sender: "assistant",
          timestamp: formatNow(),
          text: responseContent,
          provider: triageResult.provider,
          location: triageResult.compartmentName,
          snapshot: triageResult.telemetryReadings,
          interimActions: triageResult.interimActions,
          resources: triageResult.resources,
          followupQuestions: triageResult.followupQuestions,
          intent: triageResult.intent,
          lagWindow: triageResult.biologicalLatencyLag,
          latchedRuleId: triageResult.latchedRuleId,
          flightRuleTitle: triageResult.flightRuleTitle,
          confidenceMatch: triageResult.confidenceMatch,
          disclaimer: triageResult.disclaimer,
          surgeonHandoffPacket: triageResult.surgeonHandoffPacket,
          symptomConsent: triageResult.symptomConsent,
        };

        set((state) => ({
          isLoading: false,
          messages: [...state.messages, botMsg],
        }));

        if (get().autoSpeakEnabled || get().isVoiceModalOpen) {
          get().speakMessage(botMsg.id, botMsg.text);
        }
        return;
      } catch (err) {
        console.warn("[AssistantStore] Triage error, falling back to general SI:", err);
      }
    }

    // Default: Standard SI knowledge query (Gemini 2.5 Flash / extractive RAG)
    try {
      const chatHistory = get().messages
        .slice(-6)
        .filter((m) => m.text && m.id !== "welcome-msg")
        .map((m) => ({
          role: (m.sender === "user" ? "user" : "model") as "user" | "model",
          text: m.text,
        }));

      const telemetryContext = currentCompartment !== "Auto-Detect"
        ? {
            ...DEFAULT_SNAPSHOT,
            compartment: currentCompartment,
          }
        : null;

      const response = await queryAssistant(
        trimmed,
        5,
        astronautId,
        eventId ?? get().activeEvent?.event_id ?? null,
        chatHistory,
        telemetryContext
      );
      if (sequence !== requestSequence) return;

      const rule = response.flight_rule_cited ?? get().latchedRule;
      const answerText =
        response.answer ||
        `**${response.headline}**\n\n${response.observed_dynamics}\n\n${response.scientific_context}`;

      const botMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: "assistant",
        text: answerText,
        timestamp: formatNow(),
        provider: response.provider_used ?? undefined,
        response: response,
        resources: response.resources,
      };

      set((state) => ({
        activeExplanation: response,
        latchedRule: rule,
        isLoading: false,
        activeTab: state.activeTab,
        messages: [...state.messages, botMsg],
      }));

      if (get().autoSpeakEnabled || get().isVoiceModalOpen) {
        get().speakMessage(botMsg.id, botMsg.text);
      }
    } catch (error) {
      if (sequence !== requestSequence) return;
      set({
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to query decision support.",
      });
    }
  },

  loadFlightRule: async (ruleId: string) => {
    try {
      const rule = await fetchFlightRule(ruleId);
      set({ latchedRule: rule, activeTab: "checklists", isOpen: true });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : `Failed to load flight rule ${ruleId}`,
      });
    }
  },

  refreshProviderStatus: async () => {
    try {
      const status = await fetchProviderStatus();
      set({ providerStatus: status });
    } catch {
      // Best-effort status probe
    }
  },

  clearChat: () => {
    set({ messages: [DEFAULT_WELCOME_MESSAGE], error: null });
  },

  reset: () => {
    requestSequence += 1;
    set({ ...EMPTY_STATE });
  },
}));

let lastAstronautId = useCohortStore.getState().activeAstronautId;

useCohortStore.subscribe((state) => {
  if (state.activeAstronautId === lastAstronautId) {
    return;
  }
  lastAstronautId = state.activeAstronautId;
  // Scope the reset: do not wipe cohort-scoped handover briefings when switching astronauts
  const currentMessages = useAssistantStore.getState().messages;
  const hasHandover = currentMessages.some((m) => Boolean(m.shiftHandover));
  if (!hasHandover) {
    useAssistantStore.getState().reset();
  }
});
