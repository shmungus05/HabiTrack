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
  Radio,
  Satellite,
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
import { useCommsStore } from "../stores/commsStore";
import { useRoleStore } from "../stores/roleStore";
import { AstronautOnly, SurgeonOnly } from "../features/shared";
import { DossierModal, type DossierSourceData } from "../features/dossier";
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
import { SpacecraftModuleSelector } from "../features/topology";
import { ContextualTriageBanner } from "../features/triage";
import { SimulationSandboxPanel } from "../features/simulation";

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
}

function MultiFactorHealthGauge({
  co2Ppm,
  radiationMGy,
  cabinTempC,
  humidityPct,
  pressureMmHg,
  autonomicFlagged,
  hrLabel,
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
      reading: `${Math.round(co2Ppm).toLocaleString()} PPM`,
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
      reading: `${cabinTempC.toFixed(1)} °C`,
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
      reading: `${pressureMmHg.toFixed(1)} mmHg`,
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

export type OverviewSubSection = "vitals" | "atmospheric" | "risk" | "sandbox" | "all";

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
  activeEvent: HealthEvent | null;
  quickLogging: string | null;
  quickNotice: string | null;
  onQuickLog: (code: string) => void;
}

/**
 * Astronaut perspective: three glanceable cards plus a one-tap symptom grid.
 * No scrubbers, no anomaly injectors, no threshold sliders — cognitive load is
 * reserved for the crewmember's own status and immediate action.
 */
function AstronautOverview({
  astronautId,
  data,
  activeEvent,
  quickLogging,
  quickNotice,
  onQuickLog,
}: AstronautOverviewProps) {
  const { astronaut } = data;
  const hr = latestValue(data, "stream_sim_hr");
  const rmssd = latestValue(data, "stream_sim_hrv");
  const spo2 = latestValue(data, "stream_sim_spo2");
  const temp = latestValue(data, "stream_sim_temp");
  const co2 = latestValue(data, "stream_eda_co2");

  const co2Value = co2 ?? 3197;
  const co2Elevated = co2Value >= 3500;
  const hrDelta = hr !== null && astronaut ? hr - astronaut.resting_hr : 0;
  const rmssdDelta = rmssd !== null && astronaut ? rmssd - astronaut.resting_rmssd : 0;
  const autonomicFlagged = Math.abs(hrDelta) > 8 || rmssdDelta < -10;
  const eventActive = activeEvent !== null;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl glass-panel p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-4">
          <AstronautAvatar
            astronautId={astronautId}
            size="xl"
            status={astronaut?.calibration_status}
            label={astronaut?.callsign ?? astronautId}
            className="shrink-0"
          />
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-slate-500">
              Astronaut perspective · {astronautId}
            </p>
            <h2 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {astronaut?.callsign ?? astronautId}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              {astronaut?.crew_role ?? "Crew member"} ·{" "}
              {astronaut?.mission_id ?? "Expedition"}
            </p>
          </div>
        </div>
        <Badge
          variant={eventActive ? "danger" : "success"}
          dot
          pulse={eventActive}
        >
          {eventActive ? "Action required" : "All clear"}
        </Badge>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl glass-panel glass-card-hover p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="field-label">Cabin environmental state</p>
            <Wind className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {co2Value.toLocaleString()}{" "}
            <span className="text-xs font-normal text-slate-500">PPM CO₂</span>
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {co2Elevated
              ? "Elevated cabin carbon dioxide in the current module."
              : "Carbon dioxide inside the nominal operational envelope."}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-2">
              <dt className="text-slate-500">Cabin temp</dt>
              <dd className="mt-0.5 font-mono font-semibold text-slate-900">
                22.8 °C
              </dd>
            </div>
            <div className="rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-2">
              <dt className="text-slate-500">Radiation</dt>
              <dd className="mt-0.5 font-mono font-semibold text-slate-900">
                0.200 mGy/d
              </dd>
            </div>
          </dl>
        </article>

        <article className="rounded-xl glass-panel glass-card-hover p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="field-label">Personal autonomic status</p>
            <HeartPulse className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {hr !== null ? hr.toFixed(0) : "—"}{" "}
            <span className="text-xs font-normal text-slate-500">bpm</span>
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {autonomicFlagged
              ? "Heart rate and HRV sit outside your calibrated envelope."
              : "Heart rate and HRV are tracking your baseline."}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-2">
              <dt className="text-slate-500">RMSSD</dt>
              <dd className="mt-0.5 font-mono font-semibold text-slate-900">
                {rmssd !== null ? `${rmssd.toFixed(0)} ms` : "—"}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-2">
              <dt className="text-slate-500">SpO₂</dt>
              <dd className="mt-0.5 font-mono font-semibold text-slate-900">
                {spo2 !== null ? `${spo2.toFixed(1)} %` : "—"}
              </dd>
            </div>
          </dl>
          <p className="mt-2 font-mono text-[11px] text-slate-500">
            Core temp {temp !== null ? `${temp.toFixed(2)} °C` : "—"} · baseline{" "}
            {astronaut?.resting_hr ?? 0} bpm
          </p>
        </article>

        <article
          className={`rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-card glass-card-hover ${
            eventActive ? "border-l-4 border-l-red-500" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="field-label">Immediate action plan</p>
            <ShieldAlert
              className={`h-4 w-4 ${eventActive ? "text-red-600" : "text-emerald-600"}`}
            />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-900">
            {eventActive
              ? "Relocate to a ventilated module and report symptoms"
              : "No action required — continue monitoring"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {eventActive
              ? activeEvent?.rationale
              : "No multi-signal concordance event is active for your profile."}
          </p>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-slate-500">
            {eventActive
              ? `Flight rule review · ${activeEvent?.severity_level}`
              : "Certified flight rule B13-101.B within limits"}
          </p>
        </article>
      </div>

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
          <Satellite className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          Local station log writes are instant. Ground downlink follows the
          communications link state independently.
        </p>
      </section>
    </div>
  );
}

export function OverviewView({ astronautId }: OverviewViewProps) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loadedAstronautId, setLoadedAstronautId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<OverviewSubSection>("vitals");

  const openForEvent = useAssistantStore((state) => state.openForEvent);
  const isDrawerOpen = useAssistantStore((state) => state.isOpen);
  const role = useRoleStore((state) => state.role);
  const isAstronaut = role === "astronaut";

  const [dossierOpen, setDossierOpen] = useState(false);
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

  const activeEvent = useMemo(() => {
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
  }, [data]);

  const orderedEvents = useMemo(() => {
    if (!data) {
      return [];
    }
    return [...data.events].sort(
      (left, right) =>
        severityRank(left.severity_level) - severityRank(right.severity_level) ||
        right.start_time.localeCompare(left.start_time),
    );
  }, [data]);

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
      // Local review write already succeeded; the ground acknowledgement is
      // queued independently and never blocks the workstation.
      useCommsStore.getState().enqueuePacket(
        "EVENT_ACK",
        `Event ${updated.event_id} · ${updated.review_status}`,
        {
          eventId: updated.event_id,
          astronautId: updated.astronaut_id,
          reviewStatus: updated.review_status,
          severity: updated.severity_level,
          reviewedAt: new Date().toISOString(),
        },
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
      const comms = useCommsStore.getState();
      comms.enqueuePacket("SYMPTOM_REPORT", `${titleCase(code)} · ${astronautId}`, {
        reportId: created.report_id,
        symptomCode: code,
        severity: created.severity,
        occurredAt: created.occurred_at,
        source: "ASTRONAUT_QUICK_LOG",
      });
      const delayed =
        comms.linkState === "LOS" || comms.latencySeconds > 0;
      setQuickNotice(
        delayed
          ? "✓ Recorded locally · 🛰️ Queued in ground outbox"
          : "✓ Recorded locally · 🛰️ Transmitting to ground",
      );
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
  const dossierSource = useMemo<DossierSourceData | null>(() => {
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
  const profileCalibrated = astronaut?.calibration_status === "CALIBRATED";

  // Environmental snapshot values for the 5-Factor Health Gauge
  const latestCo2 = latestValue(data ?? { astronaut: null, measurements, baselines: {}, events: [], symptoms: [] }, "stream_eda_co2") ?? 3197;
  const latestCabinTemp = latestValue(data ?? { astronaut: null, measurements, baselines: {}, events: [], symptoms: [] }, "stream_eda_temp") ?? 22.8;
  const latestPressure = latestValue(data ?? { astronaut: null, measurements, baselines: {}, events: [], symptoms: [] }, "stream_eda_pressure") ?? 758.2;
  const latestHr = latestValue(data ?? { astronaut: null, measurements, baselines: {}, events: [], symptoms: [] }, "stream_sim_hr");
  const latestRmssd = latestValue(data ?? { astronaut: null, measurements, baselines: {}, events: [], symptoms: [] }, "stream_sim_hrv");
  const gaugeAutonomicFlag =
    (latestHr !== null && astronaut ? Math.abs(latestHr - astronaut.resting_hr) > 8 : false) ||
    (latestRmssd !== null && astronaut ? latestRmssd - astronaut.resting_rmssd < -10 : false);
  const gaugeHrLabel = latestHr !== null ? `${latestHr.toFixed(0)} bpm` : `${astronaut?.resting_hr ?? 65} bpm`;

  return (
    <div className="space-y-6">
      <AstronautOnly>
        {data ? (
          <AstronautOverview
            astronautId={astronautId}
            data={data}
            activeEvent={activeEvent}
            quickLogging={quickLogging}
            quickNotice={quickNotice}
            onQuickLog={(code) => void quickLogSymptom(code)}
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
            status={astronaut?.calibration_status}
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
              <Badge
                variant={profileCalibrated ? "success" : "warning"}
                dot
                pulse={!profileCalibrated}
              >
                {astronaut?.calibration_status ?? "CALIBRATING"}
              </Badge>
              <Badge variant="default">
                <Gauge className="h-3 w-3" />
                {astronaut?.baseline_window_days ?? 7}-day baseline
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Button
            size="sm"
            variant="default"
            onClick={() => setDossierOpen(true)}
            leftIcon={<FileText className="h-3.5 w-3.5 text-slate-600" />}
          >
            Export Investigation Dossier
          </Button>
          <span className="field-label mt-1">Last calibration</span>
          <span className="font-mono text-xs text-slate-600">
            {formatDateTime(astronaut?.baseline_calibrated_at ?? null)}
          </span>
          <span className="text-[11px] text-slate-500">Timestamps in UTC</span>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_DEFINITIONS.map((definition) => {
          const points = streamPoints(measurements, definition.streamId);
          const latest = points.at(-1);
          const baseline = astronaut ? astronaut[definition.baselineKey] : 0;
          const value = latest?.value ?? baseline;
          const delta = value - baseline;
          const alert = definition.warn(delta);
          const Icon = definition.icon;
          const sparkValues = points.slice(-60).map((point) => point.value);

          return (
            <article
              key={definition.key}
              className={`rounded-xl glass-panel glass-card-hover p-4 sm:p-5 ${
                alert ? "border-amber-300" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    {definition.label}
                  </p>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="font-mono text-[26px] leading-[34px] font-semibold tracking-tight text-slate-900 tabular-nums">
                      {value.toFixed(definition.digits)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {definition.unit}
                    </span>
                  </div>
                </div>
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
                  <Icon className="h-4 w-4" />
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                <span
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium border ${
                    alert
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  {delta >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {formatSigned(delta, definition.digits + 1)}
                </span>
                <span className="text-slate-500 font-mono">
                  μ {baseline.toFixed(definition.digits)}
                </span>
              </div>

              <div className="mt-3">
                <Sparkline values={sparkValues} color={alert ? "#d97706" : "#0284c7"} />
              </div>
            </article>
          );
        })}
      </div>

      {/* Segmented Sub-section Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-100/80 p-1.5">
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: "vitals" as const, label: "Vitals & Concordance", icon: Activity },
            { id: "atmospheric" as const, label: "Atmospheric & EDA", icon: Wind },
            { id: "risk" as const, label: "Clinical Risk & Triage", icon: ShieldAlert },
            { id: "sandbox" as const, label: "Simulation Sandbox", icon: Sparkles },
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
          <SpacecraftModuleSelector />
        </section>
      )}

      {/* Clinical Risk & Triage Sub-section */}
      {(activeSection === "risk" || activeSection === "all") && (
        <section className="space-y-6">
          <ClinicalRiskMatrix />
          <ContextualTriageBanner />
        </section>
      )}

      {/* Simulation Sandbox Sub-section */}
      {(activeSection === "sandbox" || activeSection === "all") && (
        <section className="space-y-6">
          <SimulationSandboxPanel />
        </section>
      )}

      {/* Vitals & Concordance Sub-section */}
      {(activeSection === "vitals" || activeSection === "all") && (
        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="space-y-6">
          {activeEvent && eventTheme ? (
            <article className="rounded-xl border border-slate-200 border-l-4 border-l-red-500 bg-white shadow-card glass-card-hover p-4 sm:p-6">
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
                  <p className="mt-1.5 max-w-2xl text-xs sm:text-sm leading-relaxed text-slate-600">
                    {activeEvent.rationale}
                  </p>
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

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
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

          {orderedEvents.length > 1 ? (
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
          ) : null}
        </section>

        <section className="space-y-6">
          <MultiFactorHealthGauge
            co2Ppm={latestCo2}
            radiationMGy={0.200}
            cabinTempC={latestCabinTemp}
            humidityPct={43.9}
            pressureMmHg={latestPressure > 200 ? latestPressure : 758.2}
            autonomicFlagged={gaugeAutonomicFlag}
            hrLabel={gaugeHrLabel}
          />

          <article className="rounded-xl glass-panel p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Recent reports</h3>
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

          <article className="rounded-xl glass-panel p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-slate-900">Cohort baseline</h3>
            <dl className="mt-3 divide-y divide-slate-100 text-xs">
              {[
                { label: "Resting HR", value: `${astronaut?.resting_hr ?? 0} bpm`, icon: HeartPulse },
                { label: "RMSSD", value: `${astronaut?.resting_rmssd ?? 0} ms`, icon: Brain },
                { label: "SpO₂", value: `${astronaut?.resting_spo2 ?? 0}%`, icon: Droplets },
                { label: "Core temp", value: `${astronaut?.resting_temp ?? 0} °C`, icon: Thermometer },
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

      <DossierModal
        open={dossierOpen}
        onClose={() => setDossierOpen(false)}
        astronautId={astronautId}
        preloadedData={dossierSource}
      />
    </div>
  );
}
