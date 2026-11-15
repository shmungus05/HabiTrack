/**
 * web/src/components/AssistantView.tsx: Dedicated Full-Page HabiTrack SI Workstation
 *
 * Implements a high-end, minimalist Perplexity/ChatGPT conversational workspace
 * for ISS crew and flight surgeons:
 * - font-black headings, generous whitespace, rounded-[32px] containers
 * - Prominent "Back to Mission Control" header navigation
 * - Preserves all clinical capabilities: 5-factor triage, NASA flight rules,
 *   RAG evidence citations, interim action checklists, and surgeon handoff packets.
 */

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  AudioLines,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock,
  Clock3,
  Compass,
  Droplets,
  FileCheck2,
  FileText,
  Film,
  Flame,
  KeyRound,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  Microscope,
  Radio,
  Send,
  ShieldCheck,
  Square,
  Trash2,
  TriangleAlert,
  Volume2,
  Wind,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import {
  formatSigned,
  parseStreamIds,
  prettyStream,
  titleCase,
  uncertaintyTheme,
} from "../lib/format";
import {
  useAssistantStore,
  type ChatMessage,
  type SurgeonHandoffPacket,
} from "../stores/assistantStore";
import { useRoleStore } from "../stores/roleStore";
import { ShiftHandoverCard } from "../features/handover";
import { EvidenceCard } from "./EvidenceCard";
import { parseEventRationale } from "./EventRationaleDisplay";
import { Badge, MessageFormatter } from "./ui";
import { WatchableResourceCard } from "./WatchableResourceCard";
import { GuideDetailModal } from "../features/library/GuideDetailModal";
import { fetchLibraryGuideById } from "../services/api";
import { getGeminiApiKey, getGeminiModelLabel } from "../services/ai/geminiClient";
import { GeminiApiKeyModal } from "./GeminiApiKeyModal";
import type { LibraryGuide } from "../types/library";
import type { SpaceCareResourceReference } from "../types/api";

const CABIN_MODULES = [
  "Auto-Detect",
  "Node 2 (Harmony)",
  "US Lab (Destiny)",
  "Columbus Orbital Facility",
  "JEM Kibo",
  "Node 1 (Unity)",
  "Cupola",
] as const;

const CLINICAL_SUGGESTIONS = [
  "Run full 5-factor triage",
  "Headache & throbbing in Node 2",
  "I have muscle soreness after workout",
  "Sleep airflow in Node 2 crew quarters",
  "Stinging irritated eyes in Columbus",
  "Dizziness upon waking in crew quarters",
  "Check ECLSS CO2 flight rule limits",
];

interface AssistantViewProps {
  onBackToDashboard: () => void;
  previousViewLabel?: string;
  astronautCallsign?: string;
}

export const AssistantView: React.FC<AssistantViewProps> = ({
  onBackToDashboard,
  previousViewLabel = "Mission Control",
}) => {
  const isLoading = useAssistantStore((state) => state.isLoading);
  const userRole = useRoleStore((state) => state.role);
  const isFlightSurgeon = userRole === "flight_surgeon";
  const activeTab = useAssistantStore((state) => state.activeTab);
  const setActiveTab = useAssistantStore((state) => state.setActiveTab);
  const messages = useAssistantStore((state) => state.messages);
  const activeEvent = useAssistantStore((state) => state.activeEvent);
  const activeExplanation = useAssistantStore((state) => state.activeExplanation);
  const latchedRule = useAssistantStore((state) => state.latchedRule);
  const selectedCompartment = useAssistantStore((state) => state.selectedCompartment);
  const setSelectedCompartment = useAssistantStore((state) => state.setSelectedCompartment);
  const toggleInterimAction = useAssistantStore((state) => state.toggleInterimAction);
  const confirmSymptomConsent = useAssistantStore((state) => state.confirmSymptomConsent);
  const dismissSymptomConsent = useAssistantStore((state) => state.dismissSymptomConsent);
  const error = useAssistantStore((state) => state.error);
  const submitQuery = useAssistantStore((state) => state.submitQuery);
  const clearChat = useAssistantStore((state) => state.clearChat);

  // Voice Mode & TTS state
  const openVoiceModal = useAssistantStore((state) => state.openVoiceModal);
  const isSpeaking = useAssistantStore((state) => state.isSpeaking);
  const speakingMessageId = useAssistantStore((state) => state.speakingMessageId);
  const speakMessage = useAssistantStore((state) => state.speakMessage);

  // SI Model Selection & Local WebGPU status
  const aiModelMode = useAssistantStore((state) => state.aiModelMode);
  const setAiModelMode = useAssistantStore((state) => state.setAiModelMode);
  const localModelStatus = useAssistantStore((state) => state.localModelStatus);
  const loadLocalModel = useAssistantStore((state) => state.loadLocalModel);

  const [inputQuery, setInputQuery] = useState("");
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [isListening, setIsListening] = useState(false);
  const [viewingPacket, setViewingPacket] = useState<SurgeonHandoffPacket | null>(null);
  const [selectedGuideForModal, setSelectedGuideForModal] = useState<LibraryGuide | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(Boolean(getGeminiApiKey()));

  useEffect(() => {
    const checkKey = () => setHasApiKey(Boolean(getGeminiApiKey()));
    checkKey();
    window.addEventListener("habitrack_api_key_updated", checkKey);
    return () => window.removeEventListener("habitrack_api_key_updated", checkKey);
  }, []);

  const handleWatchResource = async (res: SpaceCareResourceReference) => {
    try {
      const guide = await fetchLibraryGuideById(res.id);
      if (guide) {
        setSelectedGuideForModal(guide);
        return;
      }
    } catch {
      // Best effort
    }

    // Fallback mapping if guide is custom or external
    setSelectedGuideForModal({
      id: res.id,
      nasaDocumentId: res.sourceDocId,
      title: res.title,
      category: res.category,
      durationMinutes: res.durationMinutes ?? 3.5,
      sourceRepository: res.sourceName,
      summary: res.description,
      instructions: res.instructions ?? [],
      safetyNotices: (res.safetyNotices ?? []).map((s) => ({
        level: s.level as any,
        text: s.text,
      })),
      chapters: (res.chapters ?? []).map((c) => ({
        time: c.time,
        seconds: c.seconds,
        title: c.title,
      })),
      mediaType: "video_stream",
      mediaUrl: res.mediaUrl,
      thumbnailUrl: res.thumbnailUrl,
      verifiedBy: "NASA Flight Surgeon / HRP Lead",
    });
  };

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto scroll chat to bottom on new messages
  useEffect(() => {
    if (activeTab === "chat" && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, activeTab]);

  // Focus input on mount
  useEffect(() => {
    if (activeTab === "chat") {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [activeTab]);

  // Keyboard shortcut: Escape to return to previous dashboard view
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onBackToDashboard();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBackToDashboard]);

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [stepNumber]: !prev[stepNumber],
    }));
  };

  const toggleSourceExpand = (msgId: string) => {
    setExpandedSources((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputQuery.trim()) {
      submitQuery(inputQuery);
      setInputQuery("");
    }
  };

  const handleModelModeToggle = () => {
    const nextMode = aiModelMode === "frontier" ? "local" : "frontier";
    setAiModelMode(nextMode);
    if (nextMode === "local" && localModelStatus !== "ready") {
      loadLocalModel();
    }
  };

  const modelLabel =
    aiModelMode === "frontier"
      ? "Frontier (Gemini)"
      : localModelStatus === "ready"
        ? "Local (Llama 3.2)"
        : localModelStatus === "loading"
          ? "Local (loading)"
          : localModelStatus === "error"
            ? "Local (failed)"
            : "Local (not loaded)";

  const modelDotClass =
    aiModelMode === "frontier"
      ? "bg-sky-500"
      : localModelStatus === "ready"
        ? "bg-emerald-500"
        : localModelStatus === "loading"
          ? "bg-amber-500"
          : localModelStatus === "error"
            ? "bg-red-500"
            : "bg-slate-400";

  // Web Speech API Voice Recognition
  const toggleListening = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please type your query.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        const text = (final || interim).trim();
        if (text) {
          setInputQuery(text);
        }
        if (final.trim()) {
          setIsListening(false);
          submitQuery(final.trim());
          setInputQuery("");
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const checklistSteps =
    latchedRule?.checklist_steps ??
    activeExplanation?.verbatim_checklist ??
    [];

  return (
    <div className="fixed inset-0 z-50 flex flex-col h-screen w-screen bg-[#f8fafc] text-slate-800 font-sans selection:bg-sky-200/60 overflow-hidden animate-in fade-in-50 duration-150">
      {/* Top Header / Navigation Strip */}
      <header className="z-20 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-slate-200/80 bg-white px-4 py-2.5 sm:px-8">
        {/* Back to Mission Control Button */}
        <button
          type="button"
          onClick={onBackToDashboard}
          className="group flex h-9 min-w-0 items-center justify-self-start gap-2 rounded-lg px-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-sky-500/30 focus-visible:outline-none"
          title={`Return to ${previousViewLabel} (or press Esc)`}
          aria-label={`Back to ${previousViewLabel}`}
        >
          <ArrowLeft className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:-translate-x-0.5" />
          <span className="hidden truncate text-xs font-semibold md:inline">
            Back to {previousViewLabel}
          </span>
          <span className="truncate text-xs font-semibold md:hidden">Back</span>
          <kbd className="hidden items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 lg:inline-flex">
            Esc
          </kbd>
        </button>

        {/* Center / Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Assistant sections"
          className="inline-flex items-center gap-1 justify-self-center rounded-2xl border border-slate-200/80 bg-slate-100 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "chat"}
            aria-label="Triage and chat"
            title="Triage & Chat"
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 rounded-xl p-2 text-xs font-semibold tracking-tight transition-colors duration-150 sm:px-3.5 sm:py-1.5 ${
              activeTab === "chat"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            }`}
          >
            <MessageSquare
              className={`h-3.5 w-3.5 ${activeTab === "chat" ? "text-slate-700" : "text-slate-400"}`}
            />
            <span className="hidden sm:inline">Triage &amp; Chat</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "checklists"}
            aria-label="Flight checklists"
            title="Flight Checklists"
            onClick={() => setActiveTab("checklists")}
            className={`flex items-center gap-2 rounded-xl p-2 text-xs font-semibold tracking-tight transition-colors duration-150 sm:px-3.5 sm:py-1.5 ${
              activeTab === "checklists"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            }`}
          >
            <FileCheck2
              className={`h-3.5 w-3.5 ${activeTab === "checklists" ? "text-slate-700" : "text-slate-400"}`}
            />
            <span className="hidden sm:inline">Flight Checklists</span>
            {checklistSteps.length > 0 && (
              <span className="rounded-md bg-slate-200/70 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                {checklistSteps.length}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "evidence"}
            aria-label="Research evidence"
            title="Research RAG"
            onClick={() => setActiveTab("evidence")}
            className={`flex items-center gap-2 rounded-xl p-2 text-xs font-semibold tracking-tight transition-colors duration-150 sm:px-3.5 sm:py-1.5 ${
              activeTab === "evidence"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            }`}
          >
            <Microscope
              className={`h-3.5 w-3.5 ${activeTab === "evidence" ? "text-slate-700" : "text-slate-400"}`}
            />
            <span className="hidden sm:inline">Research RAG</span>
            {activeExplanation?.cited_evidence.length ? (
              <span className="rounded-md bg-slate-200/70 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                {activeExplanation.cited_evidence.length}
              </span>
            ) : null}
          </button>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center justify-self-end gap-2">
          {activeTab === "chat" && messages.length > 1 && (
            <button
              type="button"
              onClick={clearChat}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-red-400/30 focus-visible:outline-none"
              title="Clear conversation history"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear chat</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-50/30 overflow-hidden">
        {/* Tab 1: Conversational Chatbot & Triage */}
        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Messages Stream */}
            <div
              ref={chatScrollRef}
              className="drawer-scroll flex-1 overflow-y-auto px-6 sm:px-8 py-6"
            >
              <div className="max-w-4xl mx-auto w-full space-y-6">
                {messages.map((msg) => {
                  const isUser = msg.sender === "user";
                  const isExpanded = Boolean(expandedSources[msg.id]);
                  const response = msg.response;
                  const rule = response?.flight_rule_cited;
                  const evidenceList = response?.cited_evidence ?? [];

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                    >
                      {/* Message Bubble */}
                      <div
                        className={`rounded-[28px] p-5 sm:p-6 text-sm leading-relaxed space-y-4 transition-all ${
                          isUser
                            ? "max-w-[85%] sm:max-w-[75%] bg-slate-900 border border-slate-800 text-white rounded-tr-md shadow-xs font-medium"
                            : "w-full max-w-full bg-white border border-slate-200/90 text-slate-900 rounded-tl-md shadow-card"
                        }`}
                      >
                        {/* Header line for sender and location */}
                        <div
                          className={`flex flex-wrap items-center justify-between gap-2 text-xs font-mono pb-2 border-b ${
                            isUser ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-500"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-bold ${
                                isUser ? "text-sky-300 text-xs" : "text-sky-700 uppercase tracking-wider text-[11px]"
                              }`}
                            >
                              {isUser ? "Astronaut (Crew)" : "HabiTrack Flight SI"}
                            </span>
                            {!isUser && (
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-500">
                                {(msg.provider || response?.provider_used)?.includes("Gemini")
                                  ? msg.provider?.replace(" (Direct Browser Execution)", "") || getGeminiModelLabel()
                                  : "Mastra Standby"}
                              </span>
                            )}
                            {msg.location && (
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] ${
                                  isUser
                                    ? "bg-slate-800 text-slate-300 border border-slate-700"
                                    : "bg-slate-100 text-slate-600 border border-slate-200"
                                }`}
                              >
                                <Compass className="w-3 h-3 text-sky-400" />
                                {msg.location}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!isUser && (
                              <button
                                type="button"
                                onClick={() => speakMessage(msg.id, msg.text)}
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-mono transition-all cursor-pointer ${
                                  speakingMessageId === msg.id && isSpeaking
                                    ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-bold shadow-2xs"
                                    : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800"
                                }`}
                                title={
                                  speakingMessageId === msg.id && isSpeaking
                                    ? "Stop reading aloud"
                                    : "Read response aloud (Voice TTS)"
                                }
                              >
                                {speakingMessageId === msg.id && isSpeaking ? (
                                  <>
                                    <Square className="w-3 h-3 fill-current text-emerald-600" />
                                    <span className="text-emerald-700">Stop</span>
                                  </>
                                ) : (
                                  <>
                                    <Volume2 className="w-3 h-3 text-slate-400" />
                                    <span>Read Aloud</span>
                                  </>
                                )}
                              </button>
                            )}
                            <span className="text-slate-400 text-[11px]">{msg.timestamp}</span>
                          </div>
                        </div>

                        {/* Content text formatted with Perplexity-style clean typography */}
                        {!msg.shiftHandover ? (
                          <MessageFormatter text={msg.text} isUser={isUser} />
                        ) : (
                          /* Shift Handover Briefing Card (Flight Surgeon Only) */
                          <div className="pt-2">
                            <ShiftHandoverCard
                              briefing={msg.shiftHandover}
                              onSelectWindow={(hours) => submitQuery(`Brief me on the last ${hours} hours`)}
                            />
                          </div>
                        )}

                        {/* Starter Prompt Cards on Initial Welcome Message */}
                        {!isUser && msg.id === "welcome-msg" && messages.length <= 1 && (
                          <div className="pt-3 border-t border-slate-100 space-y-3">
                            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
                              Suggested Inquiries
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                              {(isFlightSurgeon ? ["Brief me on the last 12 hours", ...CLINICAL_SUGGESTIONS] : CLINICAL_SUGGESTIONS).map((sug) => (
                                <button
                                  key={sug}
                                  type="button"
                                  onClick={() => submitQuery(sug)}
                                  className="text-left p-3.5 rounded-2xl bg-slate-50/80 hover:bg-sky-50 border border-slate-200/80 hover:border-sky-300 text-xs font-medium text-slate-700 hover:text-sky-900 transition-all cursor-pointer shadow-2xs group flex flex-col justify-between"
                                >
                                  <span className="leading-snug">{sug}</span>
                                  <span className="text-[10px] font-mono text-slate-400 group-hover:text-sky-600 mt-2.5 flex items-center gap-1">
                                    Ask SI →
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Embedded 5-Factor Telemetry Scorecard (Clinical Excursions Only) */}
                        {!isUser && msg.snapshot && (msg.location || msg.interimActions || msg.latchedRuleId) && (
                          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                            <div className="flex items-center justify-between text-xs font-mono text-slate-500">
                              <span className="font-bold uppercase tracking-wider text-[11px] text-slate-700 flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5 text-sky-600" />
                                5-Factor Compartment Telemetry
                              </span>
                              {msg.lagWindow && (
                                <span className="inline-flex items-center gap-1 text-amber-700 font-semibold text-[11px]">
                                  <Clock className="w-3 h-3" />
                                  Lag: {msg.lagWindow}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
                              <div className="p-3 rounded-xl bg-white border border-slate-200/60 shadow-2xs">
                                <span className="text-slate-500 block text-[10px] uppercase font-bold flex items-center gap-1">
                                  <Wind className="w-3 h-3 text-[#0284c7]" /> CO₂
                                </span>
                                <span className="text-[#0284c7] font-black text-sm block mt-0.5">
                                  {msg.snapshot.co2Ppm} <span className="text-[10px] font-normal text-slate-500">ppm</span>
                                </span>
                              </div>
                              <div className="p-3 rounded-xl bg-white border border-slate-200/60 shadow-2xs">
                                <span className="text-slate-500 block text-[10px] uppercase font-bold flex items-center gap-1">
                                  <Radio className="w-3 h-3 text-[#d97706]" /> Radiation
                                </span>
                                <span className="text-[#d97706] font-black text-sm block mt-0.5">
                                  {msg.snapshot.radiationRateMGy} <span className="text-[10px] font-normal text-slate-500">mGy</span>
                                </span>
                              </div>
                              <div className="p-3 rounded-xl bg-white border border-slate-200/60 shadow-2xs">
                                <span className="text-slate-500 block text-[10px] uppercase font-bold flex items-center gap-1">
                                  <Flame className="w-3 h-3 text-[#ea580c]" /> Cabin Temp
                                </span>
                                <span className="text-[#ea580c] font-black text-sm block mt-0.5">
                                  {msg.snapshot.tempC} <span className="text-[10px] font-normal text-slate-500">°C</span>
                                </span>
                              </div>
                              <div className="p-3 rounded-xl bg-white border border-slate-200/60 shadow-2xs">
                                <span className="text-slate-500 block text-[10px] uppercase font-bold flex items-center gap-1">
                                  <Droplets className="w-3 h-3 text-[#0891b2]" /> Humidity
                                </span>
                                <span className="text-[#0891b2] font-black text-sm block mt-0.5">
                                  {msg.snapshot.humidityPct} <span className="text-[10px] font-normal text-slate-500">%</span>
                                </span>
                              </div>
                              <div className="p-3 rounded-xl bg-white border border-slate-200/60 shadow-2xs col-span-2 sm:col-span-1">
                                <span className="text-slate-500 block text-[10px] uppercase font-bold flex items-center gap-1">
                                  <Activity className="w-3 h-3 text-[#059669]" /> Pressure
                                </span>
                                <span className="text-[#059669] font-black text-sm block mt-0.5">
                                  {msg.snapshot.pressureMmHg} <span className="text-[10px] font-normal text-slate-500">mmHg</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Interactive Step-by-Step Interim Actions */}
                        {!isUser && msg.interimActions && msg.interimActions.length > 0 && (
                          <div className="pt-3 border-t border-slate-100 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sky-900 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                Interim Actions (Pre-Surgeon Protocol):
                              </span>
                              <span className="text-[11px] font-mono text-slate-500">
                                {msg.interimActions.filter((a) => a.completed).length}/
                                {msg.interimActions.length} Verified
                              </span>
                            </div>

                            <div className="space-y-2">
                              {msg.interimActions.map((act) => (
                                <button
                                  key={act.id}
                                  type="button"
                                  onClick={() => toggleInterimAction(msg.id, act.id)}
                                  className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${
                                    act.completed
                                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                                      : "bg-slate-50/70 hover:bg-slate-100/70 border-slate-200 text-slate-900"
                                  }`}
                                >
                                  {act.completed ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                  ) : (
                                    <Circle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <span
                                        className={`font-bold text-xs sm:text-[13px] ${
                                          act.completed
                                            ? "line-through text-emerald-800"
                                            : "text-slate-900"
                                        }`}
                                      >
                                        Step {act.stepNumber}: {act.action}
                                      </span>
                                      <span className="text-[11px] font-mono text-slate-400 shrink-0">
                                        ~{act.estimatedMinutes}m
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-600 mt-1">{act.rationale}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* SpaceLife Library Certified Watchable References */}
                        {!isUser && msg.resources && msg.resources.length > 0 && (
                          <div className="pt-3 border-t border-slate-100 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sky-900 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                                <Film className="w-3.5 h-3.5 text-sky-600" />
                                SpaceLife Library Instructional Guides:
                              </span>
                              <span className="text-[11px] font-mono text-slate-500">
                                {msg.resources.length} Watchable Guide{msg.resources.length > 1 ? "s" : ""}
                              </span>
                            </div>

                            <div className="space-y-3">
                              {msg.resources.map((res) => (
                                <WatchableResourceCard
                                  key={res.id}
                                  resource={res}
                                  onWatch={handleWatchResource}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Contextual Follow-Up Suggestions */}
                        {!isUser && msg.followupQuestions && msg.followupQuestions.length > 0 && (
                          <div className="pt-3 border-t border-slate-100/80">
                            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                              Follow-up questions
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {msg.followupQuestions.map((q, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => void submitQuery(q)}
                                  className="text-xs px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200/80 hover:border-sky-300 text-slate-700 hover:text-sky-800 transition-all text-left cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-98"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                                  <span>{q}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Astronaut Symptom Logging Consent Box */}
                        {!isUser && msg.symptomConsent && (
                          <div className="pt-3 border-t border-slate-100">
                            {msg.symptomConsent.status === "PENDING" && (
                              <div className="rounded-2xl p-4 bg-gradient-to-br from-sky-50/90 via-white to-sky-50/40 border border-sky-200 shadow-sm space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-sky-600 text-white shadow-xs">
                                      <ShieldCheck className="h-3.5 w-3.5" />
                                    </span>
                                    <span className="font-semibold text-xs text-sky-950 tracking-tight">
                                      Log to Station Symptoms &amp; Ground Health Record?
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold uppercase">
                                    Awaiting Permission
                                  </span>
                                </div>

                                <p className="text-xs text-slate-600 leading-relaxed">
                                  Would you like to save this evaluation to the <strong>Expedition Symptoms Diary</strong> and transmit a clinical handoff packet to the Flight Surgeon?
                                </p>

                                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono bg-white/80 p-2 rounded-xl border border-sky-100 text-slate-700">
                                  <span>Crew: <strong>{msg.symptomConsent.astronautId ?? "ASTRO-01"}</strong> ({msg.symptomConsent.callsign ?? "Crew"})</span>
                                  <span>•</span>
                                  <span>Location: <strong>{msg.symptomConsent.location ?? "Node 2"}</strong></span>
                                  <span>•</span>
                                  <span>CO₂: <strong>{(msg.symptomConsent.snapshot?.co2Ppm ?? 0).toLocaleString()} PPM</strong></span>
                                </div>

                                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => dismissSymptomConsent(msg.id)}
                                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                                  >
                                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Keep Private (Guidance Only)</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void confirmSymptomConsent(msg.id)}
                                    className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Save to Symptoms &amp; Alert Surgeon</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {msg.symptomConsent.status === "CONFIRMED" && (
                              <div className="rounded-xl p-3 bg-emerald-50/90 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-3 shadow-xs">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span className="font-semibold">
                                    Logged to Mission Symptoms Diary &amp; Station Health Record
                                  </span>
                                </div>
                                <span className="text-[11px] font-mono text-emerald-700 shrink-0">
                                  {msg.symptomConsent.confirmedAt ?? "Confirmed"} · {msg.symptomConsent.astronautId}
                                </span>
                              </div>
                            )}

                            {msg.symptomConsent.status === "DISMISSED" && (
                              <div className="rounded-xl p-3 bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                                  <span>Kept private in session · Not recorded in official station logs.</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void confirmSymptomConsent(msg.id)}
                                  className="text-[11px] font-semibold text-sky-700 hover:underline cursor-pointer"
                                >
                                  Change mind &amp; Save
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Surgeon Handoff Packet Inspector */}
                        {!isUser && msg.surgeonHandoffPacket && (
                          <div className="pt-2 flex items-center justify-end border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setViewingPacket(msg.surgeonHandoffPacket!)}
                              className="inline-flex items-center gap-1.5 text-xs font-mono text-sky-700 hover:text-sky-900 font-bold cursor-pointer bg-sky-50/60 px-3 py-1.5 rounded-xl border border-sky-200 hover:border-sky-300 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Inspect Surgeon Handoff Packet</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* RAG Context Chips for Assistant Message */}
                        {!isUser && (rule || evidenceList.length > 0) && (
                          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                            {rule && (
                              <button
                                type="button"
                                onClick={() => {
                                  useAssistantStore.getState().latchRule(rule);
                                  setActiveTab("checklists");
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-mono font-medium hover:border-amber-300 transition-colors cursor-pointer"
                              >
                                <FileCheck2 className="w-3.5 h-3.5 text-amber-600" />
                                <span>Latched Rule: {rule.rule_id}</span>
                              </button>
                            )}

                            {evidenceList.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleSourceExpand(msg.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-sky-700 text-xs font-mono font-medium hover:border-sky-300 transition-colors cursor-pointer"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>{evidenceList.length} Grounded Sources</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Expanded RAG Passages */}
                        {!isUser && isExpanded && evidenceList.length > 0 && (
                          <div className="space-y-2.5 pt-3 border-t border-slate-100">
                            <span className="text-[11px] font-mono uppercase tracking-wider text-sky-700 block font-bold">
                              NASA Biomedical RAG Passages:
                            </span>
                            {evidenceList.map((item) => (
                              <div
                                key={item.chunk_id}
                                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1"
                              >
                                <div className="font-bold text-slate-900">
                                  [{item.doc_id}] {item.title}
                                </div>
                                <div className="text-[11px] text-sky-700 font-mono">
                                  {item.section_heading}
                                </div>
                                <p className="mt-1 text-slate-600 leading-normal italic">
                                  "{item.excerpt}"
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Bot Typing Indicator */}
                {isLoading && (
                  <div className="flex items-center gap-3 p-4 max-w-[80%] rounded-[24px] bg-white border border-slate-200 text-xs sm:text-[13px] text-sky-700 shadow-card">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-600 animate-pulse shrink-0" />
                    <span>Synthesizing flight rules &amp; clinical telemetry...</span>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs sm:text-[13px] text-red-700 shadow-xs">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Persistent Chat Input Bar (Perplexity Command Dock) */}
            <div className="shrink-0 space-y-2 border-t border-slate-200/80 bg-white p-4 sm:p-5">
              {/* Flight Surgeon Shift Handover Quick Action Chip */}
              {isFlightSurgeon && (
                <div className="max-w-4xl mx-auto flex items-center gap-2 pb-1">
                  <button
                    type="button"
                    onClick={() => submitQuery("Brief me on the last 12 hours")}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-[11px] font-mono font-semibold transition-all cursor-pointer shadow-2xs group"
                  >
                    <FileCheck2 className="w-3.5 h-3.5 text-sky-600 transition-transform group-hover:scale-110" />
                    <span>Brief me on the last 12 hours</span>
                  </button>
                </div>
              )}
              <form onSubmit={handleQuerySubmit} className="max-w-4xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                {/* Compartment Selector */}
                <div className="flex items-center gap-2 sm:w-48 shrink-0 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2">
                  <Compass className="w-4 h-4 text-sky-600 shrink-0" />
                  <select
                    aria-label="Target Compartment"
                    value={selectedCompartment}
                    onChange={(e) => setSelectedCompartment(e.target.value)}
                    className="w-full bg-transparent text-slate-800 text-xs font-semibold focus:outline-none cursor-pointer"
                  >
                    {CABIN_MODULES.map((mod) => (
                      <option key={mod} value={mod}>
                        {mod}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Input field container */}
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 shadow-xs transition-all focus-within:border-sky-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-500/20">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    placeholder="Ask or report symptoms (e.g., 'Throbbing headache in Node 2')..."
                    className="min-w-0 flex-1 bg-transparent px-3 py-2 font-sans text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none sm:text-sm"
                  />

                  {/* Microphone Dictation Button */}
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`shrink-0 rounded-xl border p-2 transition-colors cursor-pointer ${
                      isListening
                        ? "border-red-600 bg-red-500 text-white animate-pulse shadow-xs"
                        : "border-slate-200 bg-white text-slate-500 hover:border-sky-200 hover:text-sky-700"
                    }`}
                    title={isListening ? "Listening... click to stop" : "Voice dictation (Speech API)"}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  {/* Live voice mode */}
                  <button
                    type="button"
                    onClick={openVoiceModal}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:border-sky-200 hover:text-sky-700 focus-visible:ring-2 focus-visible:ring-sky-500/30 focus-visible:outline-none"
                    title="Live voice mode (Alt+V)"
                    aria-label="Open live voice mode"
                  >
                    <AudioLines className="h-4 w-4" />
                    <span className="hidden text-xs font-semibold sm:inline">Voice</span>
                  </button>

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={!inputQuery.trim() || isLoading}
                    className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 cursor-pointer sm:px-4"
                    title="Send message"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </div>
              </form>

              <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-1 font-mono text-[11px] text-slate-500">
                <span className="hidden sm:inline">
                  Enter to send · Esc to return · Alt+V for voice
                </span>
                <span className="sm:hidden">Enter to send</span>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <button
                    type="button"
                    onClick={handleModelModeToggle}
                    className="group inline-flex items-center gap-1.5 rounded-md py-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-sky-500/30 focus-visible:outline-none"
                    title="Inference engine — click to switch between Frontier (Gemini) and local WebGPU"
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${modelDotClass}`}
                      aria-hidden="true"
                    />
                    <span>Model</span>
                    <span className="font-semibold text-slate-700 transition-colors group-hover:text-slate-900">
                      {modelLabel}
                    </span>
                  </button>

                  <span className="h-3 w-px bg-slate-200" aria-hidden="true" />

                  <button
                    type="button"
                    onClick={() => setShowApiKeyModal(true)}
                    className="inline-flex items-center gap-1 rounded-md py-0.5 transition-colors hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500/30 focus-visible:outline-none"
                    title={
                      hasApiKey
                        ? "Gemini API key configured — manage key"
                        : "Add a Gemini API key for frontier inference"
                    }
                  >
                    <KeyRound className="h-3 w-3" aria-hidden="true" />
                    <span>{hasApiKey ? "Key connected" : "Connect key"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Procedural Checklists */}
        {activeTab === "checklists" && (
          <div className="drawer-scroll flex-1 overflow-y-auto px-6 sm:px-8 py-6">
            <div className="max-w-4xl mx-auto w-full space-y-6">
              {latchedRule ? (
                <div className="rounded-[28px] bg-slate-50 border border-slate-200 p-6 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-mono font-bold tracking-tight border border-sky-200">
                      {latchedRule.rule_id}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Revision: {latchedRule.revision_date}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                    {latchedRule.title}
                  </h3>
                  <div className="text-xs text-slate-700 bg-white rounded-2xl p-4 border border-slate-200 space-y-1">
                    <span className="text-sky-700 font-mono text-xs font-bold block uppercase tracking-wider">
                      Condition Threshold:
                    </span>
                    <p className="leading-relaxed">{latchedRule.condition_threshold}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-emerald-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span>SHA-256: {latchedRule.sha256_hash ? latchedRule.sha256_hash.slice(0, 16) : "VERIFIED"}... (Verified NASA Certified Flight Rule)</span>
                  </div>
                </div>
              ) : null}

              {checklistSteps.length > 0 ? (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-sky-800 font-mono">
                      Operational Checklist Steps
                    </h4>
                    <span className="text-xs font-mono text-slate-500 font-semibold">
                      {Object.values(completedSteps).filter(Boolean).length} / {checklistSteps.length} Verified
                    </span>
                  </div>

                  <div className="space-y-3">
                    {checklistSteps.map((step) => {
                      const isDone = Boolean(completedSteps[step.step_number]);
                      return (
                        <div
                          key={step.step_number}
                          onClick={() => toggleStep(step.step_number)}
                          className={`group p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer bg-white ${
                            isDone
                              ? "border-slate-200 opacity-60 bg-slate-50/50"
                              : "border-slate-200 shadow-xs hover:border-sky-300 hover:shadow-card"
                          }`}
                        >
                          <div className="flex items-start gap-3.5">
                            <button
                              type="button"
                              className="mt-0.5 text-slate-400 group-hover:text-sky-600 transition-colors cursor-pointer"
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <Circle className="w-5 h-5" />
                              )}
                            </button>
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-mono font-bold text-sky-700">
                                  Step {step.step_number} · {step.target_subsystem}
                                </span>
                              </div>
                              <p
                                className={`text-xs sm:text-[13px] leading-relaxed ${
                                  isDone ? "text-slate-400 line-through" : "text-slate-900 font-bold"
                                }`}
                              >
                                {step.action}
                              </p>
                              {step.verification && (
                                <div className="text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                                  <span className="font-bold text-slate-500">Verification: </span>
                                  {step.verification}
                                </div>
                              )}
                              {step.caution_warning && (
                                <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl flex items-center gap-2">
                                  <TriangleAlert className="w-4 h-4 text-amber-600 shrink-0" />
                                  <span>{step.caution_warning}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <div className="p-12 text-center rounded-[28px] border border-dashed border-slate-300 text-slate-500 text-xs sm:text-sm bg-white">
                  No active flight rule latched. Report a symptom or ask a question to latch a flight rule checklist.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Detailed Scientific Evidence */}
        {activeTab === "evidence" && (
          <div className="drawer-scroll flex-1 overflow-y-auto px-6 sm:px-8 py-6">
            <div className="max-w-4xl mx-auto w-full space-y-6">
              {activeEvent && (
                <div className="rounded-[28px] bg-white border border-slate-200 p-6 shadow-card space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`badge border ${uncertaintyTheme(
                        activeEvent.uncertainty_level,
                      )}`}
                    >
                      {activeEvent.severity_level} · {activeEvent.uncertainty_level} uncertainty
                    </span>
                    <Badge variant="default">{activeEvent.event_id}</Badge>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    {titleCase(activeEvent.event_type)}
                  </h3>
                  <p className="text-xs sm:text-[13px] leading-relaxed text-slate-700 font-medium">
                    {parseEventRationale(activeEvent.rationale, activeEvent.event_type).summary}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {parseStreamIds(activeEvent.contributing_stream_ids).map((stream) => (
                      <span
                        key={stream}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-600"
                      >
                        {prettyStream(stream)}
                      </span>
                    ))}
                    {activeEvent.peak_deviation_sigma !== null ? (
                      <span className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 font-mono text-[11px] text-sky-700 font-bold">
                        peak {formatSigned(activeEvent.peak_deviation_sigma, 2)} σ
                      </span>
                    ) : null}
                  </div>
                </div>
              )}

              {activeExplanation ? (
                <div className="space-y-6">
                  <section className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
                    <h3 className="text-sm sm:text-base font-black leading-snug text-slate-900">
                      {activeExplanation.headline}
                    </h3>
                  </section>

                  <section className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-sky-800 font-mono">
                      Observed dynamics
                    </h3>
                    <p className="text-xs sm:text-[13px] leading-relaxed text-slate-700">
                      {activeExplanation.observed_dynamics}
                    </p>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-sky-800 font-mono">
                        Scientific Context &amp; Evidence
                      </h3>
                      <span className="text-xs text-sky-700 font-mono font-bold">
                        {activeExplanation.cited_evidence?.length ?? 0} cited
                      </span>
                    </div>
                    <p className="text-xs sm:text-[13px] leading-relaxed text-slate-500">
                      {activeExplanation.scientific_context}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                      {(activeExplanation.cited_evidence ?? []).map((evidence) => (
                        <EvidenceCard key={evidence.chunk_id} evidence={evidence} compact />
                      ))}
                    </div>
                  </section>

                  {activeExplanation.study_caveats.length > 0 && (
                    <section className="rounded-2xl bg-amber-50/70 border border-amber-200 p-5">
                      <div className="flex items-center gap-2 text-amber-800 font-bold">
                        <TriangleAlert className="h-4 w-4 text-amber-600" />
                        <h3 className="text-xs sm:text-[13px]">Study caveats</h3>
                      </div>
                      <ul className="mt-2.5 space-y-2">
                        {activeExplanation.study_caveats.map((caveat) => (
                          <li
                            key={caveat}
                            className="flex items-start gap-2 text-xs leading-relaxed text-slate-700"
                          >
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                            {caveat}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 font-mono">
                    <span className="inline-flex items-center gap-1 text-sky-700">
                      <Clock3 className="h-3.5 w-3.5" />
                      {activeExplanation.latency_ms.toFixed(1)} ms
                    </span>
                    <span>{activeExplanation.interaction_id.slice(0, 8)}</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Downlink Packet Inspector Modal */}
      {viewingPacket && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md"
          onClick={() => setViewingPacket(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-[28px] bg-white border border-slate-200 shadow-2xl p-6 space-y-5 font-sans animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                  Surgeon Telemetry Handoff Packet
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingPacket(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">PACKET ID</span>
                  <span className="font-bold text-slate-900">{viewingPacket.packetId}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">ASTRONAUT</span>
                  <span className="font-bold text-slate-900">{viewingPacket.astronautId}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">COMPARTMENT</span>
                  <span className="font-bold text-sky-700">{viewingPacket.compartmentName}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Symptom Reported</span>
                <p className="font-semibold text-slate-900 text-xs sm:text-[13px]">{viewingPacket.symptomReported}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Environmental Snapshot At Excursion</span>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                  <span>CO₂: <strong className="text-slate-900">{viewingPacket.environmentalSnapshot?.co2Ppm ?? "—"}</strong> ppm</span>
                  <span>Temp: <strong className="text-slate-900">{viewingPacket.environmentalSnapshot?.tempC ?? "—"}</strong> °C</span>
                  <span>Humidity: <strong className="text-slate-900">{viewingPacket.environmentalSnapshot?.humidityPct ?? "—"}</strong>%</span>
                  <span>Rad: <strong className="text-slate-900">{viewingPacket.environmentalSnapshot?.radiationRateMGy ?? "—"}</strong> mGy</span>
                  <span>Press: <strong className="text-slate-900">{viewingPacket.environmentalSnapshot?.pressureMmHg ?? "—"}</strong> mmHg</span>
                  <span className="text-sky-700 font-bold">Rule: {viewingPacket.latchedRuleId}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewingPacket(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SpaceLife Library Guide Video Modal */}
      {selectedGuideForModal && (
        <GuideDetailModal
          guide={selectedGuideForModal}
          onClose={() => setSelectedGuideForModal(null)}
        />
      )}

      {/* Gemini 2.5 Flash API Key & Diagnostics Modal */}
      <GeminiApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
      />
    </div>
  );
};
