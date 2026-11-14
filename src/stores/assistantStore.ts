/**
 * web/src/stores/assistantStore.ts: Unified Standby AI chatbot conversation thread,
 * Mastra 5-factor clinical triage engine, push-to-talk voice state,
 * flight rule latching, and cross-crew context isolation.
 */

import { create } from "zustand";

import {
  explainEvent,
  fetchFlightRule,
  fetchProviderStatus,
  queryAssistant,
} from "../services/api";
import { mastra } from "../mastra";
import type {
  AssistantResponse,
  FlightRule,
  HealthEvent,
  ProviderStatusResponse,
} from "../types/api";
import { useCohortStore } from "./cohortStore";

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

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
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

  // Actions
  openDrawer: (tab?: AssistantTab) => void;
  closeDrawer: () => void;
  setActiveTab: (tab: AssistantTab) => void;
  setPttState: (state: PttState) => void;
  setSpeechTranscript: (transcript: string) => void;
  setSelectedCompartment: (compartment: string) => void;
  latchRule: (rule: FlightRule | null) => void;
  openForEvent: (event: HealthEvent) => Promise<void>;
  submitQuery: (text: string, eventId?: string | null) => Promise<void>;
  toggleInterimAction: (messageId: string, actionId: string) => void;
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
  text: "Hello, I am HabiTrack Standby Assistant. Ask me directly about any symptoms, telemetry excursions, or mission procedures. I will provide direct answers grounded in certified NASA Flight Rules, live 5-factor compartment telemetry, and research documents.",
  timestamp: "Ready",
  snapshot: DEFAULT_SNAPSHOT,
};

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
};

function formatNow(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isSymptomTriageQuery(query: string, compartment: string): boolean {
  if (compartment !== "Auto-Detect") return true;
  const lower = query.toLowerCase();
  const keywords = [
    "headache",
    "fatigue",
    "dizzy",
    "dizziness",
    "nausea",
    "pain",
    "stinging",
    "eyes",
    "sweat",
    "overheat",
    "lethargy",
    "tachycardia",
    "hypercapnia",
    "symptom",
    "triage",
    "check",
    "5-factor",
    "discomfort",
    "chest",
    "shortness of breath",
    "node 2",
    "us lab",
    "columbus",
    "kibo",
  ];
  return keywords.some((kw) => lower.includes(kw));
}

function recordSymptomToLocalDiary(
  symptomText: string,
  location: string,
  snapshot: TelemetrySnapshot
) {
  try {
    const raw = localStorage.getItem("habitrack_symptom_diary_v3");
    const current = raw ? JSON.parse(raw) : [];
    const newEntry = {
      id: `sym-${Date.now()}`,
      symptom: symptomText.slice(0, 32),
      severity: "Moderate",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " UTC",
      location: location || "Node 2 (Harmony)",
      duration: "30 mins",
      description: symptomText,
      environmentalFactor: `CO₂: ${snapshot.co2Ppm} PPM · Rad: ${snapshot.radiationRateMGy} mGy/d · Temp: ${snapshot.tempC} °C`,
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

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: trimmed,
      timestamp: formatNow(),
      location: currentCompartment !== "Auto-Detect" ? currentCompartment : undefined,
    };

    set((state) => ({
      isOpen: true,
      isLoading: true,
      error: null,
      activeTab: "chat",
      speechTranscript: trimmed,
      messages: [...state.messages, userMsg],
    }));

    // Check if query is a clinical symptom evaluation or 5-factor triage
    if (isSymptomTriageQuery(trimmed, currentCompartment)) {
      try {
        const workflow =
          mastra.getWorkflow("clinicalTriage") ||
          mastra.getWorkflow("clinical-triage-workflow");

        const triageResult = await workflow.execute({
          symptomText: trimmed,
          compartmentOverride: currentCompartment !== "Auto-Detect" ? currentCompartment : undefined,
          currentSnapshot: DEFAULT_SNAPSHOT,
          astronautId: astronautId ?? "ASTRO-01",
        });

        if (sequence !== requestSequence) return;

        // Fetch flight rule if latched
        let latchedRule: FlightRule | null = null;
        if (triageResult.latchedRuleId) {
          try {
            latchedRule = await fetchFlightRule(triageResult.latchedRuleId);
          } catch {
            // Best effort
          }
        }

        // Query research citations in background to populate Evidence tab
        let assistantResp: AssistantResponse | undefined;
        try {
          assistantResp = await queryAssistant(trimmed, 3, astronautId, eventId);
        } catch {
          // Best effort
        }

        let responseContent = `Evaluated report against current environmental telemetry in **${triageResult.compartmentName}**.\n\n`;
        responseContent += `⚠️ **Physiological Excursion**: ${triageResult.physiologicalRationale}\n\n`;
        responseContent += `⏱️ **Biological Latency Lag**: Expected onset peak is **${triageResult.biologicalLatencyLag}** (${triageResult.confidenceMatch}).`;

        const effectiveSnapshot: TelemetrySnapshot = triageResult.telemetryReadings
          ? {
              co2Ppm: triageResult.telemetryReadings.co2Ppm,
              tempC: triageResult.telemetryReadings.tempC,
              humidityPct: triageResult.telemetryReadings.humidityPct,
              radiationRateMGy: triageResult.telemetryReadings.radiationRateMGy,
              pressureMmHg: triageResult.telemetryReadings.pressureMmHg,
            }
          : DEFAULT_SNAPSHOT;

        const botMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: "assistant",
          timestamp: formatNow(),
          text: responseContent,
          response: assistantResp,
          location: triageResult.compartmentName,
          snapshot: effectiveSnapshot,
          interimActions: triageResult.interimActions,
          lagWindow: triageResult.biologicalLatencyLag,
          latchedRuleId: triageResult.latchedRuleId,
          flightRuleTitle: triageResult.flightRuleTitle,
          confidenceMatch: triageResult.confidenceMatch,
          disclaimer: triageResult.disclaimer,
          surgeonHandoffPacket: triageResult.surgeonHandoffPacket,
        };

        // Record to local symptom diary
        recordSymptomToLocalDiary(trimmed, triageResult.compartmentName, effectiveSnapshot);

        set((state) => ({
          activeExplanation: assistantResp || state.activeExplanation,
          latchedRule: latchedRule || state.latchedRule,
          isLoading: false,
          messages: [...state.messages, botMsg],
        }));
        return;
      } catch (err) {
        console.warn("[AssistantStore] Mastra triage workflow error, falling back to queryAssistant:", err);
      }
    }

    // Default: Standard co-pilot knowledge query (Gemini 2.5 Flash / extractive RAG)
    try {
      const response = await queryAssistant(
        trimmed,
        5,
        astronautId,
        eventId ?? get().activeEvent?.event_id ?? null
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
        response: response,
        snapshot: DEFAULT_SNAPSHOT,
      };

      set((state) => ({
        activeExplanation: response,
        latchedRule: rule,
        isLoading: false,
        activeTab: rule ? "checklists" : state.activeTab,
        messages: [...state.messages, botMsg],
      }));
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
  useAssistantStore.getState().reset();
});
