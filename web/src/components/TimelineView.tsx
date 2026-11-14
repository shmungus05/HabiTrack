/**
 * Theorem: a single unified Plotly figure with four synchronized strata keeps
 * every lane locked to one x-axis, so a zoom on cabin CO₂ reveals the exact
 * same interval of autonomic and thermal response.
 *
 * Lane 1 — cabin atmosphere (CO₂ + temperature)
 * Lane 2 — cardiovascular / autonomic (HR + RMSSD, μ±2σ ribbons)
 * Lane 3 — thermoregulation / oxygenation (core temp + SpO₂)
 * Lane 4 — statistical deviation, concordance ribbons, and symptom markers
 *
 * Calmed, focused visualization with high contrast legibility and minimal eye strain.
 */

import { Activity, Layers, TriangleAlert, Waves } from "lucide-react";
import Plotly from "plotly.js-basic-dist-min";
import type { Config, Data, Layout, Shape } from "plotly.js";
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
  CircadianBinStats,
  HealthEvent,
  Measurement,
  SymptomReport,
} from "../types/api";
import {
  formatDateTime,
  parseStreamIds,
  prettyStream,
  severityTheme,
  titleCase,
} from "../lib/format";
import { Badge, Button } from "./ui";

const Plot = createPlotlyComponent(Plotly);

const WINDOW_HOURS = 336;
// Channel-specific telemetry spectrum: distinct high-contrast hues on light canvas.
const STREAM_COLORS: Record<string, string> = {
  stream_eda_co2: "#0284c7",
  stream_eda_temp: "#ea580c",
  stream_eda_pressure: "#059669",
  stream_sim_hr: "#0891b2",
  stream_sim_hrv: "#059669",
  stream_sim_spo2: "#0284c7",
  stream_sim_temp: "#d97706",
};

const LANE_LABELS = [
  { text: "LANE 1 · CABIN ATMOSPHERE", y: 1.015, color: "#0284c7" },
  { text: "LANE 2 · CARDIOVASCULAR / AUTONOMIC", y: 0.755, color: "#0891b2" },
  { text: "LANE 3 · THERMOREGULATION / OXYGENATION", y: 0.5, color: "#059669" },
  { text: "LANE 4 · DEVIATION / CONCORDANCE", y: 0.245, color: "#d97706" },
];

interface TimelineViewProps {
  astronautId: string;
}

interface TimelineData {
  measurements: Measurement[];
  baselines: Baselines;
  events: HealthEvent[];
  symptoms: SymptomReport[];
}

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

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function buildRibbon(
  bins: CircadianBinStats[] | undefined,
  startMs: number,
  endMs: number,
): { x: string[]; y: number[] } | null {
  if (!bins?.length || !Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return null;
  }
  const byHour = new Map(bins.map((bin) => [bin.hour_bin, bin]));
  const stepMs = 30 * 60 * 1000;
  const xs: string[] = [];
  const upper: number[] = [];
  const lower: number[] = [];

  for (let time = Math.ceil(startMs / stepMs) * stepMs; time <= endMs; time += stepMs) {
    const hour = new Date(time).getUTCHours();
    const bin = byHour.get(hour);
    if (!bin || bin.sample_count <= 0) {
      continue;
    }
    xs.push(new Date(time).toISOString());
    upper.push(bin.upper);
    lower.push(bin.lower);
  }

  if (xs.length < 2) {
    return null;
  }
  const reversedLower = [...lower].reverse();
  return {
    x: [...xs, ...[...xs].reverse()],
    y: [...upper, ...reversedLower],
  };
}

function zScores(
  points: Measurement[],
  bins: CircadianBinStats[] | undefined,
): { x: string[]; y: number[] } {
  if (!bins?.length) {
    return { x: points.map((point) => point.timestamp), y: points.map(() => 0) };
  }
  const byHour = new Map(bins.map((bin) => [bin.hour_bin, bin]));
  return {
    x: points.map((point) => point.timestamp),
    y: points.map((point) => {
      const bin = byHour.get(new Date(point.timestamp).getUTCHours());
      if (!bin || !Number.isFinite(bin.std) || bin.std === 0) {
        return 0;
      }
      return (point.value - bin.mean) / bin.std;
    }),
  };
}

function gapShapes(points: Measurement[]): Partial<Shape>[] {
  const gaps: Partial<Shape>[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = new Date(points[index - 1].timestamp).getTime();
    const current = new Date(points[index].timestamp).getTime();
    if (
      Number.isFinite(previous) &&
      Number.isFinite(current) &&
      current - previous > 20 * 60 * 1000
    ) {
      gaps.push({
        type: "rect",
        xref: "x",
        yref: "paper",
        x0: points[index - 1].timestamp,
        x1: points[index].timestamp,
        y0: 0,
        y1: 1,
        fillcolor: "rgba(15, 23, 42, 0.04)",
        line: { width: 0 },
        layer: "below",
      });
    }
  }
  return gaps;
}

export function TimelineView({ astronautId }: TimelineViewProps) {
  const [data, setData] = useState<TimelineData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const decimationEnabled = useTimelineStore((state) => state.decimationEnabled);
  const toggleDecimation = useTimelineStore((state) => state.toggleDecimation);
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
        fetchMeasurements(astronautId, WINDOW_HOURS, decimationEnabled ? 1000 : 10000),
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
  }, [astronautId, decimationEnabled]);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  useEffect(() => {
    const handleResize = () => {
      if (plotRef.current) {
        Plotly.Plots.resize(plotRef.current);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (plotRef.current) {
        Plotly.Plots.resize(plotRef.current);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isDrawerOpen, decimationEnabled, data?.measurements.length]);

  useEffect(
    () => () => {
      if (plotRef.current) {
        Plotly.purge(plotRef.current);
        plotRef.current = null;
      }
    },
    [],
  );

  const measurements = data?.measurements ?? [];
  const baselines = data?.baselines ?? {};
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

  const figure = useMemo(() => {
    const traces: Data[] = [];
    const shapes: Partial<Shape>[] = [];

    const co2 = streamPoints(measurements, "stream_eda_co2");
    const cabinTemp = streamPoints(measurements, "stream_eda_temp");
    const cabinPressure = streamPoints(measurements, "stream_eda_pressure");
    const heartRate = streamPoints(measurements, "stream_sim_hr");
    const rmssd = streamPoints(measurements, "stream_sim_hrv");
    const coreTemp = streamPoints(measurements, "stream_sim_temp");
    const spo2 = streamPoints(measurements, "stream_sim_spo2");

    if (visible("stream_eda_co2") && co2.length) {
      traces.push({
        ...toTrace(co2),
        type: "scattergl",
        mode: "lines",
        name: "CO₂",
        yaxis: "y",
        line: { color: STREAM_COLORS.stream_eda_co2, width: 1.6 },
        hovertemplate: "CO₂ %{y:.2f} mmHg<br>%{x|%b %d %H:%M}<extra></extra>",
      } as unknown as Data);
    }
    if (visible("stream_eda_temp") && cabinTemp.length) {
      traces.push({
        ...toTrace(cabinTemp),
        type: "scattergl",
        mode: "lines",
        name: "Cabin temp",
        yaxis: "y2",
        line: { color: STREAM_COLORS.stream_eda_temp, width: 1.2, dash: "dot" },
        hovertemplate: "Cabin %{y:.2f} °C<br>%{x|%b %d %H:%M}<extra></extra>",
      } as unknown as Data);
    }
    if (visible("stream_eda_pressure") && cabinPressure.length) {
      traces.push({
        ...toTrace(cabinPressure),
        type: "scattergl",
        mode: "lines",
        name: "Cabin pressure",
        yaxis: "y2",
        line: { color: STREAM_COLORS.stream_eda_pressure, width: 1, dash: "dot" },
        opacity: 0.45,
        hovertemplate: "Pressure %{y:.2f} kPa<br>%{x|%b %d %H:%M}<extra></extra>",
      } as unknown as Data);
    }

    const hrRibbon = buildRibbon(
      baselines.stream_sim_hr,
      timeWindow.startMs,
      timeWindow.endMs,
    );
    if (visible("stream_sim_hr") && hrRibbon) {
      traces.push({
        x: hrRibbon.x,
        y: hrRibbon.y,
        fill: "toself",
        fillcolor: hexToRgba(STREAM_COLORS.stream_sim_hr, 0.06),
        line: { color: "transparent" },
        hoverinfo: "skip",
        showlegend: false,
        name: "HR μ±2σ",
        yaxis: "y3",
        type: "scatter",
      } as unknown as Data);
    }

    if (visible("stream_sim_hr") && heartRate.length) {
      traces.push({
        ...toTrace(heartRate),
        type: "scattergl",
        mode: "lines",
        name: "HR",
        yaxis: "y3",
        line: { color: STREAM_COLORS.stream_sim_hr, width: 1.6 },
        hovertemplate: "HR %{y:.0f} bpm<br>%{x|%b %d %H:%M}<extra></extra>",
      } as unknown as Data);
    }

    const rmssdRibbon = buildRibbon(
      baselines.stream_sim_hrv,
      timeWindow.startMs,
      timeWindow.endMs,
    );
    if (visible("stream_sim_hrv") && rmssdRibbon) {
      traces.push({
        x: rmssdRibbon.x,
        y: rmssdRibbon.y,
        fill: "toself",
        fillcolor: hexToRgba(STREAM_COLORS.stream_sim_hrv, 0.06),
        line: { color: "transparent" },
        hoverinfo: "skip",
        showlegend: false,
        name: "RMSSD μ±2σ",
        yaxis: "y4",
        type: "scatter",
      } as unknown as Data);
    }

    if (visible("stream_sim_hrv") && rmssd.length) {
      traces.push({
        ...toTrace(rmssd),
        type: "scattergl",
        mode: "lines",
        name: "RMSSD",
        yaxis: "y4",
        line: { color: STREAM_COLORS.stream_sim_hrv, width: 1.4 },
        hovertemplate: "RMSSD %{y:.0f} ms<br>%{x|%b %d %H:%M}<extra></extra>",
      } as unknown as Data);
    }

    const tempRibbon = buildRibbon(
      baselines.stream_sim_temp,
      timeWindow.startMs,
      timeWindow.endMs,
    );
    if (visible("stream_sim_temp") && tempRibbon) {
      traces.push({
        x: tempRibbon.x,
        y: tempRibbon.y,
        fill: "toself",
        fillcolor: hexToRgba(STREAM_COLORS.stream_sim_temp, 0.06),
        line: { color: "transparent" },
        hoverinfo: "skip",
        showlegend: false,
        name: "Core temp μ±2σ",
        yaxis: "y5",
        type: "scatter",
      } as unknown as Data);
    }

    if (visible("stream_sim_temp") && coreTemp.length) {
      traces.push({
        ...toTrace(coreTemp),
        type: "scattergl",
        mode: "lines",
        name: "Core temp",
        yaxis: "y5",
        line: { color: STREAM_COLORS.stream_sim_temp, width: 1.6 },
        hovertemplate: "Core %{y:.2f} °C<br>%{x|%b %d %H:%M}<extra></extra>",
      } as unknown as Data);
    }

    const spo2Ribbon = buildRibbon(
      baselines.stream_sim_spo2,
      timeWindow.startMs,
      timeWindow.endMs,
    );
    if (visible("stream_sim_spo2") && spo2Ribbon) {
      traces.push({
        x: spo2Ribbon.x,
        y: spo2Ribbon.y,
        fill: "toself",
        fillcolor: hexToRgba(STREAM_COLORS.stream_sim_spo2, 0.06),
        line: { color: "transparent" },
        hoverinfo: "skip",
        showlegend: false,
        name: "SpO₂ μ±2σ",
        yaxis: "y6",
        type: "scatter",
      } as unknown as Data);
    }

    if (visible("stream_sim_spo2") && spo2.length) {
      traces.push({
        ...toTrace(spo2),
        type: "scattergl",
        mode: "lines",
        name: "SpO₂",
        yaxis: "y6",
        line: { color: STREAM_COLORS.stream_sim_spo2, width: 1.4 },
        hovertemplate: "SpO₂ %{y:.1f}%<br>%{x|%b %d %H:%M}<extra></extra>",
      } as unknown as Data);
    }

    if (visible("stream_eda_co2") && co2.length) {
      const z = zScores(co2, baselines.stream_eda_co2);
      traces.push({
        ...z,
        type: "scattergl",
        mode: "lines",
        name: "Z CO₂",
        yaxis: "y7",
        line: { color: STREAM_COLORS.stream_eda_co2, width: 1.2 },
        hovertemplate: "Z(CO₂) %{y:+.2f}<br>%{x|%b %d %H:%M}<extra></extra>",
      } as unknown as Data);
    }
    if (visible("stream_sim_hr") && heartRate.length) {
      const z = zScores(heartRate, baselines.stream_sim_hr);
      traces.push({
        ...z,
        type: "scattergl",
        mode: "lines",
        name: "Z HR",
        yaxis: "y7",
        line: { color: STREAM_COLORS.stream_sim_hr, width: 1.2 },
        hovertemplate: "Z(HR) %{y:+.2f}<br>%{x|%b %d %H:%M}<extra></extra>",
      } as unknown as Data);
    }
    if (visible("stream_sim_hrv") && rmssd.length) {
      const z = zScores(rmssd, baselines.stream_sim_hrv);
      traces.push({
        ...z,
        type: "scattergl",
        mode: "lines",
        name: "Z RMSSD",
        yaxis: "y7",
        line: { color: STREAM_COLORS.stream_sim_hrv, width: 1.2, dash: "dot" },
        hovertemplate: "Z(RMSSD) %{y:+.2f}<br>%{x|%b %d %H:%M}<extra></extra>",
      } as unknown as Data);
    }

    if (symptoms.length) {
      traces.push({
        x: symptoms.map((symptom) => symptom.occurred_at),
        y: symptoms.map(() => 3.25),
        text: symptoms.map(
          (symptom) =>
            `${symptom.symptom_code.replace(/_/g, " ")} · severity ${symptom.severity}`,
        ),
        type: "scatter",
        mode: "markers",
        name: "Crew symptom",
        yaxis: "y7",
        marker: {
          color: "#d97706",
          size: 8,
          symbol: "diamond",
          line: { width: 1.5, color: "#ffffff" },
        },
        hoverinfo: "text",
      } as unknown as Data);
    }

    shapes.push({
      type: "line",
      xref: "paper",
      x0: 0,
      x1: 1,
      yref: "y7",
      y0: 0,
      y1: 0,
      line: { color: "rgba(2, 132, 199, 0.25)", width: 1, dash: "dot" },
    });

    for (const event of events) {
      const theme = severityTheme(event.severity_level);
      shapes.push({
        type: "rect",
        xref: "x",
        yref: "paper",
        x0: event.start_time,
        x1: event.end_time,
        y0: 0,
        y1: 0.225,
        fillcolor: hexToRgba(theme.hex, event.severity_level === "INFO" ? 0.1 : 0.18),
        line: { width: 1, color: hexToRgba(theme.hex, 0.45) },
        layer: "below",
      });
    }

    shapes.push(...gapShapes(co2));

    const monoFont = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

    const layout = {
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#f8fafc",
      font: {
        color: "#334155",
        family: monoFont,
        size: 11,
      },
      margin: { l: 60, r: 60, t: 36, b: 36 },
      showlegend: true,
      legend: {
        orientation: "h",
        x: 0,
        y: 1.055,
        xanchor: "left",
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
        font: { size: 11, color: "#0f172a", family: monoFont },
      },
      xaxis: {
        domain: [0, 1],
        anchor: "y",
        type: "date",
        range: zoomRange ?? undefined,
        rangeslider: { visible: false },
        gridcolor: "#e2e8f0",
        zeroline: false,
        tickfont: { size: 11, color: "#64748b" },
        showspikes: true,
        spikemode: "across",
        spikesnap: "cursor",
        spikecolor: "#0284c7",
        spikethickness: 1,
        spikedash: "dot",
      },
      yaxis: {
        domain: [0.79, 1],
        anchor: "x",
        title: {
          text: "CO₂ mmHg",
          font: { size: 11, color: "#0284c7" },
          standoff: 4,
        },
        gridcolor: "#e2e8f0",
        zeroline: false,
        tickfont: { size: 11, color: "#64748b" },
      },
      yaxis2: {
        domain: [0.79, 1],
        anchor: "x",
        overlaying: "y",
        side: "right",
        showgrid: false,
        title: {
          text: "°C",
          font: { size: 11, color: "#ea580c" },
          standoff: 4,
        },
        tickfont: { size: 11, color: "#64748b" },
      },
      yaxis3: {
        domain: [0.535, 0.735],
        anchor: "x",
        title: {
          text: "HR bpm",
          font: { size: 11, color: "#0891b2" },
          standoff: 4,
        },
        gridcolor: "#e2e8f0",
        zeroline: false,
        tickfont: { size: 11, color: "#64748b" },
      },
      yaxis4: {
        domain: [0.535, 0.735],
        anchor: "x",
        overlaying: "y3",
        side: "right",
        showgrid: false,
        title: {
          text: "RMSSD ms",
          font: { size: 11, color: "#059669" },
          standoff: 4,
        },
        tickfont: { size: 11, color: "#64748b" },
      },
      yaxis5: {
        domain: [0.28, 0.48],
        anchor: "x",
        title: {
          text: "°C",
          font: { size: 11, color: "#d97706" },
          standoff: 4,
        },
        gridcolor: "#e2e8f0",
        zeroline: false,
        tickfont: { size: 11, color: "#64748b" },
      },
      yaxis6: {
        domain: [0.28, 0.48],
        anchor: "x",
        overlaying: "y5",
        side: "right",
        showgrid: false,
        title: {
          text: "SpO₂ %",
          font: { size: 11, color: "#0284c7" },
          standoff: 4,
        },
        tickfont: { size: 11, color: "#64748b" },
      },
      yaxis7: {
        domain: [0.0, 0.225],
        anchor: "x",
        title: {
          text: "Z-score",
          font: { size: 11, color: "#334155" },
          standoff: 4,
        },
        gridcolor: "#e2e8f0",
        zeroline: false,
        range: [-4.5, 4.5],
        tickfont: { size: 11, color: "#64748b" },
      },
      annotations: LANE_LABELS.map((label) => ({
        text: label.text,
        xref: "paper",
        yref: "paper",
        x: 0,
        y: label.y,
        xanchor: "left",
        yanchor: "bottom",
        showarrow: false,
        font: { size: 11, color: label.color, family: monoFont },
      })),
      shapes,
      uirevision: astronautId,
    };

    return { traces, layout: layout as unknown as Partial<Layout> };
  }, [
    measurements,
    baselines,
    symptoms,
    events,
    visible,
    timeWindow,
    astronautId,
    zoomRange,
  ]);

  const config = useMemo(
    () =>
      ({
        responsive: true,
        displaylogo: false,
        scrollZoom: true,
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
      } else if (event["xaxis.autorange"] === true) {
        setZoomRange(null);
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
    )} → ${formatDateTime(new Date(timeWindow.endMs).toISOString())}`;
  }, [measurements.length, timeWindow]);

  const hasTelemetry = measurements.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Mission Timeline
          </h2>
          <p className="mt-1 text-xs text-muted font-mono">{windowLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleDecimation}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors select-none ${
              decimationEnabled
                ? "border-sky-200 bg-sky-50 text-sky-700"
                : "border-border bg-white text-muted hover:text-secondary"
            }`}
            title="Largest-Triangle-Three-Buckets downsampling (1,000 points per lane)"
          >
            <Waves className="h-3.5 w-3.5" />
            LTTB {decimationEnabled ? "1000" : "OFF"}
          </button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setReloadToken((token) => token + 1)}
            leftIcon={<Activity className={`h-3.5 w-3.5 text-sky-600 ${isLoading ? "animate-pulse" : ""}`} />}
          >
            {isLoading ? "Loading" : "Refresh"}
          </Button>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border glass-panel px-2.5 py-1 text-xs text-muted">
            <Layers className="h-3.5 w-3.5 text-sky-600" />
            {events.length} events · {symptoms.length} symptoms
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {TELEMETRY_STREAMS.map((streamId) => {
          const active = selectedStreams.includes(streamId);
          return (
            <button
              key={streamId}
              type="button"
              onClick={() => toggleStream(streamId)}
              className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors select-none ${
                active
                  ? "border-border-strong bg-white text-foreground shadow-sm"
                  : "border-border bg-surface-subtle text-muted hover:text-secondary hover:bg-white"
              }`}
            >
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-full"
                style={{
                  backgroundColor: active ? STREAM_COLORS[streamId] : "#94a3b8",
                }}
              />
              {prettyStream(streamId)}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <div
        className={`transition-[width] duration-300 ease-out ${
          isDrawerOpen ? "w-full lg:w-[calc(100%-500px)]" : "w-full"
        }`}
      >
        <div className="rounded-xl glass-panel relative h-[calc(100vh-260px)] min-h-[640px] overflow-hidden p-2">
          {!hasTelemetry && !isLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-lg border border-border bg-surface-subtle text-sky-600">
                <Activity className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  No telemetry in this window
                </h3>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">
                  Provision the Expedition 71 mission dataset or submit symptom reports to
                  populate the synchronized lanes.
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

      <div className="rounded-xl glass-panel flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["INVESTIGATE", "OBSERVE", "INFO"] as const).map((severity) => {
            const theme = severityTheme(severity);
            return (
              <span
                key={severity}
                className={`badge border ${theme.border} ${theme.text} ${theme.background}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} />
                {theme.label} ribbon
              </span>
            );
          })}
          <Badge variant="warning">
            ◆ Crew symptom
          </Badge>
        </div>
        <p className="text-xs text-muted">
          Shared x-axis · synchronized crosshair · stepped μ±2σ envelopes
        </p>
      </div>

      {events.length ? (
        <div className="rounded-xl glass-panel p-4">
          <p className="field-label">Concordance ribbons on lane 4</p>
          <p className="mt-0.5 text-xs text-muted">
            Select a ribbon to open the evidence drawer
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {events.slice(0, 8).map((event) => {
              const theme = severityTheme(event.severity_level);
              return (
                <button
                  key={event.event_id}
                  type="button"
                  onClick={() => void openForEvent(event)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors hover:bg-surface-subtle ${theme.border} ${theme.text} ${theme.background}`}
                  title={parseStreamIds(event.contributing_stream_ids)
                    .map(prettyStream)
                    .join(" · ")}
                >
                  {theme.label} · {titleCase(event.event_type)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
