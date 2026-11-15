/**
 * Perplexity-aesthetic interactive component for Shift Handover Briefing.
 * Renders all 7 structured sections with soft shadows, rounded-[32px] containers,
 * clear typography, clickable window duration controls, and an Interactive Deck vs
 * Formatted Report view toggle.
 */

import React, { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Clock3,
  Compass,
  Copy,
  FileCheck2,
  FileText,
  Info,
  Layers,
  LayoutGrid,
  Lightbulb,
  Radio,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";

import { AstronautAvatar, Badge, MessageFormatter } from "../../components/ui";
import { renderDeterministicBriefingProse } from "./shiftHandoverTemplate";
import type { HandoverWindowHours, ShiftHandoverBriefing } from "./types";

interface ShiftHandoverCardProps {
  briefing: ShiftHandoverBriefing;
  onSelectWindow?: (hours: HandoverWindowHours) => void;
}

export const ShiftHandoverCard: React.FC<ShiftHandoverCardProps> = ({
  briefing,
  onSelectWindow,
}) => {
  const {
    window,
    crew,
    pendingReviews,
    dataQuality,
    evidencePointers,
    focusPrompts,
    disclaimer,
    generatedBy,
  } = briefing;

  const [viewMode, setViewMode] = useState<"deck" | "report">("deck");
  const [copied, setCopied] = useState(false);

  const windowOptions: HandoverWindowHours[] = [6, 12, 24];
  const markdownReport = renderDeterministicBriefingProse(briefing);

  const handleCopyReport = () => {
    navigator.clipboard.writeText(markdownReport).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-[32px] bg-white border border-slate-200/90 shadow-2xs p-5 sm:p-7 space-y-6 text-slate-900 transition-all">
      {/* 1. Header & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-xl bg-sky-50 text-sky-700 border border-sky-100">
              <FileCheck2 className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-sky-800">
              Flight Surgeon Console
            </span>
            <span className="text-slate-300">·</span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider border ${
                generatedBy === "llm"
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              {generatedBy === "llm" ? "Gemini Synthesized" : "Deterministic Compiler"}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Shift Handover Briefing
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500 font-mono">
            <span className="flex items-center gap-1 text-slate-700 font-semibold">
              <Clock3 className="w-3.5 h-3.5 text-sky-600" />
              {window.hours}h Observation Window
            </span>
            <span className="text-slate-300">|</span>
            <span>
              {window.startIso.slice(11, 16)} → {window.endIso.slice(11, 16)} {window.timezone}
            </span>
            <span className="text-slate-300">|</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
              {window.mode === "simulation" ? "SIMULATION CLOCK" : "LIVE UTC"}
            </span>
          </div>
        </div>

        {/* View Mode Toggle + Copy Button + Window Duration Selector */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
          {/* Deck vs Report Toggle */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setViewMode("deck")}
              className={`px-3 py-1 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "deck"
                  ? "bg-white text-slate-900 border border-slate-200/90 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Interactive</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("report")}
              className={`px-3 py-1 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "report"
                  ? "bg-white text-slate-900 border border-slate-200/90 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Text Report</span>
            </button>
          </div>

          {/* Copy Report Button */}
          <button
            type="button"
            onClick={handleCopyReport}
            className="p-1.5 px-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-mono font-medium transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
            title="Copy formatted markdown report to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Window Duration Pills */}
          {onSelectWindow && (
            <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] font-mono text-slate-500 px-2 font-medium">Window:</span>
              {windowOptions.map((h) => {
                const active = window.hours === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => onSelectWindow(h)}
                    className={`px-3 py-1 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer ${
                      active
                        ? "bg-white text-slate-900 border border-slate-200/90 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                  >
                    {h}h
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Clock Mismatch Notice if applicable */}
      {window.isClockMismatched && dataQuality.clockWarning && (
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">Temporal Epoch Divergence (Simulation Mode)</span>
            <p className="text-amber-800 leading-relaxed">{dataQuality.clockWarning}</p>
          </div>
        </div>
      )}

      {/* VIEW MODE 1: Formatted Text Report */}
      {viewMode === "report" ? (
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-50/70 border border-slate-200/80">
          <MessageFormatter text={markdownReport} />
        </div>
      ) : (
        /* VIEW MODE 2: Interactive Deck View */
        <>
          {/* 2. What Changed (Per Crewmember) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-sky-600" />
                1. What Changed (Cohort Overview)
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {crew.length} Astronaut{crew.length !== 1 ? "s" : ""} Monitored
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {crew.map((member) => (
                <div
                  key={member.astronautId}
                  className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-200/60">
                      <AstronautAvatar
                        astronautId={member.astronautId}
                        label={member.callsign}
                        size="sm"
                      />
                      <div>
                        <h3 className="font-bold text-xs text-slate-900 leading-tight">
                          {member.callsign}
                        </h3>
                        <span className="text-[10px] text-slate-500 font-mono block">
                          {member.crewRole} · {member.astronautId}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {member.changes.map((ch, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-white border border-slate-200/60 text-xs shadow-2xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-slate-800 text-[11px]">
                              {ch.label}
                            </span>
                            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/70">
                              {ch.sourceId}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-snug">{ch.value}</p>
                          {ch.baselineDelta && (
                            <div className="pt-1 flex items-center gap-1 text-[10px] font-mono font-semibold text-sky-700">
                              <span>Δ Baseline:</span>
                              <span>{ch.baselineDelta}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Needs Review (Prioritized Queue) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                2. Needs Surgeon Signature ({pendingReviews.length} Pending)
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Ranked by Severity & Uncertainty
              </span>
            </div>

            {pendingReviews.length === 0 ? (
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/70 text-emerald-900 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Zero pending clinical events or symptom reports requiring shift signature.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingReviews.map((item, idx) => {
                  const isInvestigate = item.severity === "INVESTIGATE";
                  const isObserve = item.severity === "OBSERVE";
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start sm:items-center gap-3">
                        <span className="font-mono text-xs font-bold text-slate-400 shrink-0 w-4">
                          #{idx + 1}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border uppercase shrink-0 ${
                            isInvestigate
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : isObserve
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-sky-50 text-sky-700 border-sky-200"
                          }`}
                        >
                          {item.severity}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{item.title}</span>
                            <span className="text-[10px] font-mono text-slate-500">
                              ({item.callsign})
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                            Ref: {item.sourceId}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 text-[11px] font-mono text-slate-500 self-end sm:self-auto shrink-0">
                        {item.uncertainty && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                            Uncertainty: {item.uncertainty}
                          </span>
                        )}
                        <span className="text-slate-400">·</span>
                        <span className="flex items-center gap-1 text-slate-700 font-semibold">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {item.ageHours}h ago
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Data Quality & Provenance */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-mono uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              3. Telemetry Integrity & Stream Audit
            </span>
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-center">
                <div className="p-2.5 rounded-xl bg-white border border-slate-200/60 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Valid</span>
                  <span className="text-base font-black text-emerald-800">{dataQuality.valid}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200/60 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-amber-700 block">Suspect</span>
                  <span className="text-base font-black text-amber-800">{dataQuality.suspect}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200/60 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-600 block">Stale</span>
                  <span className="text-base font-black text-slate-700">{dataQuality.stale}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200/60 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-rose-700 block">Gap</span>
                  <span className="text-base font-black text-rose-800">{dataQuality.gap}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200/60 shadow-2xs col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-indigo-700 block">Imputed</span>
                  <span className="text-base font-black text-indigo-800">{dataQuality.imputed}</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-600 space-y-1 pt-1">
                {dataQuality.importedSources.length > 0 && (
                  <p>
                    <strong className="text-slate-800">External Provenance:</strong>{" "}
                    {dataQuality.importedSources.join(", ")}
                  </p>
                )}
                <p>
                  <strong className="text-slate-800">Stream Completeness:</strong>{" "}
                  {dataQuality.missingStreams.length === 0
                    ? "All 5 core NASA EDA telemetry streams reporting nominally."
                    : `Missing streams: ${dataQuality.missingStreams.join(", ")}`}
                </p>
              </div>
            </div>
          </div>

          {/* 5. Evidence Pointers */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-mono uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-sky-600" />
              4. Grounded Flight Rules & NASA Research Corpi
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {evidencePointers.map((ptr) => (
                <div
                  key={ptr.id}
                  className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center gap-2.5 text-xs"
                >
                  <span
                    className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold border uppercase shrink-0 ${
                      ptr.type === "flight_rule"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-sky-50 text-sky-700 border-sky-200"
                    }`}
                  >
                    {ptr.type === "flight_rule" ? "Flight Rule" : "NASA HRP"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-slate-900 block truncate">
                      [{ptr.id}] {ptr.title}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 6. Suggested Focus */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-mono uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              5. Suggested Operational Focus for Oncoming Shift
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {focusPrompts.map((prompt, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 text-xs text-slate-700 leading-relaxed shadow-2xs flex items-start gap-2.5"
                >
                  <span className="text-sky-600 font-bold shrink-0 mt-0.5">•</span>
                  <span>{prompt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 7. Mandatory Epistemic Disclaimer */}
          <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/70 text-slate-500 text-[11px] leading-relaxed flex items-start gap-2.5">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-700 block mb-0.5">
                Non-Causal Clinical Decision Support
              </span>
              <p>{disclaimer}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
