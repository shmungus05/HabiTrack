/**
 * Overview view: four physiological KPI cards with baseline deltas, the
 * highest-severity active concordance banner with the 1-click evidence
 * trigger, and the recent crew symptom log.
 * Calm, refined UX with restrained color signals.
 */

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Brain,
  CheckCircle2,
  Clock3,
  Droplets,
  FileText,
  Gauge,
  HeartPulse,
  Layers,
  MapPin,
  Radio,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Thermometer,
  Wind,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchAstronaut,
  fetchBaselines,
  fetchEvents,
  fetchFlightRules,
  fetchMeasurements,
  fetchSymptoms,
  reviewEvent,
  submitSymptom,
} from "../services/api";
import { useAssistantStore } from "../stores/assistantStore";
import { useRoleStore } from "../stores/roleStore";
import { AstronautOnly, SurgeonOnly } from "../features/shared";
import { HealthReportModal, type HealthReportSourceData } from "../features/health-report";
import { EventRationaleDisplay, parseEventRationale } from "./EventRationaleDisplay";
import type {
  Astronaut,
  Baselines,
  FlightRule,
  HealthEvent,
  Measurement,
  SymptomReport,
} from "../types/api";
import {
  formatDateTime,
  formatSigned,
  parseStreamIds,
  prettyStream,
  severityRank,
  severityTheme,
  titleCase,
  uncertaintyTheme,
} from "../lib/format";
import { AstronautAvatar, Badge, Button, Card } from "./ui";
import { EdaStreamController } from "../features/eda";
import { ClinicalRiskMatrix } from "../features/risk";
import {
  SpacecraftModuleSelector,
  computeModuleTelemetry,
  useStationLocationStore,
  getAstronautDetectedLocation,
} from "../features/topology";
import { ContextualTriageBanner } from "../features/triage";
import { useSimulationSandbox } from "../features/simulation";
import { useBiomedicalSettings } from "../features/settings";
import { PhysiologicalCards } from "../features/biometrics";

interface OverviewViewProps {
  astronautId: string;
}

interface OverviewData {
  astronaut: Astronaut | null;
  measurements: Measurement[];
  baselines: Baselines;
  events: HealthEvent[];
  symptoms: SymptomReport[];
  activeFlightRules?: FlightRule[];
}

interface KpiDefinition {
  key: string;
  label: string;
  streamId: string;
  unit: string;
  digits: number;
  baselineKey: "resting_hr" | "resting_rmssd" | "resting_spo2" | "resting_temp";
  icon: typeof HeartPulse;
  spark: string;
  warn: (delta: number) => boolean;
}

const KPI_DEFINITIONS: KpiDefinition[] = [
  {
    key: "hr",
    label: "Resting HR",
    streamId: "stream_sim_hr",
    unit: "bpm",
    digits: 0,
    baselineKey: "resting_hr",
    icon: HeartPulse,
    spark: "#0284c7",
    warn: (delta) => Math.abs(delta) > 8,
  },
  {
    key: "rmssd",
    label: "HRV · RMSSD",
    streamId: "stream_sim_hrv",
    unit: "ms",
    digits: 0,
    baselineKey: "resting_rmssd",
    icon: Brain,
    spark: "#0891b2",
    warn: (delta) => delta < -10,
  },
  {
    key: "spo2",
    label: "Peripheral SpO₂",
    streamId: "stream_sim_spo2",
    unit: "%",
    digits: 1,
    baselineKey: "resting_spo2",
    icon: Droplets,
    spark: "#059669",
    warn: (delta) => delta < -1,
  },
  {
    key: "temp",
    label: "Core Temp",
    streamId: "stream_sim_temp",
    unit: "°C",
    digits: 2,
    baselineKey: "resting_temp",
    icon: Thermometer,
    spark: "#ea580c",
    warn: (delta) => Math.abs(delta) > 0.4,
  },
];

function streamPoints(measurements: Measurement[], streamId: string): Measurement[] {
  return measurements
    .filter((item) => item.stream_id === streamId)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

function createSmoothPath(coords: Array<{ x: number; y: number }>): string {
  if (coords.length < 2) return "";
  let d = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const midX = ((p0.x + p1.x) / 2).toFixed(1);
    d += ` C ${midX},${p0.y.toFixed(1)} ${midX},${p1.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
  }
  return d;
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) {
    return <div className="h-8 w-full rounded bg-slate-100" />;
  }
  const width = 120;
  const height = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = values.map((value, index) => ({
    x: (index / (values.length - 1)) * width,
    y: height - ((value - min) / span) * (height - 6) - 3,
  }));
  const strokePath = createSmoothPath(coords);
  const areaPath = `${strokePath} L ${width},${height} L 0,${height} Z`;
  const gradId = `spark-grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-8 w-full overflow-visible"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={strokePath}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface HealthGaugeProps {
  co2Ppm: number;
  radiationMGy: number;
  cabinTempC: number;
  humidityPct: number;
  pressureMmHg: number;
  autonomicFlagged: boolean;
  hrLabel: string;
  isMetric?: boolean;
}

function MultiFactorHealthGauge({
  co2Ppm,
  radiationMGy,
  cabinTempC,
  humidityPct,
  pressureMmHg,
  autonomicFlagged,
  hrLabel,
  isMetric = true,
}: HealthGaugeProps) {
  // 5-Factor Composite Algorithm (Section 5.3):
  // Score = 0.25*S_CO2 + 0.25*S_Rad + 0.15*S_Temp + 0.15*S_Hum + 0.20*S_Press
  const sCo2 =
    co2Ppm <= 2500 ? 100 : Math.max(20, 100 - ((co2Ppm - 2500) / 2500) * 80);
  const sRad =
    radiationMGy <= 0.22
      ? 100
      : Math.max(25, 100 - ((radiationMGy - 0.22) / 0.35) * 75);
  const sTemp =
    cabinTempC >= 21.0 && cabinTempC <= 24.0
      ? 100
      : Math.max(40, 100 - Math.abs(cabinTempC - 22.5) * 14);
  const sHum =
    humidityPct >= 40 && humidityPct <= 55
      ? 100
      : Math.max(40, 100 - Math.abs(humidityPct - 47.5) * 2.5);
  const sPress =
    pressureMmHg >= 750 && pressureMmHg <= 765
      ? 100
      : Math.max(40, 100 - Math.abs(pressureMmHg - 758) * 3);

  const score = Math.round(
    0.25 * sCo2 + 0.25 * sRad + 0.15 * sTemp + 0.15 * sHum + 0.2 * sPress,
  );

  const ringColor =
    score >= 85 ? "#0284c7" : score >= 70 ? "#d97706" : "#dc2626";
  const statusLabel =
    score >= 85
      ? "Nominal Flight Envelope"
      : score >= 70
        ? "Advisory Attention"
        : "Action Required";
  const statusTextClass =
    score >= 85
      ? "text-sky-700"
      : score >= 70
        ? "text-amber-700"
        : "text-red-700";

  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);

  const checklist = [
    {
      label: "Carbon Dioxide (25%)",
      reading: isMetric
        ? `${Math.round(co2Ppm).toLocaleString()} PPM`
        : `${(co2Ppm / 750).toFixed(2)} mmHg`,
      ok: co2Ppm < 2500,
      caution: co2Ppm >= 2500 && co2Ppm <= 3800,
      color: "#0284c7",
    },
    {
      label: "Space Radiation (25%)",
      reading: `${radiationMGy.toFixed(3)} mGy/d`,
      ok: radiationMGy < 0.22,
      caution: radiationMGy >= 0.22 && radiationMGy <= 0.35,
      color: "#d97706",
    },
    {
      label: "Cabin Temp (15%)",
      reading: isMetric
        ? `${cabinTempC.toFixed(1)} °C`
        : `${(cabinTempC * 1.8 + 32).toFixed(1)} °F`,
      ok: cabinTempC >= 21.0 && cabinTempC <= 24.0,
      caution: cabinTempC > 24.0 && cabinTempC <= 26.5,
      color: "#ea580c",
    },
    {
      label: "Relative Humidity (15%)",
      reading: `${humidityPct.toFixed(1)}%`,
      ok: humidityPct >= 40 && humidityPct <= 55,
      caution: humidityPct >= 34 && humidityPct < 40,
      color: "#0891b2",
    },
    {
      label: "Pressure & O₂ (20%)",
      reading: isMetric
        ? `${(pressureMmHg * 0.133322).toFixed(1)} kPa`
        : `${pressureMmHg.toFixed(1)} mmHg`,
      ok: pressureMmHg >= 750 && pressureMmHg <= 765,
      caution: false,
      color: "#059669",
    },
    {
      label: "Crew Biomedical",
      reading: hrLabel,
      ok: !autonomicFlagged,
      caution: autonomicFlagged,
      color: "#0284c7",
    },
  ];

  return (
    <article className="rounded-xl glass-panel glass-card-hover p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            5-Factor Composite Health Gauge
          </h3>
          <p className="text-[11px] text-muted">
            Weighted environmental + biomedical index
          </p>
        </div>
        <Badge
          variant={score >= 85 ? "accent" : score >= 70 ? "warning" : "danger"}
          dot
        >
          {score}%
        </Badge>
      </div>

      <div className="flex flex-col items-center py-2 text-center">
        <div className="relative h-40 w-40">
          <svg
            width={160}
            height={160}
            viewBox="0 0 160 160"
            className="-rotate-90"
            aria-label={`Composite health score ${score} percent`}
          >
            <circle
              cx={80}
              cy={80}
              r={radius}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={10}
            />
            <circle
              cx={80}
              cy={80}
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{
                transition: "stroke-dashoffset 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-semibold text-foreground tabular-nums">
              {score}%
            </span>
            <span className="text-[11px] text-muted">Health Index</span>
          </div>
        </div>

        {/* Direct icon flow above status title (no boxed container) */}
        <HeartPulse className={`mt-2 h-5 w-5 ${statusTextClass}`} />
        <p className={`mt-1 text-base font-semibold tracking-tight ${statusTextClass}`}>
          {statusLabel}
        </p>
      </div>

      <ul className="space-y-1.5 text-xs">
        {checklist.map((item) => {
          const badgeCls = item.ok
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : item.caution
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-red-200 bg-red-50 text-red-700";
          const StatusIcon = item.ok
            ? CheckCircle2
            : item.caution
              ? AlertTriangle
              : AlertCircle;
          const statusWord = item.ok
            ? "Nominal"
            : item.caution
              ? "Advisory"
              : "Alert";

          return (
            <li
              key={item.label}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-subtle px-2.5 py-2"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate text-[11px] text-secondary">
                  {item.label}
                </span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-[11px] font-semibold text-foreground tabular-nums">
                  {item.reading}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium ${badgeCls}`}
                >
                  <StatusIcon className="h-3 w-3" />
                  {statusWord}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export type OverviewSubSection = "vitals" | "atmospheric" | "risk" | "all";

const QUICK_SYMPTOMS = [
  { code: "HEADACHE", label: "Frontal Headache" },
  { code: "FATIGUE", label: "Fatigue" },
  { code: "DIZZINESS", label: "Dizziness" },
  { code: "NAUSEA", label: "Nausea" },
] as const;

function latestValue(data: OverviewData, streamId: string): number | null {
  const points = streamPoints(data.measurements, streamId);
  return points.at(-1)?.value ?? null;
}

interface AstronautOverviewProps {
  astronautId: string;
  data: OverviewData;
  quickLogging: string | null;
  quickNotice: string | null;
  onQuickLog: (code: string) => void;
  activeScenario?: string;
  activeScenarios?: string[];
}

/**
 * Astronaut perspective: focused strictly on personal physiological telemetry
 * (HR, HRV/RMSSD, SpO2, Core Temp with live sparklines) and personal health status
 * (5-factor composite health gauge, personal baseline, and 1-tap quick symptom log).
 * Concordance investigation cards, concordance history, and fleet reports are omitted.
 */
function AstronautOverview({
  astronautId,
  data,
  quickLogging,
  quickNotice,
  onQuickLog,
  activeScenario = "nominal",
  activeScenarios = [],
}: AstronautOverviewProps) {
  const { settings } = useBiomedicalSettings();
  const isMetric = settings.unitSystem === "metric";
  const { astronaut, measurements } = data;

  const hasCo2 = activeScenarios.includes("co2_spike") || activeScenario === "co2_spike";
  const hasThermal = activeScenarios.includes("thermal_overheat") || activeScenario === "thermal_overheat";
  const hasSaa = activeScenarios.includes("saa_transit") || activeScenario === "saa_transit";
  const isNominal = !hasCo2 && !hasThermal && !hasSaa;

  const { selectedModuleId, selectedLocation } = useStationLocationStore();
  const envTelemetry = computeModuleTelemetry(
    selectedModuleId,
    selectedLocation,
    activeScenarios,
    activeScenario,
  );

  const detectedCrewStation = getAstronautDetectedLocation(astronautId);

  let hr = latestValue(data, "stream_sim_hr");
  let rmssd = latestValue(data, "stream_sim_hrv");
  let latestCo2 = envTelemetry.co2;
  let latestCabinTemp = envTelemetry.temp;
  const latestPressure = envTelemetry.pressureMmHg;
  let latestHr = astronaut?.resting_hr ?? 65;
  let latestRmssd = astronaut?.resting_rmssd ?? 55;
  let radValue = envTelemetry.rad;

  // Apply live real-time simulation scenario overrides, supporting multi-anomaly injection
  if (hasCo2) {
    latestHr = (astronaut?.resting_hr ?? 65) + 27; // 92 bpm
    latestRmssd = 24; // 55 ms baseline - 31 ms depression
  }
  if (hasThermal && !hasCo2) {
    latestHr = (astronaut?.resting_hr ?? 65) + 15; // 80 bpm
  }

  const hrDelta = isNominal ? 0 : (astronaut ? latestHr - astronaut.resting_hr : 0);
  const rmssdDelta = isNominal ? 0 : (astronaut ? latestRmssd - astronaut.resting_rmssd : 0);
  const autonomicFlagged = !isNominal && (Math.abs(hrDelta) > 8 || rmssdDelta < -10 || hasCo2);
  const eventActive = !isNominal && (autonomicFlagged || hasCo2 || hasThermal || hasSaa);
  const gaugeHrLabel = `${latestHr.toFixed(0)} bpm`;

  return (
    <div className="space-y-6">
      {/* Astronaut Header */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl glass-panel p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-4">
          <AstronautAvatar
            astronautId={astronautId}
            size="xl"
            label={astronaut?.callsign ?? astronautId}
            className="shrink-0"
          />
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-slate-500">
              Astronaut perspective · {astronautId}
              {astronaut?.mission_id ? (
                <span className="text-slate-400"> · {astronaut.mission_id}</span>
              ) : null}
            </p>
            <h2 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {astronaut?.callsign ?? astronautId}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              {astronaut?.crew_role ?? "Crew member"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="default">
                <Gauge className="h-3 w-3" />
                {astronaut?.baseline_window_days ?? 7}-day baseline
              </Badge>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                <span>Station: <strong>{detectedCrewStation.moduleName}</strong> ({detectedCrewStation.location})</span>
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Badge
            variant={eventActive ? "danger" : "success"}
            dot
            pulse={eventActive}
          >
            {eventActive ? "Action required" : "All clear"}
          </Badge>
          <span className="field-label mt-1">Calibrated Baseline</span>
          <span className="font-mono text-xs text-slate-600">
            {formatDateTime(astronaut?.baseline_calibrated_at ?? null)}
          </span>
          <span className="text-[11px] text-slate-500">Timestamps in UTC</span>
        </div>
      </section>

      {/* 14-Module ISS Location & Sensor Selector */}
      <SpacecraftModuleSelector />

      {/* Cabin Environmental Telemetry Card */}
      <section className="rounded-xl glass-panel p-4 sm:p-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <Wind className={`w-4 h-4 shrink-0 ${latestCo2 > 3500 ? "text-amber-600 animate-pulse" : "text-sky-600"}`} />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 truncate">
              Cabin Environmental Telemetry · {envTelemetry.module.shortName} [{envTelemetry.location}]
            </span>
          </div>
          {hasCo2 && (
            <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-800 animate-pulse">
              CO₂ SPIKE ACTIVE
            </span>
          )}
          {hasThermal && (
            <span className="rounded-full bg-orange-100 border border-orange-300 px-2 py-0.5 text-[10px] font-bold text-orange-800 animate-pulse">
              HEAT SURGE ACTIVE
            </span>
          )}
          {hasSaa && (
            <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-800 animate-pulse">
              SAA RADIATION ACTIVE
            </span>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Cabin CO2 */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 space-y-1">
            <span className="text-[11px] font-medium text-slate-500 block">
              Cabin CO₂ ({isMetric ? "PPM" : "mmHg"})
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className={`font-mono text-xl sm:text-2xl font-bold tabular-nums ${latestCo2 > 3500 ? "text-amber-700" : "text-slate-900"}`}>
                {isMetric ? `${latestCo2.toLocaleString()} PPM` : `${(latestCo2 / 750).toFixed(2)} mmHg`}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono block">
              {isMetric ? "Nominal ≤2,500 PPM" : "Nominal ≤3.33 mmHg"}
            </span>
          </div>

          {/* Cabin Temp */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 space-y-1">
            <span className="text-[11px] font-medium text-slate-500 block">
              Cabin Temp ({isMetric ? "°C" : "°F"})
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className={`font-mono text-xl sm:text-2xl font-bold tabular-nums ${latestCabinTemp > 25.5 ? "text-amber-700" : "text-slate-900"}`}>
                {isMetric ? `${latestCabinTemp.toFixed(1)} °C` : `${(latestCabinTemp * 1.8 + 32).toFixed(1)} °F`}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono block">
              Envelope 20.0–24.0 °C
            </span>
          </div>

          {/* Cabin Pressure */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 space-y-1">
            <span className="text-[11px] font-medium text-slate-500 block">
              Cabin Pressure ({isMetric ? "kPa" : "mmHg"})
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-xl sm:text-2xl font-bold tabular-nums text-slate-900">
                {isMetric ? `${(latestPressure * 0.133322).toFixed(1)} kPa` : `${latestPressure.toFixed(1)} mmHg`}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono block">
              {isMetric ? "Nominal 101.3 kPa" : "Nominal 760.0 mmHg"}
            </span>
          </div>

          {/* Radiation */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 space-y-1">
            <span className="text-[11px] font-medium text-slate-500 block">
              Radiation Flux
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className={`font-mono text-xl sm:text-2xl font-bold tabular-nums ${radValue > 0.35 ? "text-red-700" : "text-slate-900"}`}>
                {radValue.toFixed(2)} mGy/d
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono block">
              Baseline 0.19 mGy/d
            </span>
          </div>
        </div>
      </section>

      {/* Synchronized Physiological Telemetry & Circadian Envelope */}
      <PhysiologicalCards astronautId={astronautId} />

      {/* Focused 2-Column Personal Health Status Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: 5-Factor Health Gauge */}
        <section className="space-y-6">
          <MultiFactorHealthGauge
            co2Ppm={latestCo2}
            radiationMGy={0.200}
            cabinTempC={latestCabinTemp}
            humidityPct={43.9}
            pressureMmHg={latestPressure > 200 ? latestPressure : 758.2}
            autonomicFlagged={autonomicFlagged}
            hrLabel={gaugeHrLabel}
            isMetric={isMetric}
          />
        </section>

        {/* Right Column: Personal Baseline, Quick Symptom Log, Monitoring Note */}
        <section className="space-y-6">
          {/* Quick Symptom Log: 1-tap logging for astronaut */}
          <section className="rounded-xl glass-panel p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Quick symptom log
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  One tap records locally at severity 3/5. Add detail in Symptoms.
                </p>
              </div>
              {quickNotice ? (
                <span className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] text-sky-700">
                  {quickNotice}
                </span>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {QUICK_SYMPTOMS.map((symptom) => (
                <button
                  key={symptom.code}
                  type="button"
                  onClick={() => onQuickLog(symptom.code)}
                  disabled={quickLogging !== null}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-left cursor-pointer transition-colors hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="block text-xs font-semibold text-slate-900">
                    {symptom.label}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-slate-500">
                    {quickLogging === symptom.code ? "Recording…" : "Tap to log"}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              Every log entry is written to the local station log immediately and
              stays available offline.
            </p>
          </section>

          <article className="rounded-xl glass-panel p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-slate-900">Personal baseline</h3>
            <dl className="mt-3 divide-y divide-slate-100 text-xs">
              {[
                { label: "Resting HR", value: `${astronaut?.resting_hr ?? 0} bpm`, icon: HeartPulse },
                { label: "RMSSD", value: `${astronaut?.resting_rmssd ?? 0} ms`, icon: Brain },
                { label: "SpO₂", value: `${astronaut?.resting_spo2 ?? 0}%`, icon: Droplets },
                {
                  label: "Core temp",
                  value: isMetric
                    ? `${astronaut?.resting_temp ?? 0} °C`
                    : `${((astronaut?.resting_temp ?? 36.8) * 1.8 + 32).toFixed(1)} °F`,
                  icon: Thermometer,
                },
                {
                  label: "Circadian shift",
                  value: `${formatSigned(astronaut?.circadian_phase_shift_hours ?? 0, 1)} h`,
                  icon: Clock3,
                },
              ].map((row) => {
                const Icon = row.icon;
                return (
                  <div
                    key={row.label}
                    className="flex items-center justify-between py-2.5 first:pt-1 last:pb-1"
                  >
                    <dt className="flex items-center gap-2 text-slate-600">
                      <Icon className="h-3.5 w-3.5 text-slate-400" />
                      {row.label}
                    </dt>
                    <dd className="font-semibold font-mono text-slate-900 tabular-nums">{row.value}</dd>
                  </div>
                );
              })}
            </dl>
            <p className="mt-3 flex items-start gap-2 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-500">
              <Wind className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              Rolling {astronaut?.baseline_window_days ?? 7}-day personal circadian baseline (μ ± 2σ).
            </p>
          </article>

          <article className="rounded-xl glass-panel flex items-start gap-3 p-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
              <Radio className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-xs font-semibold text-slate-900">Personal Health Monitoring</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Personal vital signals are evaluated continuously against your baseline. Ground telemetry
                synchronization is active.
              </p>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}

export function OverviewView({ astronautId }: OverviewViewProps) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loadedAstronautId, setLoadedAstronautId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<OverviewSubSection>("all");

  const openForEvent = useAssistantStore((state) => state.openForEvent);
  const isDrawerOpen = useAssistantStore((state) => state.isOpen);
  const role = useRoleStore((state) => state.role);
  const isAstronaut = role === "astronaut";
  const [simulationState, simulationControls] = useSimulationSandbox();
  const { activeScenario, isAnomalyActive } = simulationState;
  const activeScenarios = simulationState.activeScenarios || (activeScenario !== "nominal" ? [activeScenario] : []);
  const hasCo2 = activeScenarios.includes("co2_spike") || activeScenario === "co2_spike";
  const hasThermal = activeScenarios.includes("thermal_overheat") || activeScenario === "thermal_overheat";
  const hasSaa = activeScenarios.includes("saa_transit") || activeScenario === "saa_transit";
  const isNominal = !hasCo2 && !hasThermal && !hasSaa;
  const { settings } = useBiomedicalSettings();
  const isMetric = settings.unitSystem === "metric";

  const { selectedModuleId, selectedLocation } = useStationLocationStore();

  const [healthReportOpen, setHealthReportOpen] = useState(false);
  const [quickLogging, setQuickLogging] = useState<string | null>(null);
  const [quickNotice, setQuickNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [astronaut, measurements, baselines, events, symptoms, rules] =
        await Promise.all([
          fetchAstronaut(astronautId),
          fetchMeasurements(astronautId, 336, 1000),
          fetchBaselines(astronautId),
          fetchEvents(astronautId),
          fetchSymptoms(astronautId),
          fetchFlightRules().catch(() => [] as FlightRule[]),
        ]);
      setData({
        astronaut,
        measurements,
        baselines,
        events,
        symptoms,
        activeFlightRules: rules,
      });
      setLoadedAstronautId(astronautId);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load the cohort overview.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [astronautId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeEvent = useMemo<HealthEvent | null>(() => {
    // Inject real-time simulated concordance events when a simulation scenario is active
    if (hasCo2) {
      return {
        event_id: "sim_co2_spike",
        astronaut_id: astronautId,
        start_time: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
        end_time: new Date().toISOString(),
        event_type: "HYPERCAPNIC_AUTONOMIC_DISCORDANCE",
        severity_level: "INVESTIGATE",
        uncertainty_level: "LOW",
        rationale: isMetric
          ? "Critical cabin CO₂ spike (4,350 PPM) in Node 2 with concordant autonomic strain (+27 bpm compensatory tachycardia, RMSSD depressed to 24 ms). Breaches Flight Rule FR-ECLSS-001."
          : "Critical cabin CO₂ spike (5.80 mmHg) in Node 2 with concordant autonomic strain (+27 bpm compensatory tachycardia, RMSSD depressed to 24 ms). Breaches Flight Rule FR-ECLSS-001.",
        review_status: "PENDING",
        review_notes: null,
        symptom_report_id: null,
        contributing_stream_ids: JSON.stringify(["stream_eda_co2", "stream_sim_hr", "stream_sim_hrv"]),
        peak_deviation_sigma: 3.42,
      };
    }
    if (hasThermal) {
      return {
        event_id: "sim_thermal_overheat",
        astronaut_id: astronautId,
        start_time: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        end_time: new Date().toISOString(),
        event_type: "THERMAL_BOUNDARY_EXCURSION",
        severity_level: "INVESTIGATE",
        uncertainty_level: "LOW",
        rationale: isMetric
          ? "Cabin ambient temperature reached 27.4 °C in Node 2 with concordant core temp rise (+0.6 °C) and tachycardia (+15 bpm). Breaches Flight Rule FR-CDRA-002."
          : "Cabin ambient temperature reached 81.3 °F in Node 2 with concordant core temp rise (+1.1 °F) and tachycardia (+15 bpm). Breaches Flight Rule FR-CDRA-002.",
        review_status: "PENDING",
        review_notes: null,
        symptom_report_id: null,
        contributing_stream_ids: JSON.stringify(["stream_eda_temp", "stream_sim_temp", "stream_sim_hr"]),
        peak_deviation_sigma: 2.85,
      };
    }
    if (hasSaa) {
      return {
        event_id: "sim_saa_transit",
        astronaut_id: astronautId,
        start_time: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        end_time: new Date().toISOString(),
        event_type: "SAA_RADIATION_FLUX_CROSSING",
        severity_level: "OBSERVE",
        uncertainty_level: "LOW",
        rationale: "Spacecraft transit through South Atlantic Anomaly with dosimetric ionizing radiation rate elevated to 0.48 mGy/d.",
        review_status: "PENDING",
        review_notes: null,
        symptom_report_id: null,
        contributing_stream_ids: JSON.stringify(["stream_eda_radiation"]),
        peak_deviation_sigma: 2.10,
      };
    }

    if (!data?.events.length) {
      return null;
    }
    return (
      [...data.events]
        .filter((event) => event.review_status !== "RESOLVED")
        .sort(
          (left, right) =>
            severityRank(left.severity_level) - severityRank(right.severity_level),
        )[0] ?? null
    );
  }, [data, hasCo2, hasThermal, hasSaa, astronautId, isMetric]);

  const orderedEvents = useMemo(() => {
    const list = data ? [...data.events] : [];
    if (hasSaa && !list.some((e) => e.event_id === "sim_saa_transit")) {
      list.unshift({
        event_id: "sim_saa_transit",
        astronaut_id: astronautId,
        start_time: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        end_time: new Date().toISOString(),
        event_type: "SAA_RADIATION_FLUX_CROSSING",
        severity_level: "OBSERVE",
        uncertainty_level: "LOW",
        rationale: "Spacecraft transit through South Atlantic Anomaly with dosimetric ionizing radiation rate elevated to 0.48 mGy/d.",
        review_status: "PENDING",
        review_notes: null,
        symptom_report_id: null,
        contributing_stream_ids: JSON.stringify(["stream_eda_radiation"]),
        peak_deviation_sigma: 2.10,
      });
    }
    if (hasThermal && !list.some((e) => e.event_id === "sim_thermal_overheat")) {
      list.unshift({
        event_id: "sim_thermal_overheat",
        astronaut_id: astronautId,
        start_time: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        end_time: new Date().toISOString(),
        event_type: "THERMAL_BOUNDARY_EXCURSION",
        severity_level: "INVESTIGATE",
        uncertainty_level: "LOW",
        rationale: isMetric
          ? "Cabin ambient temperature reached 27.4 °C in Node 2 with concordant core temp rise (+0.6 °C) and tachycardia (+15 bpm). Breaches Flight Rule FR-CDRA-002."
          : "Cabin ambient temperature reached 81.3 °F in Node 2 with concordant core temp rise (+1.1 °F) and tachycardia (+15 bpm). Breaches Flight Rule FR-CDRA-002.",
        review_status: "PENDING",
        review_notes: null,
        symptom_report_id: null,
        contributing_stream_ids: JSON.stringify(["stream_eda_temp", "stream_sim_temp", "stream_sim_hr"]),
        peak_deviation_sigma: 2.85,
      });
    }
    if (hasCo2 && !list.some((e) => e.event_id === "sim_co2_spike")) {
      list.unshift({
        event_id: "sim_co2_spike",
        astronaut_id: astronautId,
        start_time: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
        end_time: new Date().toISOString(),
        event_type: "HYPERCAPNIC_AUTONOMIC_DISCORDANCE",
        severity_level: "INVESTIGATE",
        uncertainty_level: "LOW",
        rationale: isMetric
          ? "Critical cabin CO₂ spike (4,350 PPM) in Node 2 with concordant autonomic strain (+27 bpm compensatory tachycardia, RMSSD depressed to 24 ms). Breaches Flight Rule FR-ECLSS-001."
          : "Critical cabin CO₂ spike (5.80 mmHg) in Node 2 with concordant autonomic strain (+27 bpm compensatory tachycardia, RMSSD depressed to 24 ms). Breaches Flight Rule FR-ECLSS-001.",
        review_status: "PENDING",
        review_notes: null,
        symptom_report_id: null,
        contributing_stream_ids: JSON.stringify(["stream_eda_co2", "stream_sim_hr", "stream_sim_hrv"]),
        peak_deviation_sigma: 3.42,
      });
    }
    return list.sort(
      (left, right) =>
        severityRank(left.severity_level) - severityRank(right.severity_level) ||
        right.start_time.localeCompare(left.start_time),
    );
  }, [data, hasCo2, hasThermal, hasSaa, astronautId, isMetric]);

  const recentSymptoms = useMemo(() => {
    if (!data) {
      return [];
    }
    return [...data.symptoms]
      .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at))
      .slice(0, 6);
  }, [data]);

  const acknowledge = async (event: HealthEvent) => {
    setReviewing(event.event_id);
    try {
      if (event.event_id.startsWith("sim_")) {
        // Simulated anomaly acknowledged; reset simulation to nominal
        await new Promise((resolve) => setTimeout(resolve, 300));
        simulationControls.resetNominal();
        return;
      }
      const nextStatus = event.review_status === "PENDING" ? "ACKNOWLEDGED" : "RESOLVED";
      const updated = await reviewEvent(event.event_id, nextStatus, event.review_notes);
      setData((current) =>
        current
          ? {
              ...current,
              events: current.events.map((item) =>
                item.event_id === updated.event_id ? updated : item,
              ),
            }
          : current,
      );
    } catch {
      /* Surface failures through inline retry */
    } finally {
      setReviewing(null);
    }
  };

  const quickLogSymptom = async (code: string) => {
    setQuickLogging(code);
    setQuickNotice(null);
    try {
      const created = await submitSymptom({
        astronaut_id: astronautId,
        symptom_code: code,
        severity: 3,
        cabin_module: null,
        notes: null,
      });
      setData((current) =>
        current
          ? { ...current, symptoms: [created, ...current.symptoms] }
          : current,
      );
      setQuickNotice(`✓ Recorded locally · ${titleCase(code)} logged`);
      window.setTimeout(() => setQuickNotice(null), 4500);
    } catch (caught) {
      setQuickNotice(
        caught instanceof Error ? caught.message : "Unable to record the symptom.",
      );
    } finally {
      setQuickLogging(null);
    }
  };

  // Hooks must run before the loading/error early returns below.
  const healthReportSource = useMemo<HealthReportSourceData | null>(() => {
    if (!data?.astronaut) {
      return null;
    }
    return {
      astronaut: data.astronaut,
      baselines: data.baselines,
      measurements: data.measurements,
      symptoms: data.symptoms,
      events: data.events,
      activeFlightRules: data.activeFlightRules,
    };
  }, [data]);

  const isStaleCohort = loadedAstronautId !== astronautId;

  if (error && (!data || isStaleCohort)) {
    return (
      <Card className="flex flex-col items-start gap-3 p-6 border-critical/20 bg-critical/10">
        <div className="flex items-center gap-2 text-critical">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs font-medium">{error}</span>
        </div>
        <Button variant="danger" size="sm" onClick={() => void load()}>
          Retry
        </Button>
      </Card>
    );
  }

  if ((isLoading && !data) || isStaleCohort) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card h-36 animate-pulse bg-surface" />
        ))}
      </div>
    );
  }

  const astronaut = data?.astronaut;
  const measurements = data?.measurements ?? [];
  const counts = data?.symptoms.length ?? 0;
  const eventTheme = activeEvent ? severityTheme(activeEvent.severity_level) : null;

  // Environmental snapshot values for the 5-Factor Health Gauge with real-time simulation overrides
  const envTelemetry = computeModuleTelemetry(
    selectedModuleId,
    selectedLocation,
    activeScenarios,
    activeScenario,
  );

  let latestCo2 = envTelemetry.co2;
  let latestCabinTemp = envTelemetry.temp;
  const latestPressure = envTelemetry.pressureMmHg;
  let latestHr = astronaut?.resting_hr ?? 65;
  let latestRmssd = astronaut?.resting_rmssd ?? 55;
  let radValue = envTelemetry.rad;

  if (hasCo2) {
    latestHr = (astronaut?.resting_hr ?? 65) + 27;
    latestRmssd = 24;
  }
  if (hasThermal && !hasCo2) {
    latestHr = (astronaut?.resting_hr ?? 65) + 15;
  }

  const gaugeAutonomicFlag =
    !isNominal &&
    ((latestHr !== null && astronaut ? Math.abs(latestHr - astronaut.resting_hr) > 8 : false) ||
    (latestRmssd !== null && astronaut ? latestRmssd - astronaut.resting_rmssd < -10 : false) ||
    hasCo2);
  const gaugeHrLabel = `${latestHr.toFixed(0)} bpm`;

  return (
    <div className="space-y-6">
      <AstronautOnly>
        {data ? (
          <AstronautOverview
            astronautId={astronautId}
            data={data}
            quickLogging={quickLogging}
            quickNotice={quickNotice}
            onQuickLog={(code) => void quickLogSymptom(code)}
            activeScenario={activeScenario}
            activeScenarios={activeScenarios}
          />
        ) : null}
      </AstronautOnly>

      <SurgeonOnly>
      <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl glass-panel p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-4">
          <AstronautAvatar
            astronautId={astronautId}
            size="xl"
            label={astronaut?.callsign ?? astronautId}
            className="shrink-0"
          />
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-slate-500">
              {astronautId}
              {astronaut?.mission_id ? (
                <span className="text-slate-400"> · {astronaut.mission_id}</span>
              ) : null}
            </p>
            <h2 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {astronaut?.callsign ?? astronautId}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              {astronaut?.crew_role ?? "Crew member"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="default">
                <Gauge className="h-3 w-3" />
                {astronaut?.baseline_window_days ?? 7}-day baseline
              </Badge>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                <span>Station: <strong>{getAstronautDetectedLocation(astronautId).moduleName}</strong> ({getAstronautDetectedLocation(astronautId).location})</span>
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Button
            size="sm"
            variant="default"
            onClick={() => setHealthReportOpen(true)}
            leftIcon={<FileText className="h-3.5 w-3.5 text-slate-600" />}
          >
            Export Health Report
          </Button>
          <span className="field-label mt-1">Last calibration</span>
          <span className="font-mono text-xs text-slate-600">
            {formatDateTime(astronaut?.baseline_calibrated_at ?? null)}
          </span>
          <span className="text-[11px] text-slate-500">Timestamps in UTC</span>
        </div>
      </section>

      {/* 14-Module ISS Location & Sensor Selector */}
      <SpacecraftModuleSelector />

      {/* Cabin Environmental Telemetry Card */}
      <section className="rounded-xl glass-panel p-4 sm:p-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <Wind className={`w-4 h-4 shrink-0 ${latestCo2 > 3500 ? "text-amber-600 animate-pulse" : "text-sky-600"}`} />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 truncate">
              Cabin Environmental Telemetry · {envTelemetry.module.shortName} [{envTelemetry.location}]
            </span>
          </div>
          {hasCo2 && (
            <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-800 animate-pulse">
              CO₂ SPIKE ACTIVE
            </span>
          )}
          {hasThermal && (
            <span className="rounded-full bg-orange-100 border border-orange-300 px-2 py-0.5 text-[10px] font-bold text-orange-800 animate-pulse">
              HEAT SURGE ACTIVE
            </span>
          )}
          {hasSaa && (
            <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-800 animate-pulse">
              SAA RADIATION ACTIVE
            </span>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Cabin CO2 */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 space-y-1">
            <span className="text-[11px] font-medium text-slate-500 block">
              Cabin CO₂ ({isMetric ? "PPM" : "mmHg"})
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className={`font-mono text-xl sm:text-2xl font-bold tabular-nums ${latestCo2 > 3500 ? "text-amber-700" : "text-slate-900"}`}>
                {isMetric ? `${latestCo2.toLocaleString()} PPM` : `${(latestCo2 / 750).toFixed(2)} mmHg`}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono block">
              {isMetric ? "Nominal ≤2,500 PPM" : "Nominal ≤3.33 mmHg"}
            </span>
          </div>

          {/* Cabin Temp */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 space-y-1">
            <span className="text-[11px] font-medium text-slate-500 block">
              Cabin Temp ({isMetric ? "°C" : "°F"})
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className={`font-mono text-xl sm:text-2xl font-bold tabular-nums ${latestCabinTemp > 25.5 ? "text-amber-700" : "text-slate-900"}`}>
                {isMetric ? `${latestCabinTemp.toFixed(1)} °C` : `${(latestCabinTemp * 1.8 + 32).toFixed(1)} °F`}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono block">
              Envelope 20.0–24.0 °C
            </span>
          </div>

          {/* Cabin Pressure */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 space-y-1">
            <span className="text-[11px] font-medium text-slate-500 block">
              Cabin Pressure ({isMetric ? "kPa" : "mmHg"})
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-xl sm:text-2xl font-bold tabular-nums text-slate-900">
                {isMetric ? `${(latestPressure * 0.133322).toFixed(1)} kPa` : `${latestPressure.toFixed(1)} mmHg`}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono block">
              {isMetric ? "Nominal 101.3 kPa" : "Nominal 760.0 mmHg"}
            </span>
          </div>

          {/* Radiation */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 space-y-1">
            <span className="text-[11px] font-medium text-slate-500 block">
              Radiation Flux
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className={`font-mono text-xl sm:text-2xl font-bold tabular-nums ${radValue > 0.35 ? "text-red-700" : "text-slate-900"}`}>
                {radValue.toFixed(2)} mGy/d
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono block">
              Baseline 0.19 mGy/d
            </span>
          </div>
        </div>
      </section>

      {/* Synchronized Physiological Telemetry & Circadian Envelope */}
      <PhysiologicalCards astronautId={astronautId} />

      {/* Segmented Sub-section Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-100/80 p-1.5">
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: "vitals" as const, label: "Vitals & Concordance", icon: Activity },
            { id: "atmospheric" as const, label: "Atmospheric & EDA", icon: Wind },
            { id: "risk" as const, label: "Clinical Risk & Triage", icon: ShieldAlert },
            { id: "all" as const, label: "Command View (All)", icon: Layers },
          ].map((sec) => {
            const active = activeSection === sec.id;
            const Icon = sec.icon;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors duration-150 ${
                  active
                    ? "bg-white text-slate-900 border border-slate-200/80 shadow-xs font-semibold"
                    : "text-slate-600 border border-transparent hover:bg-white/60 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${active ? "text-slate-900" : "text-slate-400"}`} />
                {sec.label}
              </button>
            );
          })}
        </div>
        <div className="px-2 text-[11px] font-mono text-slate-500">
          {activeSection === "all"
            ? "Panoramic multi-subsystem view"
            : `Segment: ${activeSection.toUpperCase()}`}
        </div>
      </div>

      {/* Atmospheric & EDA Sub-section */}
      {(activeSection === "atmospheric" || activeSection === "all") && (
        <section className="space-y-6">
          <EdaStreamController />
        </section>
      )}

      {/* Clinical Risk & Triage Sub-section */}
      {(activeSection === "risk" || activeSection === "all") && (
        <section className="space-y-6">
          <ClinicalRiskMatrix />
          <ContextualTriageBanner />
        </section>
      )}


      {/* Vitals & Concordance Sub-section */}
      {(activeSection === "vitals" || activeSection === "all") && (
        <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-6">
          {activeEvent && eventTheme ? (
            <article className="rounded-xl border border-slate-200 border-l-4 border-l-red-500 bg-white shadow-card p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`badge border ${eventTheme.border} ${eventTheme.text} ${eventTheme.background}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${eventTheme.dot}`} />
                      {eventTheme.label} · Active concordance
                    </span>
                    <Badge variant="default">{activeEvent.review_status}</Badge>
                    <span
                      className={`badge border ${uncertaintyTheme(
                        activeEvent.uncertainty_level,
                      )}`}
                    >
                      Uncertainty {activeEvent.uncertainty_level}
                    </span>
                  </div>
                  <h3 className="mt-2.5 text-lg font-semibold tracking-tight text-slate-900">
                    {titleCase(activeEvent.event_type)}
                  </h3>
                  <EventRationaleDisplay
                    rationale={activeEvent.rationale}
                    eventType={activeEvent.event_type}
                  />
                </div>
                <div className="flex flex-col items-stretch gap-2 shrink-0">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void openForEvent(activeEvent)}
                    leftIcon={<Sparkles className="h-3.5 w-3.5" />}
                  >
                    Explain with Evidence
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => void acknowledge(activeEvent)}
                    disabled={reviewing === activeEvent.event_id}
                    leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  >
                    {activeEvent.review_status === "PENDING" ? "Acknowledge" : "Resolve"}
                  </Button>
                  {isDrawerOpen ? (
                    <span className="text-center text-[11px] uppercase tracking-wider text-slate-600 font-medium">
                      Drawer active
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3">
                  <p className="field-label">Window</p>
                  <p className="mt-1 text-xs text-slate-900 font-mono">
                    {formatDateTime(activeEvent.start_time)} →{" "}
                    {formatDateTime(activeEvent.end_time)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3">
                  <p className="field-label">Peak deviation</p>
                  <p className="mt-1 text-xs text-slate-900 font-mono">
                    {activeEvent.peak_deviation_sigma !== null
                      ? `${formatSigned(activeEvent.peak_deviation_sigma, 2)} σ`
                      : "Not quantified"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3">
                  <p className="field-label">Contributing streams</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {parseStreamIds(activeEvent.contributing_stream_ids).map((stream) => (
                      <span
                        key={stream}
                        className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-mono text-slate-700"
                      >
                        {prettyStream(stream)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Immediate Clinical Action & Flight Countermeasures */}
              <div className="rounded-xl border border-sky-200/80 bg-sky-50/60 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-sky-700" />
                  <span className="font-semibold text-xs text-sky-950 uppercase tracking-wider">
                    Immediate Clinical Action Plan &amp; Protocol Guidelines
                  </span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-sky-700 font-bold shrink-0">01</span>
                    <span>Switch CDRA atmospheric carbon scrubbers to dual-bed high-flow cycle.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-sky-700 font-bold shrink-0">02</span>
                    <span>Verify Node 2 cabin air diffuser fan velocity (≥55 CFM) and direct crew hydration (500 mL).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-sky-700 font-bold shrink-0">03</span>
                    <span>Cross-reference Concordance Timeline for synchronized 4-lane autonomic lag latency.</span>
                  </li>
                </ul>
              </div>
            </article>
          ) : (
            <article className="rounded-xl glass-panel flex items-center gap-4 p-5">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  No active concordance events
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  All evaluated multi-signal windows remain within calibrated circadian
                  envelopes for {astronaut?.callsign ?? astronautId}.
                </p>
              </div>
            </article>
          )}

          {/* Recent Reports / Crew Symptoms */}
          <article className="rounded-xl glass-panel p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Recent crew symptom reports</h3>
              </div>
              <Badge variant="default">{counts} total</Badge>
            </div>
            {recentSymptoms.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-500">
                No symptom reports logged for this crew member.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {recentSymptoms.map((symptom) => (
                  <li
                    key={symptom.report_id}
                    className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-900">
                        {symptom.symptom_code.replace(/_/g, " ")}
                      </span>
                      <span className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <span
                            key={index}
                            className={`h-1.5 w-1.5 rounded-full ${
                              index < symptom.severity ? "bg-slate-800" : "bg-slate-200"
                            }`}
                          />
                        ))}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 font-mono">
                      {formatDateTime(symptom.occurred_at)}
                      {symptom.cabin_module ? ` · ${symptom.cabin_module}` : ""}
                    </p>
                    {symptom.notes ? (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600">
                        {symptom.notes}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </article>

          {/* Recent Concordance History & Audit Log */}
          {orderedEvents.length > 0 && (
            <article className="rounded-xl glass-panel p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Recent concordance history
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  {orderedEvents.length} events
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {orderedEvents.slice(0, 6).map((event) => {
                  const theme = severityTheme(event.severity_level);
                  return (
                    <li
                      key={event.event_id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`h-2 w-2 rounded-full ${theme.dot}`} />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-900">
                            {titleCase(event.event_type)}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {formatDateTime(event.start_time)} · {event.review_status}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`badge border ${theme.border} ${theme.text} ${theme.background}`}
                        >
                          {theme.label}
                        </span>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => void openForEvent(event)}
                        >
                          Explain
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </article>
          )}
        </section>

        <section className="space-y-6">
          <MultiFactorHealthGauge
            co2Ppm={latestCo2}
            radiationMGy={radValue}
            cabinTempC={latestCabinTemp}
            humidityPct={envTelemetry.humidity}
            pressureMmHg={latestPressure > 200 ? latestPressure : 758.2}
            autonomicFlagged={gaugeAutonomicFlag}
            hrLabel={gaugeHrLabel}
            isMetric={isMetric}
          />

          <article className="rounded-xl glass-panel p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-slate-900">Cohort baseline</h3>
            <dl className="mt-3 divide-y divide-slate-100 text-xs">
              {[
                { label: "Resting HR", value: `${astronaut?.resting_hr ?? 0} bpm`, icon: HeartPulse },
                { label: "RMSSD", value: `${astronaut?.resting_rmssd ?? 0} ms`, icon: Brain },
                { label: "SpO₂", value: `${astronaut?.resting_spo2 ?? 0}%`, icon: Droplets },
                {
                  label: "Core temp",
                  value: isMetric
                    ? `${astronaut?.resting_temp ?? 0} °C`
                    : `${((astronaut?.resting_temp ?? 36.8) * 1.8 + 32).toFixed(1)} °F`,
                  icon: Thermometer,
                },
                {
                  label: "Circadian shift",
                  value: `${formatSigned(astronaut?.circadian_phase_shift_hours ?? 0, 1)} h`,
                  icon: Clock3,
                },
              ].map((row) => {
                const Icon = row.icon;
                return (
                  <div
                    key={row.label}
                    className="flex items-center justify-between py-2.5 first:pt-1 last:pb-1"
                  >
                    <dt className="flex items-center gap-2 text-slate-600">
                      <Icon className="h-3.5 w-3.5 text-slate-400" />
                      {row.label}
                    </dt>
                    <dd className="font-semibold font-mono text-slate-900 tabular-nums">{row.value}</dd>
                  </div>
                );
              })}
            </dl>
            <p className="mt-3 flex items-start gap-2 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-500">
              <Wind className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              Rolling {astronaut?.baseline_window_days ?? 7}-day circadian baseline (μ ± 2σ). Decision support only.
            </p>
          </article>

          <article className="rounded-xl glass-panel flex items-start gap-3 p-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
              <Radio className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-xs font-semibold text-slate-900">Decision support</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Events are ranked by operational severity. Explanations are
                grounded in the bundled NASA HRR/OSDR corpus with non-causal verification.
              </p>
            </div>
          </article>
        </section>
        </div>
      )}
      </div>
      </SurgeonOnly>

      <HealthReportModal
        open={healthReportOpen}
        onClose={() => setHealthReportOpen(false)}
        astronautId={astronautId}
        preloadedData={healthReportSource}
      />
    </div>
  );
}
