/**
 * Pure Environmental Trends & NASA EDA Telemetry Timeline
 *
 * Exclusively displays authentic NASA Environmental Data Application (EDA) streams:
 * - CO₂ (PPM)
 * - Temperature (°C)
 * - Humidity (%)
 * - Radiation (mGy/day)
 * - Pressure (kPa)
 *
 * Supports hourly and granular time views (1h, 6h, 12h, 24h) with 100% data authenticity.
 */

import { Activity, Layers, TriangleAlert, Clock } from "lucide-react";
import Plotly from "plotly.js-basic-dist-min";
import type { Config, Data, Layout } from "plotly.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import createPlotlyComponent from "react-plotly.js/factory";

import {
  fetchBaselines,
  fetchEvents,
  fetchMeasurements,
  fetchSymptoms,
} from "../services/api";
import { useAssistantStore } from "../stores/assistantStore";
import {
  TELEMETRY_STREAMS,
  useTimelineStore,
  type TelemetryStreamId,
} from "../stores/timelineStore";
import type {
  Baselines,
  HealthEvent,
  Measurement,
  SymptomReport,
} from "../types/api";
import {
  formatDateTime,
  prettyStream,
  severityTheme,
  titleCase,
} from "../lib/format";
import { Button } from "./ui";
import { HuaweiHealthPanel } from "./HuaweiHealthPanel";

const Plot = createPlotlyComponent(Plotly);

// High-contrast clean light palette matching the rest of the application
const STREAM_COLORS: Record<string, string> = {
  stream_eda_co2: "#0284c7", // Sky blue for CO2
  stream_eda_temp: "#ea580c", // Warm amber/orange for Temperature
  stream_eda_humidity: "#9333ea", // Vibrant purple for Humidity
  stream_eda_radiation: "#d97706", // Gold/Amber for Radiation
  stream_eda_pressure: "#059669", // Emerald green for Pressure
};

interface TimelineViewProps {
  astronautId: string;
  onOpenHealthImport?: () => void;
  healthImportRevision?: number;
}

interface TimelineData {
  measurements: Measurement[];
  baselines: Baselines;
  events: HealthEvent[];
  symptoms: SymptomReport[];
}

type HourRange = "1h" | "6h" | "12h" | "24h" | "all";

function byTimestamp(left: Measurement, right: Measurement): number {
  return left.timestamp.localeCompare(right.timestamp);
}

function streamPoints(measurements: Measurement[], streamId: string): Measurement[] {
  return measurements
    .filter(
      (item) =>
        item.stream_id === streamId &&
        item.quality_status !== "GAP" &&
        Number.isFinite(item.value),
    )
    .sort(byTimestamp);
}

function toTrace(points: Measurement[]): { x: string[]; y: number[] } {
  return {
    x: points.map((point) => point.timestamp),
    y: points.map((point) => point.value),
  };
}

export function TimelineView({
  astronautId,
  onOpenHealthImport,
  healthImportRevision = 0,
}: TimelineViewProps) {
  const [data, setData] = useState<TimelineData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedRange, setSelectedRange] = useState<HourRange>("all");

  const selectedStreams = useTimelineStore((state) => state.selectedStreams);
  const toggleStream = useTimelineStore((state) => state.toggleStream);
  const zoomRange = useTimelineStore((state) => state.zoomRange);
  const setZoomRange = useTimelineStore((state) => state.setZoomRange);
  const isDrawerOpen = useAssistantStore((state) => state.isOpen);
  const openForEvent = useAssistantStore((state) => state.openForEvent);

  const plotRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [measurements, baselines, events, symptoms] = await Promise.all([
        fetchMeasurements(astronautId, 720, 10000),
        fetchBaselines(astronautId),
        fetchEvents(astronautId),
        fetchSymptoms(astronautId),
      ]);
      setData({ measurements, baselines, events, symptoms });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load mission telemetry.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [astronautId]);

  useEffect(() => {
    void load();
  }, [load, reloadToken, healthImportRevision]);

  useEffect(() => {
    const handleResize = () => {
      if (plotRef.current) {
        Plotly.Plots.resize(plotRef.current);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const measurements = data?.measurements ?? [];
  const events = data?.events ?? [];
  const symptoms = data?.symptoms ?? [];

  const visible = useCallback(
    (streamId: TelemetryStreamId) => selectedStreams.includes(streamId),
    [selectedStreams],
  );

  const timeWindow = useMemo(() => {
    if (!measurements.length) {
      const end = Date.now();
      return { startMs: end - 24 * 60 * 60 * 1000, endMs: end };
    }
    const sorted = [...measurements].sort(byTimestamp);
    return {
      startMs: new Date(sorted[0].timestamp).getTime(),
      endMs: new Date(sorted[sorted.length - 1].timestamp).getTime(),
    };
  }, [measurements]);

  // Handle Quick Hour window presets (1h, 6h, 12h, 24h, all)
  const effectiveRange = useMemo(() => {
    if (selectedRange === "all" || !measurements.length) {
      return zoomRange ?? [
        new Date(timeWindow.startMs).toISOString(),
        new Date(timeWindow.endMs).toISOString(),
      ];
    }
    const endMs = timeWindow.endMs;
    const hours =
      selectedRange === "1h" ? 1 : selectedRange === "6h" ? 6 : selectedRange === "12h" ? 12 : 24;
    const startMs = Math.max(timeWindow.startMs, endMs - hours * 60 * 60 * 1000);
    return [new Date(startMs).toISOString(), new Date(endMs).toISOString()];
  }, [selectedRange, timeWindow, zoomRange, measurements.length]);

  const figure = useMemo(() => {
    const traces: Data[] = [];

    const co2 = streamPoints(measurements, "stream_eda_co2");
    const temp = streamPoints(measurements, "stream_eda_temp");
    const humidity = streamPoints(measurements, "stream_eda_humidity");
    const radiation = streamPoints(measurements, "stream_eda_radiation");
    const pressure = streamPoints(measurements, "stream_eda_pressure");

    // Primary Axis: CO2 (PPM) & Pressure (kPa)
    if (visible("stream_eda_co2") && co2.length) {
      traces.push({
        ...toTrace(co2),
        type: "scatter",
        mode: "lines+markers",
        name: "CO₂ (PPM)",
        yaxis: "y",
        line: { color: STREAM_COLORS.stream_eda_co2, width: 2.2, shape: "spline" },
        marker: { size: 4, color: STREAM_COLORS.stream_eda_co2 },
        hovertemplate: "CO₂: %{y:.0f} PPM<br>%{x|%H:%M MMT / UTC}<extra></extra>",
      } as unknown as Data);
    }

    if (visible("stream_eda_pressure") && pressure.length) {
      traces.push({
        ...toTrace(pressure),
        type: "scatter",
        mode: "lines",
        name: "Pressure (kPa)",
        yaxis: "y4",
        line: { color: STREAM_COLORS.stream_eda_pressure, width: 1.6, dash: "dot" },
        hovertemplate: "Pressure: %{y:.2f} kPa<br>%{x|%H:%M}<extra></extra>",
      } as unknown as Data);
    }

    // Secondary Axis: Temperature (°C)
    if (visible("stream_eda_temp") && temp.length) {
      traces.push({
        ...toTrace(temp),
        type: "scatter",
        mode: "lines+markers",
        name: "Temperature (°C)",
        yaxis: "y2",
        line: { color: STREAM_COLORS.stream_eda_temp, width: 2, shape: "spline" },
        marker: { size: 4, color: STREAM_COLORS.stream_eda_temp },
        hovertemplate: "Temperature: %{y:.1f} °C<br>%{x|%H:%M}<extra></extra>",
      } as unknown as Data);
    }

    // Tertiary Axis: Humidity (%)
    if (visible("stream_eda_humidity") && humidity.length) {
      traces.push({
        ...toTrace(humidity),
        type: "scatter",
        mode: "lines+markers",
        name: "Humidity (%)",
        yaxis: "y2",
        line: { color: STREAM_COLORS.stream_eda_humidity, width: 2, dash: "dashdot" },
        marker: { size: 4, color: STREAM_COLORS.stream_eda_humidity },
        hovertemplate: "Humidity: %{y:.1f} %<br>%{x|%H:%M}<extra></extra>",
      } as unknown as Data);
    }

    // Quaternary Axis: Radiation (mGy/day)
    if (visible("stream_eda_radiation") && radiation.length) {
      traces.push({
        ...toTrace(radiation),
        type: "scatter",
        mode: "lines+markers",
        name: "Radiation (mGy/day)",
        yaxis: "y3",
        line: { color: STREAM_COLORS.stream_eda_radiation, width: 2.2, shape: "spline" },
        marker: { size: 4, color: STREAM_COLORS.stream_eda_radiation },
        hovertemplate: "Radiation: %{y:.3f} mGy/day<br>%{x|%H:%M}<extra></extra>",
      } as unknown as Data);
    }

    const monoFont = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

    const layout = {
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#f8fafc",
      font: {
        color: "#334155",
        family: monoFont,
        size: 11,
      },
      margin: { l: 65, r: 110, t: 40, b: 48 },
      showlegend: true,
      legend: {
        orientation: "h",
        x: 0.5,
        y: 1.09,
        xanchor: "center",
        yanchor: "bottom",
        font: { size: 11, color: "#334155", family: monoFont },
        bgcolor: "rgba(255, 255, 255, 0.94)",
        bordercolor: "#e2e8f0",
        borderwidth: 1,
      },
      hovermode: "x unified",
      dragmode: "pan",
      hoverlabel: {
        bgcolor: "#ffffff",
        bordercolor: "#cbd5e1",
        font: { size: 12, color: "#0f172a", family: monoFont },
      },
      xaxis: {
        domain: [0, 0.90],
        type: "date",
        range: effectiveRange,
        minallowed: new Date(timeWindow.startMs).toISOString(),
        maxallowed: new Date(timeWindow.endMs).toISOString(),
        rangeslider: { visible: false },
        gridcolor: "#e2e8f0",
        zeroline: false,
        tickformat: "%H:%M",
        dtick: 3600 * 1000, // Hourly ticks
        tickfont: { size: 11, color: "#64748b" },
        showspikes: true,
        spikemode: "across",
        spikesnap: "cursor",
        spikecolor: "#0284c7",
        spikethickness: 1,
        spikedash: "dot",
      },
      yaxis: {
        title: {
          text: "CO₂ (PPM)",
          font: { size: 11, color: STREAM_COLORS.stream_eda_co2 },
          standoff: 6,
        },
        range: [0, 4200],
        gridcolor: "#e2e8f0",
        zeroline: false,
        fixedrange: true,
        tickfont: { size: 11, color: "#64748b" },
      },
      yaxis2: {
        title: {
          text: "Temp (°C) / Humidity (%)",
          font: { size: 11, color: STREAM_COLORS.stream_eda_temp },
          standoff: 6,
        },
        overlaying: "y",
        side: "right",
        range: [0, 100],
        showgrid: false,
        fixedrange: true,
        tickfont: { size: 11, color: "#64748b" },
      },
      yaxis3: {
        title: {
          text: "Radiation (mGy/day)",
          font: { size: 11, color: STREAM_COLORS.stream_eda_radiation },
          standoff: 6,
        },
        overlaying: "y",
        side: "right",
        position: 0.97,
        range: [0, 0.5],
        showgrid: false,
        fixedrange: true,
        tickfont: { size: 10, color: STREAM_COLORS.stream_eda_radiation },
      },
      yaxis4: {
        overlaying: "y",
        side: "left",
        position: 0.02,
        range: [95, 105],
        showgrid: false,
        showticklabels: false,
        fixedrange: true,
      },
      uirevision: astronautId,
    };

    return { traces, layout: layout as unknown as Partial<Layout> };
  }, [measurements, visible, timeWindow, astronautId, effectiveRange]);

  const config = useMemo(
    () =>
      ({
        responsive: true,
        displaylogo: false,
        scrollZoom: "cartesian",
        displayModeBar: true,
        plotGlPixelRatio: 2,
        modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"],
      }) as Partial<Config>,
    [],
  );

  const handleRelayout = useCallback(
    (event: Readonly<Record<string, unknown>>) => {
      const start = event["xaxis.range[0]"];
      const end = event["xaxis.range[1]"];
      if (typeof start === "string" && typeof end === "string") {
        setZoomRange([start, end]);
        setSelectedRange("all");
      } else if (event["xaxis.autorange"] === true) {
        setZoomRange(null);
        setSelectedRange("all");
      }
    },
    [setZoomRange],
  );

  const windowLabel = useMemo(() => {
    if (!measurements.length) {
      return "No telemetry ingested";
    }
    return `${formatDateTime(
      new Date(timeWindow.startMs).toISOString(),
    )} → ${formatDateTime(new Date(timeWindow.endMs).toISOString())} (NASA EDA RR-1 Archival Telemetry)`;
  }, [measurements.length, timeWindow]);

  // Current latest values for HUD readout
  const latestCo2 = measurements.filter((m) => m.stream_id === "stream_eda_co2").slice(-1)[0]?.value;
  const latestTemp = measurements.filter((m) => m.stream_id === "stream_eda_temp").slice(-1)[0]?.value;
  const latestHumidity = measurements.filter((m) => m.stream_id === "stream_eda_humidity").slice(-1)[0]?.value;
  const latestRadiation = measurements.filter((m) => m.stream_id === "stream_eda_radiation").slice(-1)[0]?.value;

  const hasTelemetry = measurements.length > 0;

  return (
    <div className="space-y-4">
      {/* Top Header Card in Clean White Theme */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl glass-panel bg-white border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Environmental Trends
          </h2>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live MMT Time
          </span>
          <span className="text-xs text-muted font-mono hidden md:inline-block">
            {windowLabel}
          </span>
        </div>

        {/* Quick Range Selectors: 1h, 6h, 12h, 24h, all */}
        <div className="flex items-center gap-1 bg-surface-subtle border border-border rounded-lg p-1">
          {(["1h", "6h", "12h", "24h", "all"] as HourRange[]).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => {
                setSelectedRange(range);
                setZoomRange(null);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                selectedRange === range
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-muted hover:text-foreground hover:bg-white"
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setReloadToken((token) => token + 1)}
            leftIcon={<Activity className={`h-3.5 w-3.5 text-sky-600 ${isLoading ? "animate-pulse" : ""}`} />}
            className="text-secondary hover:text-foreground ml-1 text-xs"
          >
            {isLoading ? "Syncing" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Stream Toggle Bar & Station Telemetry Pill in Clean White Theme */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {TELEMETRY_STREAMS.map((streamId) => {
            const active = selectedStreams.includes(streamId);
            return (
              <button
                key={streamId}
                type="button"
                onClick={() => toggleStream(streamId)}
                className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors select-none ${
                  active
                    ? "border-sky-300 bg-sky-50 text-sky-800 shadow-sm"
                    : "border-border bg-white text-muted hover:text-foreground hover:bg-surface-subtle"
                }`}
              >
                <span
                  className="mr-2 inline-block h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: active ? STREAM_COLORS[streamId] : "#94a3b8",
                  }}
                />
                {prettyStream(streamId)}
              </button>
            );
          })}
        </div>

        {/* Live Station Telemetry Readout Pill */}
        {latestCo2 !== undefined && (
          <div className="flex items-center gap-3 text-xs bg-white border border-border px-3.5 py-1.5 rounded-lg text-secondary shadow-sm">
            <span className="font-semibold text-foreground">Station Telemetry:</span>
            <span>CO₂ <strong className="text-sky-600">{latestCo2.toFixed(0)} PPM</strong></span>
            <span>Temp <strong className="text-amber-600">{latestTemp?.toFixed(1)} °C</strong></span>
            <span>Humidity <strong className="text-purple-600">{latestHumidity?.toFixed(0)} %</strong></span>
            <span>Radiation <strong className="text-yellow-600">{latestRadiation?.toFixed(3)} mGy/d</strong></span>
          </div>
        )}
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Main Chart Container */}
      <div
        className={`transition-[width] duration-300 ease-out ${
          isDrawerOpen ? "w-full lg:w-[calc(100%-500px)]" : "w-full"
        }`}
      >
        <div className="rounded-xl border border-border bg-white relative h-[calc(100vh-260px)] min-h-[580px] overflow-hidden p-2 shadow-sm">
          {!hasTelemetry && !isLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted">
              <span className="grid h-12 w-12 place-items-center rounded-lg border border-border bg-surface-subtle text-sky-600">
                <Clock className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  No telemetry in this window
                </h3>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">
                  Loading the authentic NASA EDA RR-1 environmental dataset.
                </p>
              </div>
            </div>
          ) : (
            <Plot
              data={figure.traces}
              layout={figure.layout}
              config={config}
              style={{ width: "100%", height: "100%" }}
              useResizeHandler
              onInitialized={(_figure, graphDiv) => {
                plotRef.current = graphDiv;
              }}
              onRelayout={handleRelayout}
              onPurge={() => {
                plotRef.current = null;
              }}
            />
          )}
        </div>
      </div>

      {events.length ? (
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-foreground">Authentic NASA EDA Anomalies & Orbital Passes</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {events.slice(0, 4).map((event) => {
              const theme = severityTheme(event.severity_level);
              return (
                <button
                  key={event.event_id}
                  type="button"
                  onClick={() => void openForEvent(event)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors hover:bg-surface-subtle ${theme.border} ${theme.text}`}
                >
                  {theme.label} · {titleCase(event.event_type)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {measurements.some((m) => m.provenance_category === "HUAWEI_HEALTH") ? (
        <HuaweiHealthPanel
          measurements={measurements}
          onOpenImport={() => onOpenHealthImport?.()}
        />
      ) : null}
    </div>
  );
}
