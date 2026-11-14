/**
 * web/src/stores/assistantStore.ts: Standby AI chatbot conversation thread,
 * push-to-talk voice state, flight rule latching, and cross-crew context isolation.
 */

import { create } from "zustand";

import {
  explainEvent,
  fetchFlightRule,
  fetchProviderStatus,
  queryAssistant,
} from "../services/api";
import type {
  AssistantResponse,
  FlightRule,
  HealthEvent,
  ProviderStatusResponse,
} from "../types/api";
import { useCohortStore } from "./cohortStore";

export type PttState = "IDLE" | "LISTENING" | "PROCESSING";
export type AssistantTab = "chat" | "checklists" | "evidence";

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  response?: AssistantResponse;
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
  error: string | null;

  // Actions
  openDrawer: (tab?: AssistantTab) => void;
  closeDrawer: () => void;
  setActiveTab: (tab: AssistantTab) => void;
  setPttState: (state: PttState) => void;
  setSpeechTranscript: (transcript: string) => void;
  latchRule: (rule: FlightRule | null) => void;
  openForEvent: (event: HealthEvent) => Promise<void>;
  submitQuery: (text: string, eventId?: string | null) => Promise<void>;
  loadFlightRule: (ruleId: string) => Promise<void>;
  refreshProviderStatus: () => Promise<void>;
  clearChat: () => void;
  reset: () => void;
}

let requestSequence = 0;

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  id: "welcome-msg",
  sender: "assistant",
  text: "Hello, I am WAYFINDER Standby Assistant. Ask me directly about any symptoms, telemetry excursions, or mission procedures. I will provide direct answers grounded in certified NASA Flight Rules and research documents.",
  timestamp: "Ready",
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
  error: null,
};

function formatNow(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  ...EMPTY_STATE,

  openDrawer: (tab = "chat") => set({ isOpen: true, activeTab: tab }),

  closeDrawer: () => set({ isOpen: false }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  setPttState: (pttState) => set({ pttState }),

  setSpeechTranscript: (speechTranscript) => set({ speechTranscript }),

  latchRule: (latchedRule) => set({ latchedRule }),

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
      activeTab: "chat",
      activeEvent: event,
      error: null,
      messages: [...state.messages, userMsg],
    }));

    try {
      const explanation = await explainEvent(event.event_id, astronautId);
      if (sequence !== requestSequence) return;
      if (useCohortStore.getState().activeAstronautId !== astronautId) return;

      const rule = explanation.flight_rule_cited ?? null;
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

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: trimmed,
      timestamp: formatNow(),
    };

    set((state) => ({
      isOpen: true,
      isLoading: true,
      error: null,
      activeTab: "chat",
      speechTranscript: trimmed,
      messages: [...state.messages, userMsg],
    }));

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
