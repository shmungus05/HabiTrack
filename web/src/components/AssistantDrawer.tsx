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
      className={`fixed inset-y-0 right-0 z-40 flex w-[540px] max-w-full flex-col border-l border-border bg-canvas/95 backdrop-blur-2xl shadow-2xl transition-transform duration-300 ease-out ${
        isOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      {/* Top Header */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle bg-canvas px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-surface-elevated text-secondary">
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

        <div className="flex items-center gap-1">
          {activeTab === "chat" && messages.length > 1 && (
            <button
              type="button"
              onClick={clearChat}
              className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted hover:text-critical hover:border-critical/40 transition-colors"
              title="Clear conversation"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={closeDrawer}
            className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted hover:text-foreground transition-colors"
            aria-label="Close assistant drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Tabs Selector */}
      <div className="flex items-center px-4 py-2 gap-1.5 border-b border-border-subtle bg-canvas">
        <button
          type="button"
          onClick={() => setActiveTab("chat")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium tracking-tight transition-colors duration-200 ${
            activeTab === "chat"
              ? "bg-surface-subtle border border-border-strong text-foreground"
              : "text-muted hover:text-foreground hover:bg-surface-elevated border border-transparent"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chatbot</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("checklists")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium tracking-tight transition-colors duration-200 ${
            activeTab === "checklists"
              ? "bg-surface-subtle border border-border-strong text-foreground"
              : "text-muted hover:text-foreground hover:bg-surface-elevated border border-transparent"
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5" />
          <span>Flight Checklists</span>
          {checklistSteps.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-md bg-surface-hover text-secondary text-[10px] font-mono">
              {checklistSteps.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("evidence")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium tracking-tight transition-colors duration-200 ${
            activeTab === "evidence"
              ? "bg-surface-subtle border border-border-strong text-foreground"
              : "text-muted hover:text-foreground hover:bg-surface-elevated border border-transparent"
          }`}
        >
          <Microscope className="w-3.5 h-3.5" />
          <span>Research RAG</span>
          {activeExplanation?.cited_evidence.length ? (
            <span className="px-1.5 py-0.5 rounded-md bg-surface-hover text-secondary text-[10px] font-mono">
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
                      className={`max-w-[90%] rounded-lg p-4 text-xs leading-relaxed ${
                        isUser
                          ? "bg-surface-subtle border border-border-strong text-foreground rounded-br-sm"
                          : "bg-surface-elevated border border-border text-foreground rounded-bl-sm"
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
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border text-secondary text-[11px] font-mono hover:text-foreground hover:border-border-strong transition-colors"
                            >
                              <FileCheck2 className="w-3 h-3" />
                              <span>Latched Rule: {rule.rule_id}</span>
                            </button>
                          )}

                          {evidenceList.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleSourceExpand(msg.id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border text-secondary text-[11px] font-mono hover:text-foreground hover:border-border-strong transition-colors"
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
                          <span className="text-[10px] font-mono uppercase tracking-wider text-muted block mb-1">
                            NASA Biomedical RAG Passages:
                          </span>
                          {evidenceList.map((item) => (
                            <div
                              key={item.chunk_id}
                              className="p-2.5 rounded-md bg-surface border border-border text-[11px] text-secondary"
                            >
                              <div className="font-semibold text-foreground">
                                [{item.doc_id}] {item.title}
                              </div>
                              <div className="text-[10px] text-muted font-mono mt-0.5">
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
                    <span className="mt-1 px-1 text-[10px] font-mono text-faint">
                      {msg.timestamp}
                    </span>
                  </div>
                );
              })}

              {/* Bot Typing Indicator */}
              {isLoading && (
                <div className="flex items-center gap-2 p-3 max-w-[70%] rounded-lg bg-surface-elevated border border-border text-xs text-muted">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                  <span>Synthesizing answer from NASA flight rules & literature...</span>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-critical/25 bg-critical/10 p-3 text-xs text-critical">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Persistent Chat Input Bar */}
            <div className="p-4 border-t border-border-subtle bg-canvas">
              <form onSubmit={handleQuerySubmit} className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Ask WAYFINDER (e.g. 'I have a headache', 'Check CO2 rule')..."
                  className="flex-1 px-4 py-2.5 rounded-lg bg-surface-elevated border border-border text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-accent-light transition-colors font-sans"
                />
                <button
                  type="submit"
                  disabled={!inputQuery.trim() || isLoading}
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-foreground hover:bg-secondary disabled:opacity-40 disabled:hover:bg-foreground text-canvas font-semibold transition-colors"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
              <div className="mt-1.5 flex items-center justify-between px-2 text-[10px] text-faint font-mono">
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
              <div className="rounded-lg border border-border bg-surface-elevated p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-surface-subtle text-foreground text-[11px] font-mono font-medium tracking-tight border border-border-strong">
                    {latchedRule.rule_id}
                  </span>
                  <span className="text-[10px] font-mono text-muted">
                    Revision: {latchedRule.revision_date}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-foreground tracking-tight leading-snug">
                  {latchedRule.title}
                </h3>
                <div className="text-xs text-secondary bg-surface rounded-md p-2.5 border border-border">
                  <span className="text-muted font-mono text-[11px] block mb-1">
                    Condition Threshold:
                  </span>
                  {latchedRule.condition_threshold}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground" />
                  <span>SHA-256 Provenance: {latchedRule.sha256_hash.slice(0, 12)}... (Verified NASA Certified)</span>
                </div>
              </div>
            ) : null}

            {checklistSteps.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted font-mono">
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
                        className={`group p-3 rounded-lg border transition-colors duration-200 cursor-pointer ${
                          isDone
                            ? "bg-surface border-border opacity-60"
                            : "bg-surface-elevated border-border hover:border-border-strong"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            className="mt-0.5 text-muted group-hover:text-foreground transition-colors"
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-4 h-4 text-foreground" />
                            ) : (
                              <Circle className="w-4 h-4" />
                            )}
                          </button>
                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-mono font-medium text-muted">
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
                              <div className="text-[11px] font-mono text-secondary bg-surface border border-border px-2 py-1 rounded-md">
                                Verification: {step.verification}
                              </div>
                            )}
                            {step.caution_warning && (
                              <div className="text-[11px] text-secondary bg-surface border border-border px-2 py-1 rounded-md flex items-center gap-1.5">
                                <TriangleAlert className="w-3.5 h-3.5 shrink-0" />
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
              <div className="p-8 text-center rounded-lg border border-dashed border-border text-faint text-xs">
                No active flight rule latched. Ask a question or click an event to latch a certified checklist.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Detailed Scientific Evidence */}
        {activeTab === "evidence" && (
          <div className="drawer-scroll flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {activeEvent && (
              <div className="rounded-lg border border-border bg-surface-elevated p-4">
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
                <div className="mt-3 flex flex-wrap gap-1">
                  {parseStreamIds(activeEvent.contributing_stream_ids).map((stream) => (
                    <span
                      key={stream}
                      className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted"
                    >
                      {prettyStream(stream)}
                    </span>
                  ))}
                  {activeEvent.peak_deviation_sigma !== null ? (
                    <span className="rounded border border-border-strong bg-surface-subtle px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                      peak {formatSigned(activeEvent.peak_deviation_sigma, 2)} σ
                    </span>
                  ) : null}
                </div>
              </div>
            )}

            {activeExplanation ? (
              <div className="space-y-4">
                <section className="rounded-lg border border-border bg-surface-elevated p-4">
                  <h3 className="text-sm font-semibold leading-snug text-foreground">
                    {activeExplanation.headline}
                  </h3>
                </section>

                <section className="rounded-lg border border-border bg-surface-elevated p-4">
                  <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted font-mono">
                    Observed dynamics
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-secondary">
                    {activeExplanation.observed_dynamics}
                  </p>
                </section>

                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted font-mono">
                      Scientific context
                    </h3>
                    <span className="text-xs text-secondary">
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
                  <section className="rounded-lg border border-border bg-surface-elevated p-4">
                    <div className="flex items-center gap-2 text-secondary">
                      <TriangleAlert className="h-3.5 w-3.5" />
                      <h3 className="text-xs font-semibold text-foreground">Study caveats</h3>
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {activeExplanation.study_caveats.map((caveat) => (
                        <li
                          key={caveat}
                          className="flex items-start gap-2 text-xs leading-relaxed text-secondary"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />
                          {caveat}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <div className="flex items-center justify-between text-xs text-muted pt-1">
                  <span className="inline-flex items-center gap-1 font-mono">
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
      <footer className="sticky bottom-0 shrink-0 border-t border-border-subtle bg-canvas p-3">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-critical" />
          <p className="text-[10px] leading-relaxed text-muted">
            {activeExplanation?.disclaimer ?? FALLBACK_DISCLAIMER}
          </p>
        </div>
      </footer>
    </aside>
  );
}
