/**
 * Isolated Component: Contextual Clinical Triage Card
 * Perplexity minimalist styling:
 * - font-semibold uppercase headers
 * - rounded-lg containers
 * - generous whitespace & micro-animations
 */

import React, { useState } from "react";
import {
  Stethoscope,
  Bot,
  AlertTriangle,
  Clock,
  Compass,
  CheckCircle2,
  Sparkles,
  Send,
} from "lucide-react";
import {
  evaluateContextualTriage,
  type TriageEvaluationResult,
} from "./ContextualTriageAdapter";
import type { EnvironmentalSnapshot } from "../risk/ClinicalRiskModule";

interface ContextualTriageBannerProps {
  currentSnapshot?: EnvironmentalSnapshot;
  className?: string;
}

export const ContextualTriageBanner: React.FC<ContextualTriageBannerProps> = ({
  currentSnapshot = {
    co2Ppm: 3197,
    tempC: 22.8,
    humidityPct: 43.9,
    radiationRateMGy: 0.20,
    pressureMmHg: 758.2,
  },
  className = "",
}) => {
  const [query, setQuery] = useState("Throbbing frontal headache in Node 2 crew quarters");
  const [evaluation, setEvaluation] = useState<TriageEvaluationResult>(() =>
    evaluateContextualTriage("Throbbing frontal headache in Node 2 crew quarters", currentSnapshot),
  );

  const handleEvaluate = (text: string) => {
    setQuery(text);
    setEvaluation(evaluateContextualTriage(text, currentSnapshot));
  };

  return (
    <section
      className={`p-5 sm:p-6 glass-panel rounded-xl relative overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Stethoscope className="w-3.5 h-3.5 text-sky-600" />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-700">
              5-Factor Environmental Health Triage
            </span>
            <span className="text-[11px] font-mono text-muted">
              · Clinical Decision Support
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
            Context-Aware Symptom &amp; Hazard Triage
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Real-time correlation of crew symptom dialogue against localized compartment telemetry
          </p>
        </div>

        <span className="text-[11px] font-mono uppercase tracking-wider px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 self-start sm:self-auto">
          Flight Rule B13-101.B Active
        </span>
      </div>

      {/* Clinical Query Evaluation Input */}
      <div className="pt-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleEvaluate(query);
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter crew symptom or compartment observation for 5-factor triage..."
            className="w-full px-4 py-2.5 pr-28 rounded-xl border border-border bg-white text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-sky-500 shadow-2xs"
          />
          <button
            type="submit"
            className="absolute right-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Triage</span>
          </button>
        </form>
      </div>

      {/* Evaluation Results Card */}
      <div className="mt-6 p-5 rounded-xl glass-panel-subtle space-y-5">
        {/* Detected Location & Hazard Latency */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-white border border-border space-y-1">
            <div className="flex items-center gap-2 text-xs text-sky-700 font-mono">
              <Compass className="w-3.5 h-3.5 text-sky-600" />
              <span>Resolved Compartment Location:</span>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {evaluation.detectedModule?.name ?? "General Spacecraft Complex"}
            </p>
            <p className="text-[11px] text-muted">
              Sensors: {(evaluation.detectedModule?.sensorLocations || evaluation.detectedModule?.primarySensors || []).join(", ") || "ECLSS Primary Loop"}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-border space-y-1">
            <div className="flex items-center gap-2 text-xs text-amber-800 font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Biological Delay Latency Window:</span>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {evaluation.potentialDelayedCausality?.lagWindow ?? "Real-time Immediate"}
            </p>
            <p className="text-[11px] text-muted">
              Confidence: {evaluation.potentialDelayedCausality?.confidenceMatch ?? "High baseline concordancy"}
            </p>
          </div>
        </div>

        {/* Causal Rationale */}
        {evaluation.potentialDelayedCausality && (
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/90 shadow-2xs space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Potential Physiological Concordance Flag</span>
            </div>
            <p className="text-xs text-slate-800 leading-relaxed">
              {evaluation.potentialDelayedCausality.rationale}
            </p>
          </div>
        )}

        {/* Recommended Countermeasures */}
        <div>
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-700">
            Operational Clinical Countermeasures:
          </span>
          <ul className="mt-2 space-y-2">
            {evaluation.countermeasures.map((cm, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-xs text-secondary bg-white p-2.5 rounded-lg border border-border"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{cm}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
