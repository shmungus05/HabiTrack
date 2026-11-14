/**
 * Standardized Shared Component: Physiological Telemetry & Circadian Envelope
 *
 * Renders the 4 crew biometric cards:
 * 1. Resting HR (Heart Rate in bpm)
 * 2. HRV · RMSSD (Heart Rate Variability in ms)
 * 3. Peripheral SpO₂ (Oxygen Saturation in %)
 * 4. Core Temp (Core Body Temperature in °C / °F)
 *
 * Synchronized across Overview, Timeline, Symptoms, and Alerts views.
 */

import React from "react";
import {
  HeartPulse,
  Brain,
  Droplets,
  Thermometer,
  ArrowUpRight,
  ArrowDownRight,
  MapPin,
} from "lucide-react";
import { usePhysiologicalTelemetry } from "./usePhysiologicalStore";
import { useBiomedicalSettings } from "../settings";
import { getAstronautDetectedLocation } from "../topology";
import { formatSigned } from "../../lib/format";

interface PhysiologicalCardsProps {
  astronautId?: string;
  className?: string;
  compact?: boolean;
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) {
    return <div className="h-7 w-full rounded bg-slate-100" />;
  }
  const width = 120;
  const height = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((val, idx) => {
      const x = (idx / (values.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-7 w-full overflow-visible"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export const PhysiologicalCards: React.FC<PhysiologicalCardsProps> = ({
  astronautId,
  className = "",
  compact = false,
}) => {
  const vitals = usePhysiologicalTelemetry(astronautId);
  const { settings } = useBiomedicalSettings();
  const isMetric = settings.unitSystem === "metric";
  const detectedStation = getAstronautDetectedLocation(astronautId);

  const cards = [
    {
      key: "hr",
      label: "Resting HR",
      value: vitals.hr,
      baseline: vitals.baselineHr,
      delta: vitals.hrDelta,
      unit: "bpm",
      digits: 0,
      alert: vitals.hrAlert,
      icon: HeartPulse,
      sparkColor: vitals.hrAlert ? "#dc2626" : "#0284c7",
      sparkValues: [
        vitals.baselineHr - 1,
        vitals.baselineHr + 1,
        vitals.baselineHr,
        vitals.baselineHr + 2,
        vitals.hr,
      ],
    },
    {
      key: "rmssd",
      label: "HRV · RMSSD",
      value: vitals.rmssd,
      baseline: vitals.baselineRmssd,
      delta: vitals.rmssdDelta,
      unit: "ms",
      digits: 0,
      alert: vitals.rmssdAlert,
      icon: Brain,
      sparkColor: vitals.rmssdAlert ? "#d97706" : "#0891b2",
      sparkValues: [
        vitals.baselineRmssd + 2,
        vitals.baselineRmssd - 1,
        vitals.baselineRmssd + 1,
        vitals.baselineRmssd,
        vitals.rmssd,
      ],
    },
    {
      key: "spo2",
      label: "Peripheral SpO₂",
      value: vitals.spo2,
      baseline: vitals.baselineSpo2,
      delta: vitals.spo2Delta,
      unit: "%",
      digits: 1,
      alert: vitals.spo2Alert,
      icon: Droplets,
      sparkColor: vitals.spo2Alert ? "#ea580c" : "#059669",
      sparkValues: [
        vitals.baselineSpo2,
        vitals.baselineSpo2 - 0.2,
        vitals.baselineSpo2 + 0.1,
        vitals.baselineSpo2,
        vitals.spo2,
      ],
    },
    {
      key: "temp",
      label: "Core Temp",
      value: isMetric ? vitals.coreTemp : vitals.coreTemp * 1.8 + 32,
      baseline: isMetric ? vitals.baselineCoreTemp : vitals.baselineCoreTemp * 1.8 + 32,
      delta: isMetric ? vitals.coreTempDelta : vitals.coreTempDelta * 1.8,
      unit: isMetric ? "°C" : "°F",
      digits: isMetric ? 2 : 1,
      alert: vitals.coreTempAlert,
      icon: Thermometer,
      sparkColor: vitals.coreTempAlert ? "#dc2626" : "#ea580c",
      sparkValues: [
        vitals.baselineCoreTemp,
        vitals.baselineCoreTemp - 0.05,
        vitals.baselineCoreTemp + 0.05,
        vitals.baselineCoreTemp,
        vitals.coreTemp,
      ],
    },
  ];

  return (
    <section className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-rose-600" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Physiological Telemetry &amp; Circadian Envelope
          </h3>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-rose-50 text-rose-700 border border-rose-200">
            {vitals.callsign}
          </span>
          <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <MapPin className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
            <span>Station: {detectedStation.moduleShortName} ({detectedStation.location})</span>
          </span>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">
          Circadian Baselines (μ ± 2σ)
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <article
              key={c.key}
              className={`rounded-xl glass-panel glass-card-hover p-4 sm:p-5 transition-all ${
                c.alert ? "border-amber-300 ring-1 ring-amber-200 bg-amber-50/20" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">{c.label}</p>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="font-mono text-[26px] leading-[34px] font-semibold tracking-tight text-slate-900 tabular-nums">
                      {c.value.toFixed(c.digits)}
                    </span>
                    <span className="text-xs text-slate-500">{c.unit}</span>
                  </div>
                </div>
                <span
                  className={`grid h-8 w-8 place-items-center rounded-lg border ${
                    c.alert
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                <span
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium border ${
                    c.alert
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  {c.delta >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {formatSigned(c.delta, c.digits + 1)}
                </span>
                <span className="text-slate-500 font-mono text-[11px]">
                  μ {c.baseline.toFixed(c.digits)}
                </span>
              </div>

              {!compact && (
                <div className="mt-3">
                  <Sparkline values={c.sparkValues} color={c.sparkColor} />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
