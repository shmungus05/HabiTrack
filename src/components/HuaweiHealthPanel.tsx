import {
  Activity,
  Calendar,
  Flame,
  Footprints,
  HeartPulse,
  Info,
  Route,
  TrendingUp,
  Upload,
  Watch,
} from "lucide-react";
import Plotly from "plotly.js-basic-dist-min";
import type { Config, Data, Layout } from "plotly.js";
import { useMemo, useState } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import {
  computeMetricCardSummary,
  filterMeasurementsByDateRange,
  formatRecordCount,
  resolveDateRangeBounds,
  toLocalDateInputValue,
  type DateRangeFilter,
  type DateRangePreset,
} from "../lib/huaweiHealthMetrics";
import {
  HUAWEI_METRIC_DEFINITIONS,
  UNAVAILABLE_HUAWEI_METRICS,
  type HuaweiMetricDefinition,
  type HuaweiStreamId,
} from "../lib/huaweiHealthParser";
import { formatDateTime } from "../lib/format";
import type { Measurement } from "../types/api";
import { Badge, Button } from "./ui";

const Plot = createPlotlyComponent(Plotly);

const HUAWEI_COLORS: Record<HuaweiStreamId, string> = {
  stream_huawei_hr: "#dc2626",
  stream_huawei_resting_hr: "#e11d48",
  stream_huawei_steps: "#0284c7",
  stream_huawei_distance: "#059669",
  stream_huawei_active_energy: "#ea580c",
  stream_huawei_flights: "#7c3aed",
};

const HUAWEI_ICONS: Record<HuaweiStreamId, typeof HeartPulse> = {
  stream_huawei_hr: HeartPulse,
  stream_huawei_resting_hr: Activity,
  stream_huawei_steps: Footprints,
  stream_huawei_distance: Route,
  stream_huawei_active_energy: Flame,
  stream_huawei_flights: TrendingUp,
};

const DATE_PRESETS: Array<{ id: DateRangePreset; label: string }> = [
  { id: "all", label: "All imported data" },
  { id: "today", label: "Today" },
  { id: "last7", label: "Last 7 days" },
  { id: "custom", label: "Custom date range" },
];

interface HuaweiHealthPanelProps {
  measurements: Measurement[];
  onOpenImport: () => void;
}

export function HuaweiHealthPanel({
  measurements,
  onOpenImport,
}: HuaweiHealthPanelProps) {
  const [selectedStreamId, setSelectedStreamId] =
    useState<HuaweiStreamId>("stream_huawei_hr");

  const todayStr = useMemo(() => toLocalDateInputValue(new Date()), []);
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>({
    preset: "all",
    customStart: todayStr,
    customEnd: todayStr,
  });

  const huaweiMeasurements = useMemo(
    () =>
      measurements
        .filter((m) => m.provenance_category === "HUAWEI_HEALTH")
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [measurements]
  );

  const importedDateExtent = useMemo(() => {
    if (huaweiMeasurements.length === 0) return null;
    const first = toLocalDateInputValue(new Date(huaweiMeasurements[0].timestamp));
    const last = toLocalDateInputValue(
      new Date(huaweiMeasurements[huaweiMeasurements.length - 1].timestamp)
    );
    return { first, last };
  }, [huaweiMeasurements]);

  const resolvedRange = useMemo(
    () => resolveDateRangeBounds(dateFilter),
    [dateFilter]
  );

  const filteredMeasurements = useMemo(
    () => filterMeasurementsByDateRange(huaweiMeasurements, dateFilter),
    [huaweiMeasurements, dateFilter]
  );

  const groupedByStream = useMemo(() => {
    const map = new Map<string, Measurement[]>();
    for (const def of HUAWEI_METRIC_DEFINITIONS) {
      map.set(def.streamId, []);
    }
    for (const m of filteredMeasurements) {
      const bucket = map.get(m.stream_id);
      if (bucket) bucket.push(m);
    }
    return map;
  }, [filteredMeasurements]);

  const activeDef: HuaweiMetricDefinition = useMemo(
    () =>
      HUAWEI_METRIC_DEFINITIONS.find((d) => d.streamId === selectedStreamId) ??
      HUAWEI_METRIC_DEFINITIONS[0],
    [selectedStreamId]
  );

  const activePoints = groupedByStream.get(activeDef.streamId) ?? [];

  const handlePresetChange = (preset: DateRangePreset) => {
    if (preset === "custom" && importedDateExtent) {
      setDateFilter((prev) => ({
        preset,
        customStart: prev.preset === "custom" ? prev.customStart : importedDateExtent.first,
        customEnd: prev.preset === "custom" ? prev.customEnd : importedDateExtent.last,
      }));
      return;
    }
    setDateFilter((prev) => ({ ...prev, preset }));
  };

  const plotData = useMemo<Data[]>(() => {
    if (activePoints.length === 0) return [];
    const color = HUAWEI_COLORS[activeDef.streamId];
    return [
      {
        type: "scatter",
        mode: "lines+markers",
        name: `${activeDef.label} (${activeDef.unit})`,
        x: activePoints.map((p) => p.timestamp),
        y: activePoints.map((p) => p.value),
        line: { color, width: 2 },
        marker: { color, size: 5 },
        hovertemplate: `%{y:.${activeDef.digits}f} ${activeDef.unit}<br>%{x}<extra></extra>`,
      },
    ];
  }, [activePoints, activeDef]);

  const plotLayout = useMemo<Partial<Layout>>(
    () => ({
      autosize: true,
      height: 260,
      margin: { l: 52, r: 20, t: 18, b: 42 },
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#f8fafc",
      font: { family: "Inter, system-ui, sans-serif", size: 11, color: "#475569" },
      xaxis: {
        type: "date",
        gridcolor: "#e2e8f0",
        tickfont: { size: 10 },
      },
      yaxis: {
        title: { text: activeDef.unit, font: { size: 11 } },
        gridcolor: "#e2e8f0",
        zeroline: false,
      },
      showlegend: false,
    }),
    [activeDef.unit]
  );

  const plotConfig = useMemo<Partial<Config>>(
    () => ({
      responsive: true,
      displayModeBar: false,
    }),
    []
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700">
            <Watch className="h-4 w-4" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Smart Watch Biometrics
              </h2>
              <Badge variant="accent">Health Data Export</Badge>
            </div>
            <p className="text-xs text-slate-500">
              {huaweiMeasurements.length > 0
                ? `${formatRecordCount(huaweiMeasurements.length)} stored locally in IndexedDB`
                : "No Health Data Export imported yet"}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={onOpenImport}
          leftIcon={<Upload className="h-3.5 w-3.5" />}
        >
          Import Health Data
        </Button>
      </div>

      {huaweiMeasurements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-800">
            Ready to import historical smart watch health data
          </p>
          <p className="mx-auto max-w-xl text-xs text-slate-500">
            Click <strong>Import Health Data</strong> to select your{" "}
            <code className="rounded bg-white px-1 py-0.5 font-mono">export.zip</code>. Only
            records with <code className="rounded bg-white px-1 py-0.5 font-mono">sourceName="HUAWEI Health"</code>{" "}
            are imported.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Date range filter">
              <span className="mr-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Range:
              </span>
              {DATE_PRESETS.map((preset) => {
                const active = dateFilter.preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetChange(preset.id)}
                    aria-pressed={active}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                      active
                        ? "border-sky-500 bg-sky-600 text-white shadow-2xs"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {dateFilter.preset === "custom" && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className="flex items-center gap-1.5 text-slate-600">
                  <span>From</span>
                  <input
                    type="date"
                    value={dateFilter.customStart}
                    onChange={(e) =>
                      setDateFilter((prev) => ({ ...prev, customStart: e.target.value }))
                    }
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-slate-600">
                  <span>To</span>
                  <input
                    type="date"
                    value={dateFilter.customEnd}
                    onChange={(e) =>
                      setDateFilter((prev) => ({ ...prev, customEnd: e.target.value }))
                    }
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>
              Selected range:{" "}
              <strong className="font-semibold text-slate-900">{resolvedRange.label}</strong>
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              {formatRecordCount(filteredMeasurements.length)} in range (of{" "}
              {huaweiMeasurements.length.toLocaleString()} total)
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {HUAWEI_METRIC_DEFINITIONS.map((def) => {
              const pts = groupedByStream.get(def.streamId) ?? [];
              const Icon = HUAWEI_ICONS[def.streamId];
              const isSelected = selectedStreamId === def.streamId;
              const summary = computeMetricCardSummary(def, pts);

              return (
                <button
                  key={def.key}
                  type="button"
                  onClick={() => setSelectedStreamId(def.streamId)}
                  className={`rounded-xl border p-3.5 text-left transition cursor-pointer ${
                    isSelected
                      ? "border-sky-400 bg-sky-50/50 ring-1 ring-sky-200"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">
                      {def.label}
                    </span>
                    <Icon
                      className="h-4 w-4"
                      style={{ color: HUAWEI_COLORS[def.streamId] }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                      {summary.displayValue}
                    </span>
                    <span className="text-xs text-slate-500">{def.unit}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{summary.aggregationLabel}</span>
                    <span className="font-mono">{summary.recordCountLabel}</span>
                  </div>
                  {summary.latestTimestamp && (
                    <p className="mt-1 text-[10px] text-slate-400">
                      Last: {formatDateTime(summary.latestTimestamp)}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-800">
                {activeDef.label} ({activeDef.unit}) — {formatRecordCount(activePoints.length)}
              </p>
              <span className="text-[11px] text-slate-500">
                Source: Health Data Export · {resolvedRange.label}
              </span>
            </div>
            {activePoints.length > 0 ? (
              <Plot
                data={plotData}
                layout={plotLayout}
                config={plotConfig}
                style={{ width: "100%", height: "260px" }}
                useResizeHandler
              />
            ) : (
              <div className="flex h-40 items-center justify-center text-xs text-slate-500">
                No {activeDef.label.toLowerCase()} records found in the selected date range.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            <Info className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="font-semibold">Unavailable in export:</span>
            {UNAVAILABLE_HUAWEI_METRICS.map((item) => (
              <span
                key={item.key}
                className="rounded border border-slate-200 bg-white px-2 py-0.5 text-slate-500"
              >
                {item.label} (0 records)
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
