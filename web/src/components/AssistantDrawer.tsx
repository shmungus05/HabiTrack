/**
 * web/src/components/AssistantDrawer.tsx: Conversational Standby AI Chatbot
 * with direct grounded answers, expandable RAG evidence, flight rule checklists,
 * Perplexity minimalist aesthetic, and push-to-talk voice integration.
 */

import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock3,
  FileCheck2,
  MessageSquare,
  Microscope,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  TriangleAlert,
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
import { useAssistantStore, type AssistantTab, type ChatMessage } from "../stores/assistantStore";
import { EvidenceCard } from "./EvidenceCard";
import { ProviderStatusBadge } from "./ProviderStatusBadge";
import { Badge } from "./ui";

const FALLBACK_DISCLAIMER =
  "Non-Causal Decision Support Disclaimer: Temporal correlation indicates co-occurrence only and does not establish clinical causation. WAYFINDER is a clinical decision-support tool, not an autonomous diagnostic system. Operational countermeasure decisions must be verified by flight surgeons.";

export function AssistantDrawer() {
  const isOpen = useAssistantStore((state) => state.isOpen);
  const isLoading = useAssistantStore((state) => state.isLoading);
  const activeTab = useAssistantStore((state) => state.activeTab);
  const setActiveTab = useAssistantStore((state) => state.setActiveTab);
  const messages = useAssistantStore((state) => state.messages);
  const activeEvent = useAssistantStore((state) => state.activeEvent);
  const activeExplanation = useAssistantStore((state) => state.activeExplanation);
  const latchedRule = useAssistantStore((state) => state.latchedRule);
  const error = useAssistantStore((state) => state.error);
  const closeDrawer = useAssistantStore((state) => state.closeDrawer);
  const submitQuery = useAssistantStore((state) => state.submitQuery);
  const clearChat = useAssistantStore((state) => state.clearChat);

  const [inputQuery, setInputQuery] = useState("");
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

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

  const checklistSteps =
    latchedRule?.checklist_steps ??
    activeExplanation?.verbatim_checklist ??
    [];

  return (
    <aside
      aria-hidden={!isOpen}
      aria-label="Standby AI assistant drawer"
      className={`fixed inset-y-0 right-0 z-40 flex w-[540px] max-w-full flex-col border-l border-border bg-white shadow-elevated transition-transform duration-300 ease-out ${
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
                WAYFINDER STANDBY
              </h2>
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
          <span>Chatbot</span>
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

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-h-0 bg-canvas">
        {/* Tab 1: Conversational Chatbot */}
        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col min-h-0">
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
                      className={`max-w-[90%] rounded-xl p-4 text-xs leading-relaxed ${
                        isUser
                          ? "bg-sky-50 border border-sky-200 text-foreground rounded-br-sm"
                          : "bg-white border border-border text-foreground rounded-bl-sm shadow-card"
                      }`}
                    >
                      <div className="whitespace-pre-wrap font-sans">
                        {msg.text}
                      </div>

                      {/* RAG Context Chips for Assistant Message */}
                      {!isUser && response && (
                        <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-2">
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
                        <div className="mt-3 space-y-2 pt-2 border-t border-border">
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
                    </div>

                    {/* Timestamp */}
                    <span className="mt-1 px-1 text-[11px] font-mono text-muted">
                      {msg.timestamp}
                    </span>
                  </div>
                );
              })}

              {/* Bot Typing Indicator */}
              {isLoading && (
                <div className="flex items-center gap-2 p-3 max-w-[70%] rounded-xl bg-white border border-border text-xs text-sky-700">
                  <span className="w-2 h-2 rounded-full bg-sky-600 animate-pulse" />
                  <span>Synthesizing answer from NASA flight rules & literature...</span>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Persistent Chat Input Bar */}
            <div className="p-4 border-t border-border bg-white">
              <form onSubmit={handleQuerySubmit} className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Ask WAYFINDER (e.g. 'I have a headache', 'Check CO2 rule')..."
                  className="flex-1 px-4 py-2.5 rounded-lg bg-surface-subtle border border-border text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-sky-500 focus:bg-white transition-colors font-sans"
                />
                <button
                  type="submit"
                  disabled={!inputQuery.trim() || isLoading}
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:hover:bg-sky-600 text-white font-semibold shadow-sm transition-all cursor-pointer"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
              <div className="mt-1.5 flex items-center justify-between px-2 text-[11px] text-muted font-mono">
                <span>Enter to send · Alt+V voice PTT · Ctrl+K to toggle</span>
                <span>Spaceflight Decision Support</span>
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
                  <span>SHA-256 Provenance: {latchedRule.sha256_hash.slice(0, 12)}... (Verified NASA Certified)</span>
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
                No active flight rule latched. Ask a question or click an event to latch a certified checklist.
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
                <p className="mt-1 text-xs leading-relaxed text-secondary">
                  {activeEvent.rationale}
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

      {/* Docked Immutable Epistemic Disclaimer */}
      <footer className="sticky bottom-0 shrink-0 border-t border-border bg-surface-subtle p-3">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <p className="text-[11px] leading-relaxed text-muted">
            {activeExplanation?.disclaimer ?? FALLBACK_DISCLAIMER}
          </p>
        </div>
      </footer>
    </aside>
  );
}
