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

  const sampleCases = [
    "Throbbing frontal headache in Node 2 crew quarters",
    "Dry stinging eyes and irritation in Columbus module",
    "Extreme sweating and core heat buildup after workout in US Lab",
    "Feeling lightheaded and fatigued during EVA preparation",
  ];

  return (
    <section
      className={`p-4 sm:p-6 bg-surface rounded-lg border border-border relative overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Stethoscope className="w-3.5 h-3.5 text-muted" />
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">5-Factor Environmental Health Triage</span>
            <span className="text-[11px] font-mono text-muted">
              Clinical Decision Support
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
            Context-Aware Symptom & Hazard Triage
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Real-time correlation of crew symptom dialogue against localized compartment telemetry
          </p>
        </div>

        <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-md bg-surface-elevated text-muted border border-border self-start sm:self-auto">
          Flight Rule B13-101.B Active
        </span>
      </div>

      {/* Preset Query Chips */}
      <div className="pt-6 space-y-2">
        <span className="text-xs font-semibold text-muted">Select Test Scenario or Enter Freeform Query:</span>
        <div className="flex flex-wrap gap-2">
          {sampleCases.map((sc) => (
            <button
              key={sc}
              onClick={() => handleEvaluate(sc)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                query === sc
                  ? "bg-surface-subtle text-foreground border border-border-strong"
                  : "bg-surface-elevated text-secondary hover:bg-surface-subtle hover:text-foreground border border-border"
              }`}
            >
              {sc}
            </button>
          ))}
        </div>
      </div>

      {/* Evaluation Results Card */}
      <div className="mt-6 p-5 rounded-lg bg-surface-elevated border border-border space-y-5">
        {/* Detected Location & Hazard Latency */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-surface-subtle border border-border space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted font-mono">
              <Compass className="w-3.5 h-3.5 text-muted" />
              <span>Resolved Compartment Location:</span>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {evaluation.detectedModule?.name ?? "General Spacecraft Complex"}
            </p>
            <p className="text-[11px] text-muted">
              Sensors: {evaluation.detectedModule?.primarySensors.join(", ") ?? "ECLSS Primary Loop"}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-surface-subtle border border-border space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted font-mono">
              <Clock className="w-3.5 h-3.5 text-muted" />
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
          <div className="p-4 rounded-lg bg-surface-subtle border border-border border-l-2 border-l-foreground/40 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <AlertTriangle className="w-4 h-4 text-muted" />
              <span>Potential Physiological Causality Flag</span>
            </div>
            <p className="text-xs text-foreground leading-relaxed">
              {evaluation.potentialDelayedCausality.rationale}
            </p>
          </div>
        )}

        {/* Recommended Countermeasures */}
        <div>
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
            Operational Clinical Countermeasures:
          </span>
          <ul className="mt-2 space-y-2">
            {evaluation.countermeasures.map((cm, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-xs text-secondary bg-surface p-2.5 rounded-md border border-border"
              >
                <CheckCircle2 className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                <span>{cm}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
