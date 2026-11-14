/**
 * web/src/components/AssistantDrawer.tsx: Unified Conversational Standby & Clinical Triage AI Chatbot
 * Combines direct grounded answers, expandable RAG evidence, NASA Flight Rules,
 * Mastra 5-factor environmental triage, interim countermeasure checkboxes,
 * and surgeon handoff packet inspection into a single calm, high-usability workstation drawer.
 */

import {
  Activity,
  AlertTriangle,
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
  Flame,
  MessageSquare,
  Mic,
  MicOff,
  Microscope,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
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
  type AssistantTab,
  type ChatMessage,
  type InterimActionItem,
  type SurgeonHandoffPacket,
} from "../stores/assistantStore";
import { EvidenceCard } from "./EvidenceCard";
import { ProviderStatusBadge } from "./ProviderStatusBadge";
import { parseEventRationale } from "./EventRationaleDisplay";
import { Badge } from "./ui";

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
  "🩺 Run full 5-factor triage",
  "Headache & throbbing in Node 2",
  "Stinging irritated eyes in Columbus",
  "Dizziness upon waking in crew quarters",
  "Overheating after workout in US Lab",
  "Check ECLSS CO2 flight rule limits",
];

export function AssistantDrawer() {
  const isOpen = useAssistantStore((state) => state.isOpen);
  const isLoading = useAssistantStore((state) => state.isLoading);
  const activeTab = useAssistantStore((state) => state.activeTab);
  const setActiveTab = useAssistantStore((state) => state.setActiveTab);
  const messages = useAssistantStore((state) => state.messages);
  const activeEvent = useAssistantStore((state) => state.activeEvent);
  const activeExplanation = useAssistantStore((state) => state.activeExplanation);
  const latchedRule = useAssistantStore((state) => state.latchedRule);
  const selectedCompartment = useAssistantStore((state) => state.selectedCompartment);
  const setSelectedCompartment = useAssistantStore((state) => state.setSelectedCompartment);
  const toggleInterimAction = useAssistantStore((state) => state.toggleInterimAction);
  const error = useAssistantStore((state) => state.error);
  const closeDrawer = useAssistantStore((state) => state.closeDrawer);
  const submitQuery = useAssistantStore((state) => state.submitQuery);
  const clearChat = useAssistantStore((state) => state.clearChat);

  const [inputQuery, setInputQuery] = useState("");
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [isListening, setIsListening] = useState(false);
  const [viewingPacket, setViewingPacket] = useState<SurgeonHandoffPacket | null>(null);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto scroll chat to bottom on new messages
  useEffect(() => {
    if (activeTab === "chat" && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, activeTab]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen && activeTab === "chat") {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, activeTab]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDrawer();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closeDrawer]);

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

  // Web Speech API Voice Recognition
  const toggleListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

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
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputQuery(transcript);
        setIsListening(false);
        submitQuery(transcript);
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
    <>
      <aside
        aria-hidden={!isOpen}
        aria-label="Standby AI assistant drawer"
        className={`fixed inset-y-0 right-0 z-40 flex w-[580px] max-w-full flex-col border-l border-border bg-white shadow-elevated transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
      >
        {/* Top Header */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-white px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-sky-200 bg-sky-50 text-sky-600">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-foreground font-mono">
                  HABITAT TRACE CLINICAL CO-PILOT
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Mastra 5-Factor
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <ProviderStatusBadge />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {activeTab === "chat" && messages.length > 1 && (
              <button
                type="button"
                onClick={clearChat}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface-subtle text-muted hover:text-red-700 hover:border-red-200 transition-colors cursor-pointer"
                title="Clear conversation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={closeDrawer}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface-subtle text-muted hover:text-foreground hover:border-border-strong transition-colors cursor-pointer"
              aria-label="Close assistant drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Tabs Selector */}
        <div className="flex items-center px-4 py-2 gap-1.5 border-b border-border bg-surface-subtle">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium tracking-tight transition-colors duration-200 cursor-pointer border ${
              activeTab === "chat"
                ? "bg-white border-sky-200 text-sky-700 shadow-sm"
                : "text-muted hover:text-foreground hover:bg-white/60 border-transparent"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Triage &amp; Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("checklists")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium tracking-tight transition-colors duration-200 cursor-pointer border ${
              activeTab === "checklists"
                ? "bg-white border-sky-200 text-sky-700 shadow-sm"
                : "text-muted hover:text-foreground hover:bg-white/60 border-transparent"
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Flight Checklists</span>
            {checklistSteps.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-700 text-[11px] font-mono">
                {checklistSteps.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("evidence")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium tracking-tight transition-colors duration-200 cursor-pointer border ${
              activeTab === "evidence"
                ? "bg-white border-sky-200 text-sky-700 shadow-sm"
                : "text-muted hover:text-foreground hover:bg-white/60 border-transparent"
            }`}
          >
            <Microscope className="w-3.5 h-3.5" />
            <span>Research RAG</span>
            {activeExplanation?.cited_evidence.length ? (
              <span className="px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-700 text-[11px] font-mono">
                {activeExplanation.cited_evidence.length}
              </span>
            ) : null}
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-canvas">
          {/* Tab 1: Conversational Chatbot & Triage */}
          {activeTab === "chat" && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Quick Suggestion Chips */}
              <div className="px-5 py-2.5 bg-surface-subtle border-b border-border-subtle flex flex-wrap gap-1.5 shrink-0">
                {CLINICAL_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => submitQuery(sug)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white hover:bg-sky-50 border border-border hover:border-sky-300 text-secondary hover:text-sky-700 transition-colors cursor-pointer shadow-2xs"
                  >
                    {sug}
                  </button>
                ))}
              </div>

              {/* Messages Stream */}
              <div
                ref={chatScrollRef}
                className="drawer-scroll flex-1 overflow-y-auto px-5 py-4 space-y-4"
              >
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
                        className={`max-w-[94%] rounded-2xl p-4 text-xs leading-relaxed space-y-3 ${
                          isUser
                            ? "bg-sky-50 border border-sky-200 text-foreground rounded-tr-none shadow-xs"
                            : "bg-white border border-border text-foreground rounded-tl-none shadow-card"
                        }`}
                      >
                        {/* Header line for sender and location */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono pb-1 border-b border-border-subtle">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-semibold ${
                                isUser ? "text-sky-800" : "text-sky-700 uppercase tracking-wider"
                              }`}
                            >
                              {isUser ? "Astronaut (Crew)" : "Habitat Trace Flight Co-Pilot"}
                            </span>
                            {msg.location && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-subtle text-secondary border border-border">
                                <Compass className="w-3 h-3 text-sky-600" />
                                {msg.location}
                              </span>
                            )}
                            {msg.latchedRuleId && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                                <ShieldCheck className="w-3 h-3 text-amber-600" />
                                {msg.latchedRuleId}
                              </span>
                            )}
                          </div>
                          <span className="text-muted">{msg.timestamp}</span>
                        </div>

                        {/* Content text */}
                        <div className="whitespace-pre-wrap font-sans leading-relaxed">
                          {msg.text}
                        </div>

                        {/* Embedded 5-Factor Telemetry Scorecard */}
                        {!isUser && msg.snapshot && (
                          <div className="p-3 rounded-xl bg-surface-subtle border border-border space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-mono text-muted">
                              <span className="font-bold uppercase tracking-wider text-[10px]">
                                5-Factor Compartment Telemetry
                              </span>
                              {msg.lagWindow && (
                                <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                                  <Clock className="w-3 h-3" />
                                  Lag: {msg.lagWindow}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[11px] font-mono">
                              <div className="px-2 py-1.5 rounded-lg bg-white border border-border-subtle">
                                <span className="text-muted block text-[10px] flex items-center gap-1">
                                  <Wind className="w-2.5 h-2.5 text-[#0284c7]" /> CO₂
                                </span>
                                <span className="text-[#0284c7] font-bold">
                                  {msg.snapshot.co2Ppm} ppm
                                </span>
                              </div>
                              <div className="px-2 py-1.5 rounded-lg bg-white border border-border-subtle">
                                <span className="text-muted block text-[10px] flex items-center gap-1">
                                  <Radio className="w-2.5 h-2.5 text-[#d97706]" /> Rad
                                </span>
                                <span className="text-[#d97706] font-bold">
                                  {msg.snapshot.radiationRateMGy} mGy
                                </span>
                              </div>
                              <div className="px-2 py-1.5 rounded-lg bg-white border border-border-subtle">
                                <span className="text-muted block text-[10px] flex items-center gap-1">
                                  <Flame className="w-2.5 h-2.5 text-[#ea580c]" /> Temp
                                </span>
                                <span className="text-[#ea580c] font-bold">
                                  {msg.snapshot.tempC} °C
                                </span>
                              </div>
                              <div className="px-2 py-1.5 rounded-lg bg-white border border-border-subtle">
                                <span className="text-muted block text-[10px] flex items-center gap-1">
                                  <Droplets className="w-2.5 h-2.5 text-[#0891b2]" /> Hum
                                </span>
                                <span className="text-[#0891b2] font-bold">
                                  {msg.snapshot.humidityPct}%
                                </span>
                              </div>
                              <div className="px-2 py-1.5 rounded-lg bg-white border border-border-subtle col-span-2 sm:col-span-1">
                                <span className="text-muted block text-[10px] flex items-center gap-1">
                                  <Activity className="w-2.5 h-2.5 text-[#059669]" /> Press
                                </span>
                                <span className="text-[#059669] font-bold">
                                  {msg.snapshot.pressureMmHg} mmHg
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Interactive Step-by-Step Interim Actions */}
                        {!isUser && msg.interimActions && msg.interimActions.length > 0 && (
                          <div className="pt-2 border-t border-border space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sky-800 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                Interim Actions (Pre-Surgeon Protocol):
                              </span>
                              <span className="text-[10px] font-mono text-muted">
                                {msg.interimActions.filter((a) => a.completed).length}/
                                {msg.interimActions.length} Done
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              {msg.interimActions.map((act) => (
                                <button
                                  key={act.id}
                                  type="button"
                                  onClick={() => toggleInterimAction(msg.id, act.id)}
                                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 cursor-pointer ${
                                    act.completed
                                      ? "bg-emerald-50/80 border-emerald-300 text-emerald-950"
                                      : "bg-surface-subtle hover:bg-slate-50 border-border text-foreground"
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
                                        className={`font-semibold text-xs ${
                                          act.completed
                                            ? "line-through text-emerald-800"
                                            : "text-foreground"
                                        }`}
                                      >
                                        Step {act.stepNumber}: {act.action}
                                      </span>
                                      <span className="text-[10px] font-mono text-muted shrink-0">
                                        ~{act.estimatedMinutes}m
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-muted mt-0.5">{act.rationale}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Surgeon handoff packet inspector */}
                        {!isUser && msg.surgeonHandoffPacket && (
                          <div className="pt-2 flex items-center justify-end border-t border-border">
                            <button
                              type="button"
                              onClick={() => setViewingPacket(msg.surgeonHandoffPacket!)}
                              className="inline-flex items-center gap-1 text-[11px] font-mono text-sky-700 hover:text-sky-900 font-semibold cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Inspect Surgeon Handoff Packet</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* RAG Context Chips for Assistant Message */}
                        {!isUser && (rule || evidenceList.length > 0) && (
                          <div className="pt-2 border-t border-border flex flex-wrap items-center gap-2">
                            {rule && (
                              <button
                                type="button"
                                onClick={() => {
                                  useAssistantStore.getState().latchRule(rule);
                                  setActiveTab("checklists");
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-mono hover:border-amber-300 transition-colors cursor-pointer"
                              >
                                <FileCheck2 className="w-3 h-3 text-amber-600" />
                                <span>Latched Rule: {rule.rule_id}</span>
                              </button>
                            )}

                            {evidenceList.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleSourceExpand(msg.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-subtle border border-border text-sky-700 text-[11px] font-mono hover:border-sky-300 transition-colors cursor-pointer"
                              >
                                <BookOpen className="w-3 h-3" />
                                <span>{evidenceList.length} Grounded Sources</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Expanded RAG Passages */}
                        {!isUser && isExpanded && evidenceList.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-border">
                            <span className="text-[11px] font-mono uppercase tracking-wider text-sky-700 block mb-1">
                              NASA Biomedical RAG Passages:
                            </span>
                            {evidenceList.map((item) => (
                              <div
                                key={item.chunk_id}
                                className="p-2.5 rounded-lg bg-surface-subtle border border-border text-[11px] text-secondary"
                              >
                                <div className="font-semibold text-foreground">
                                  [{item.doc_id}] {item.title}
                                </div>
                                <div className="text-[11px] text-sky-700 font-mono mt-0.5">
                                  {item.section_heading}
                                </div>
                                <p className="mt-1 text-muted leading-normal italic">
                                  "{item.excerpt}"
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Epistemic disclaimer if provided */}
                        {!isUser && msg.disclaimer && (
                          <p className="text-[10px] text-muted italic pt-1 border-t border-border-subtle">
                            {msg.disclaimer}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Bot Typing Indicator */}
                {isLoading && (
                  <div className="flex items-center gap-2 p-3 max-w-[80%] rounded-xl bg-white border border-border text-xs text-sky-700">
                    <span className="w-2 h-2 rounded-full bg-sky-600 animate-pulse" />
                    <span>Executing Mastra 5-factor triage &amp; NASA RAG synthesis...</span>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              {/* Persistent Chat Input Bar with Compartment Selector and Mic */}
              <div className="p-3.5 border-t border-border bg-white space-y-2">
                <form onSubmit={handleQuerySubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {/* Compartment Selector */}
                  <div className="flex items-center gap-1.5 sm:w-44 shrink-0">
                    <Compass className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <select
                      aria-label="Target Compartment"
                      value={selectedCompartment}
                      onChange={(e) => setSelectedCompartment(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg bg-surface-subtle border border-border text-foreground text-xs focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      {CABIN_MODULES.map((mod) => (
                        <option key={mod} value={mod}>
                          {mod}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Input field */}
                  <div className="flex-1 flex items-center gap-1.5">
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputQuery}
                      onChange={(e) => setInputQuery(e.target.value)}
                      placeholder="Ask or report symptoms (e.g., 'Throbbing headache in Node 2')..."
                      className="flex-1 px-3 py-2 rounded-lg bg-surface-subtle border border-border text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-sky-500 focus:bg-white transition-colors font-sans"
                    />

                    {/* Microphone Dictation Button */}
                    <button
                      type="button"
                      onClick={toggleListening}
                      className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                        isListening
                          ? "bg-red-50 border-red-300 text-red-600 animate-pulse"
                          : "bg-surface-subtle border-border text-muted hover:text-sky-700"
                      }`}
                      title={isListening ? "Listening... click to stop" : "Voice dictation (Speech API)"}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>

                    {/* Send Button */}
                    <button
                      type="submit"
                      disabled={!inputQuery.trim() || isLoading}
                      className="flex items-center justify-center px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:hover:bg-sky-600 text-white font-semibold text-xs shadow-sm transition-all cursor-pointer"
                      title="Send message"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>

                <div className="flex items-center justify-between px-1 text-[11px] text-muted font-mono">
                  <span>Enter to send · Ctrl+K to toggle</span>
                  <span>5-Factor Corroboration Active</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Procedural Checklists */}
          {activeTab === "checklists" && (
            <div className="drawer-scroll flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {latchedRule ? (
                <div className="rounded-xl bg-white border border-sky-200 p-4 space-y-3 shadow-card">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-md bg-sky-50 text-sky-700 text-[11px] font-mono font-medium tracking-tight border border-sky-200">
                      {latchedRule.rule_id}
                    </span>
                    <span className="text-[11px] font-mono text-muted">
                      Revision: {latchedRule.revision_date}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground tracking-tight leading-snug">
                    {latchedRule.title}
                  </h3>
                  <div className="text-xs text-secondary bg-surface-subtle rounded-lg p-2.5 border border-border">
                    <span className="text-sky-700 font-mono text-[11px] block mb-1">
                      Condition Threshold:
                    </span>
                    {latchedRule.condition_threshold}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    <span>SHA-256: {latchedRule.sha256_hash.slice(0, 12)}... (Verified NASA Certified)</span>
                  </div>
                </div>
              ) : null}

              {checklistSteps.length > 0 ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-700 font-mono">
                      Operational Checklist Steps
                    </h4>
                    <span className="text-[11px] font-mono text-muted">
                      {Object.values(completedSteps).filter(Boolean).length} / {checklistSteps.length} Verified
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {checklistSteps.map((step) => {
                      const isDone = Boolean(completedSteps[step.step_number]);
                      return (
                        <div
                          key={step.step_number}
                          onClick={() => toggleStep(step.step_number)}
                          className={`group p-3.5 rounded-xl border transition-all duration-200 cursor-pointer bg-white ${
                            isDone
                              ? "border-border opacity-60"
                              : "border-border glass-card-hover"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              className="mt-0.5 text-muted group-hover:text-sky-600 transition-colors cursor-pointer"
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Circle className="w-4 h-4" />
                              )}
                            </button>
                            <div className="flex-1 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-mono font-medium text-sky-700">
                                  Step {step.step_number} · {step.target_subsystem}
                                </span>
                              </div>
                              <p
                                className={`text-xs leading-relaxed ${
                                  isDone ? "text-muted line-through" : "text-foreground font-medium"
                                }`}
                              >
                                {step.action}
                              </p>
                              {step.verification && (
                                <div className="text-[11px] font-mono text-secondary bg-surface-subtle border border-border px-2.5 py-1 rounded-md">
                                  Verification: {step.verification}
                                </div>
                              )}
                              {step.caution_warning && (
                                <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                                  <TriangleAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
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
                <div className="p-8 text-center rounded-xl border border-dashed border-border text-muted text-xs">
                  No active flight rule latched. Report a symptom or ask a question to latch a flight rule checklist.
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Detailed Scientific Evidence */}
          {activeTab === "evidence" && (
            <div className="drawer-scroll flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {activeEvent && (
                <div className="rounded-xl bg-white border border-border p-4 shadow-card">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`badge border ${uncertaintyTheme(
                        activeEvent.uncertainty_level,
                      )}`}
                    >
                      {activeEvent.severity_level} · {activeEvent.uncertainty_level} uncertainty
                    </span>
                    <Badge variant="default">{activeEvent.event_id}</Badge>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-foreground">
                    {titleCase(activeEvent.event_type)}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-secondary font-medium">
                    {parseEventRationale(activeEvent.rationale, activeEvent.event_type).summary}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {parseStreamIds(activeEvent.contributing_stream_ids).map((stream) => (
                      <span
                        key={stream}
                        className="rounded-md border border-border bg-surface-subtle px-2 py-0.5 font-mono text-[11px] text-muted"
                      >
                        {prettyStream(stream)}
                      </span>
                    ))}
                    {activeEvent.peak_deviation_sigma !== null ? (
                      <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 font-mono text-[11px] text-sky-700">
                        peak {formatSigned(activeEvent.peak_deviation_sigma, 2)} σ
                      </span>
                    ) : null}
                  </div>
                </div>
              )}

              {activeExplanation ? (
                <div className="space-y-4">
                  <section className="rounded-xl bg-white border border-border p-4 shadow-card">
                    <h3 className="text-sm font-semibold leading-snug text-foreground">
                      {activeExplanation.headline}
                    </h3>
                  </section>

                  <section className="rounded-xl bg-white border border-border p-4 shadow-card">
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-700 font-mono">
                      Observed dynamics
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-secondary">
                      {activeExplanation.observed_dynamics}
                    </p>
                  </section>

                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-700 font-mono">
                        Scientific context
                      </h3>
                      <span className="text-xs text-sky-700 font-mono">
                        {activeExplanation.cited_evidence.length} cited
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted mb-3">
                      {activeExplanation.scientific_context}
                    </p>
                    <div className="space-y-2.5">
                      {activeExplanation.cited_evidence.map((evidence) => (
                        <EvidenceCard key={evidence.chunk_id} evidence={evidence} compact />
                      ))}
                    </div>
                  </section>

                  {activeExplanation.study_caveats.length > 0 && (
                    <section className="rounded-xl bg-amber-50/70 border border-amber-200 p-4">
                      <div className="flex items-center gap-2 text-amber-800">
                        <TriangleAlert className="h-3.5 w-3.5 text-amber-600" />
                        <h3 className="text-xs font-semibold text-foreground">Study caveats</h3>
                      </div>
                      <ul className="mt-2 space-y-1.5">
                        {activeExplanation.study_caveats.map((caveat) => (
                          <li
                            key={caveat}
                            className="flex items-start gap-2 text-xs leading-relaxed text-secondary"
                          >
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                            {caveat}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted pt-1">
                    <span className="inline-flex items-center gap-1 font-mono text-sky-700">
                      <Clock3 className="h-3 w-3" />
                      {activeExplanation.latency_ms.toFixed(1)} ms
                    </span>
                    <span className="font-mono">{activeExplanation.interaction_id.slice(0, 8)}</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

      </aside>

      {/* Downlink Packet Inspector Modal */}
      {viewingPacket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-border shadow-elevated p-6 space-y-4 font-sans animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-600" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Surgeon Telemetry Handoff Packet
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingPacket(null)}
                className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2.5 rounded-xl bg-surface-subtle border border-border">
                  <span className="text-muted block text-[10px]">PACKET ID</span>
                  <span className="font-bold text-foreground">{viewingPacket.packetId}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-subtle border border-border">
                  <span className="text-muted block text-[10px]">ASTRONAUT</span>
                  <span className="font-bold text-foreground">{viewingPacket.astronautId}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-subtle border border-border">
                  <span className="text-muted block text-[10px]">COMPARTMENT</span>
                  <span className="font-bold text-sky-700">{viewingPacket.compartmentName}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-subtle border border-border space-y-1">
                <span className="text-[10px] font-mono uppercase text-muted block">Symptom Reported</span>
                <p className="font-medium text-foreground">{viewingPacket.symptomReported}</p>
              </div>

              <div className="p-3 rounded-xl bg-surface-subtle border border-border space-y-1">
                <span className="text-[10px] font-mono uppercase text-muted block">Environmental Snapshot At Excursion</span>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                  <span>CO₂: {viewingPacket.environmentalSnapshot.co2Ppm} ppm</span>
                  <span>Temp: {viewingPacket.environmentalSnapshot.tempC} °C</span>
                  <span>Humidity: {viewingPacket.environmentalSnapshot.humidityPct}%</span>
                  <span>Rad: {viewingPacket.environmentalSnapshot.radiationRateMGy} mGy</span>
                  <span>Press: {viewingPacket.environmentalSnapshot.pressureMmHg} mmHg</span>
                  <span className="text-sky-700 font-semibold">Rule: {viewingPacket.latchedRuleId}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setViewingPacket(null)}
                className="px-4 py-2 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
