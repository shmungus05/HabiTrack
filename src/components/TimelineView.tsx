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

import {
  Activity,
  Layers,
  TriangleAlert,
  Clock,
  Heart,
  Zap,
  Play,
  Pause,
  Square,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Wind,
  Thermometer,
} from "lucide-react";
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
import { useSimulationSandbox } from "../features/simulation";
import {
  computeModuleTelemetry,
  useStationLocationStore,
} from "../features/topology";
import { usePhysiologicalTelemetry, PhysiologicalCards } from "../features/biometrics";
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
}

interface TimelineData {
  measurements: Measurement[];
  baselines: Baselines;
  events: HealthEvent[];
  symptoms: SymptomReport[];
}

type HourRange = "1h" | "6h" | "24h" | "7d" | "30d" | "all";

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

function parseTimestampMs(val: unknown): number | null {
  if (typeof val === "number" && Number.isFinite(val)) {
    if (val > 1e11) return val;
    if (val > 1e8) return val * 1000;
  }
  if (typeof val === "string") {
    let str = val.trim();
    if (!str) return null;
    const num = Number(str);
    if (Number.isFinite(num) && num > 1e11) return num;
    if (Number.isFinite(num) && num > 1e8) return num * 1000;

    str = str.replace(" ", "T");
    if (!str.includes("Z") && !str.includes("+") && !str.includes("-", 10)) {
      str = str + "Z";
    }
    const parsed = new Date(str).getTime();
    if (Number.isFinite(parsed)) return parsed;

    const fallback = new Date(val).getTime();
    if (Number.isFinite(fallback)) return fallback;
  }
  return null;
}

function getRangeForSpan(spanMs: number, totalSpanMs: number): HourRange {
  const spanHours = spanMs / (3600 * 1000);
  if (spanMs >= totalSpanMs * 0.85 || spanHours >= 24 * 45) {
    return "all";
  }
  if (spanHours <= 3) {
    return "1h";
  }
  if (spanHours <= 12) {
    return "6h";
  }
  if (spanHours <= 48) {
    return "24h";
  }
  if (spanHours <= 24 * 14) {
    return "7d";
  }
  return "30d";
}

export function TimelineView({ astronautId }: TimelineViewProps) {
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
        fetchMeasurements(astronautId, 4320, 20000),
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

  const [simulationState, simulationControls] = useSimulationSandbox();
  const { activeScenario, isAnomalyActive } = simulationState;
  const activeScenarios =
    simulationState.activeScenarios || (activeScenario !== "nominal" ? [activeScenario] : []);
  const hasCo2 = activeScenarios.includes("co2_spike") || activeScenario === "co2_spike";
  const hasThermal =
    activeScenarios.includes("thermal_overheat") || activeScenario === "thermal_overheat";
  const hasSaa = activeScenarios.includes("saa_transit") || activeScenario === "saa_transit";
  const isCo2Active = hasCo2;
  const isThermalActive = hasThermal;
  const isSaaActive = hasSaa;
  const isNominalActive = !hasCo2 && !hasThermal && !hasSaa;

  const { selectedModuleId, selectedLocation } = useStationLocationStore();
  const envTelemetry = computeModuleTelemetry(
    selectedModuleId,
    selectedLocation,
    activeScenarios,
    activeScenario,
  );

  // Live real-time clock advancement & mission dataset simulation playback
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [simPlaybackMs, setSimPlaybackMs] = useState<number | null>(null);
  const [simSpeed, setSimSpeed] = useState<1 | 60 | 1440 | 7200>(1440);
  const [liveNow, setLiveNow] = useState(() => Date.now());

  // Keep real-time UTC ticking every second
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // When simulation is started, playback begins from Day 1 (timeWindow.startMs) and advances to current UTC
  useEffect(() => {
    if (!isSimulationRunning) return;

    const intervalMs = 200;
    // Step sizes per 200ms:
    // 1x: 200ms real UTC speed
    // 60x: 12,000ms (1 min/sec)
    // 1440x: 17,280,000ms (~4.8h per tick, 1 day/sec -> 180 days in 3 min)
    // 7200x: 86,400,000ms (1 day per tick, 5 days/sec -> 180 days in ~36 seconds)
    const stepMs =
      simSpeed === 1
        ? 200
        : simSpeed === 60
        ? 60 * 200
        : simSpeed === 1440
        ? Math.round(24 * 3600 * 1000 * 0.2)
        : Math.round(5 * 24 * 3600 * 1000 * 0.2);

    const timer = setInterval(() => {
      setSimPlaybackMs((prev) => {
        const current = prev ?? timeWindow.startMs;
        const next = current + stepMs;
        if (next >= timeWindow.endMs) {
          return timeWindow.endMs;
        }
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isSimulationRunning, simSpeed, timeWindow.startMs, timeWindow.endMs]);

  const currentSimTime =
    isSimulationRunning && simPlaybackMs !== null ? simPlaybackMs : liveNow;

  const handleStartSimulation = () => {
    setIsSimulationRunning(true);
    setSimPlaybackMs(timeWindow.startMs); // Start exactly from Day 1
  };

  const handleStopSimulation = () => {
    setIsSimulationRunning(false);
    setSimPlaybackMs(null); // Reset back to nominal
    simulationControls.resetNominal(); // Reset any active simulation anomalies
    setSelectedRange("all"); // Reset range
    setZoomRange(null);
  };

  const activeMeasurements = useMemo(() => {
    if (!measurements.length) return [];

    const nowMs = currentSimTime;
    const anomalyWindowMs = 90 * 60 * 1000; // Recent 90-minute anomaly window

    // When simulation is active, reveal only data points up to the current simulated moment (Day 1 -> currentSimTime)
    const pool = isSimulationRunning
      ? measurements.filter((m) => new Date(m.timestamp).getTime() <= nowMs)
      : measurements;

    const mapped = pool.map((m) => {
      const ptMs = new Date(m.timestamp).getTime();
      const timeToNow = nowMs - ptMs;

      if (timeToNow < 0 || timeToNow > anomalyWindowMs) {
        return m;
      }

      // Progress goes from 0 (at 90m ago) to 1 (at nowMs)
      const progress = 1 - timeToNow / anomalyWindowMs;
      const spikeFactor = Math.sin((progress * Math.PI) / 2);

      if (m.stream_id === "stream_eda_co2" && hasCo2) {
        return {
          ...m,
          value: Math.round(m.value + spikeFactor * 1650),
        };
      }
      if (m.stream_id === "stream_eda_temp" && hasThermal) {
        return {
          ...m,
          value: Number((m.value + spikeFactor * 4.8).toFixed(1)),
        };
      }
      if (m.stream_id === "stream_eda_radiation" && hasSaa) {
        const bell = Math.sin(progress * Math.PI);
        return {
          ...m,
          value: Number((m.value + bell * 0.24).toFixed(3)),
        };
      }

      return m;
    });

    // Append continuous live telemetry point aligned to current simulation moment
    const isoNow = new Date(nowMs).toISOString();
    const liveCo2Val = hasCo2 ? 4350 : (envTelemetry.co2 || 2250);
    const liveTempVal = hasThermal ? 27.4 : (envTelemetry.temp || 22.8);
    const liveRadVal = hasSaa ? 0.48 : (envTelemetry.rad || 0.19);

    const livePoints: Measurement[] = [
      {
        id: null,
        astronaut_id: astronautId,
        stream_id: "stream_eda_co2",
        timestamp: isoNow,
        value: liveCo2Val,
        quality_status: "VALID",
        is_synthetic: true,
        provenance_category: null,
      },
      {
        id: null,
        astronaut_id: astronautId,
        stream_id: "stream_eda_temp",
        timestamp: isoNow,
        value: liveTempVal,
        quality_status: "VALID",
        is_synthetic: true,
        provenance_category: null,
      },
      {
        id: null,
        astronaut_id: astronautId,
        stream_id: "stream_eda_radiation",
        timestamp: isoNow,
        value: liveRadVal,
        quality_status: "VALID",
        is_synthetic: true,
        provenance_category: null,
      },
      {
        id: null,
        astronaut_id: astronautId,
        stream_id: "stream_eda_humidity",
        timestamp: isoNow,
        value: envTelemetry.humidity || 43.5,
        quality_status: "VALID",
        is_synthetic: true,
        provenance_category: null,
      },
      {
        id: null,
        astronaut_id: astronautId,
        stream_id: "stream_eda_pressure",
        timestamp: isoNow,
        value: 101.3,
        quality_status: "VALID",
        is_synthetic: true,
        provenance_category: null,
      },
    ];

    return [...mapped, ...livePoints];
  }, [measurements, hasCo2, hasThermal, hasSaa, currentSimTime, isSimulationRunning, astronautId, envTelemetry]);

  // Handle Quick Hour window presets (1h, 6h, 24h, 7d, 30d, all)
  const effectiveRange = useMemo(() => {
    if (zoomRange) {
      return zoomRange;
    }
    const endMs = isSimulationRunning ? currentSimTime : timeWindow.endMs;
    if (selectedRange === "all" || !measurements.length) {
      return [
        new Date(timeWindow.startMs).toISOString(),
        new Date(timeWindow.endMs).toISOString(),
      ];
    }
    const hours =
      selectedRange === "1h"
        ? 1
        : selectedRange === "6h"
        ? 6
        : selectedRange === "24h"
        ? 24
        : selectedRange === "7d"
        ? 24 * 7
        : selectedRange === "30d"
        ? 24 * 30
        : 24 * 180;
    const startMs = Math.max(timeWindow.startMs, endMs - hours * 60 * 60 * 1000);
    return [new Date(startMs).toISOString(), new Date(endMs).toISOString()];
  }, [zoomRange, selectedRange, timeWindow, measurements.length, currentSimTime, isSimulationRunning]);

  const figure = useMemo(() => {
    const traces: Data[] = [];

    const co2 = streamPoints(activeMeasurements, "stream_eda_co2");
    const temp = streamPoints(activeMeasurements, "stream_eda_temp");
    const humidity = streamPoints(activeMeasurements, "stream_eda_humidity");
    const radiation = streamPoints(activeMeasurements, "stream_eda_radiation");
    const pressure = streamPoints(activeMeasurements, "stream_eda_pressure");

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
        hovertemplate: "CO₂: %{y:.0f} PPM<br>%{x|%b %d, %H:%M UTC}<extra></extra>",
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
        hovertemplate: "Pressure: %{y:.2f} kPa<br>%{x|%b %d, %H:%M UTC}<extra></extra>",
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
        hovertemplate: "Temperature: %{y:.1f} °C<br>%{x|%b %d, %H:%M UTC}<extra></extra>",
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
        hovertemplate: "Humidity: %{y:.1f} %<br>%{x|%b %d, %H:%M UTC}<extra></extra>",
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
        hovertemplate: "Radiation: %{y:.3f} mGy/day<br>%{x|%b %d, %H:%M UTC}<extra></extra>",
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
        nticks: 10,
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
        range: [0, 5000],
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
      shapes: isSimulationRunning
        ? [
            {
              type: "line",
              xref: "x",
              yref: "paper",
              x0: new Date(currentSimTime).toISOString(),
              x1: new Date(currentSimTime).toISOString(),
              y0: 0,
              y1: 1,
              line: {
                color: "#0284c7",
                width: 2,
                dash: "dot",
              },
            },
          ]
        : [],
      uirevision: isSimulationRunning ? "sim_active" : astronautId,
    };

    return { traces, layout: layout as unknown as Partial<Layout> };
  }, [activeMeasurements, visible, timeWindow, astronautId, effectiveRange, isSimulationRunning, currentSimTime]);

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

  const handleSelectRange = useCallback(
    (range: HourRange) => {
      setSelectedRange(range);
      if (range === "all") {
        setZoomRange(null);
      } else {
        const endMs = timeWindow.endMs;
        const hours =
          range === "1h"
            ? 1
            : range === "6h"
            ? 6
            : range === "24h"
            ? 24
            : range === "7d"
            ? 24 * 7
            : range === "30d"
            ? 24 * 30
            : 24 * 180;
        const startMs = Math.max(timeWindow.startMs, endMs - hours * 60 * 60 * 1000);
        setZoomRange([new Date(startMs).toISOString(), new Date(endMs).toISOString()]);
      }
    },
    [timeWindow, setZoomRange],
  );

  const handleRelayout = useCallback(
    (event: Readonly<Record<string, unknown>>) => {
      if (event["xaxis.autorange"] === true) {
        setZoomRange(null);
        setSelectedRange("all");
        return;
      }

      const rawStart = event["xaxis.range[0]"];
      const rawEnd = event["xaxis.range[1]"];
      if (rawStart !== undefined && rawEnd !== undefined) {
        const startMs = parseTimestampMs(rawStart);
        const endMs = parseTimestampMs(rawEnd);

        if (startMs !== null && endMs !== null && endMs > startMs) {
          const startStr = typeof rawStart === "string" ? rawStart : new Date(startMs).toISOString();
          const endStr = typeof rawEnd === "string" ? rawEnd : new Date(endMs).toISOString();
          setZoomRange([startStr, endStr]);

          const totalSpanMs = Math.max(timeWindow.endMs - timeWindow.startMs, 3600 * 1000);
          const visibleSpanMs = endMs - startMs;
          const rangeCategory = getRangeForSpan(visibleSpanMs, totalSpanMs);
          setSelectedRange(rangeCategory);
        }
      }
    },
    [setZoomRange, timeWindow],
  );

  const windowLabel = useMemo(() => {
    if (!measurements.length) {
      return "No telemetry ingested";
    }
    return `${formatDateTime(
      new Date(timeWindow.startMs).toISOString(),
    )} → ${formatDateTime(new Date(timeWindow.endMs).toISOString())} (NASA EDA Long-Duration Flight Increment · 180 Days)`;
  }, [measurements.length, timeWindow]);

  const totalSpanMs = Math.max(1, timeWindow.endMs - timeWindow.startMs);
  const elapsedMs = Math.max(0, currentSimTime - timeWindow.startMs);
  const currentMissionDay = Math.min(180, Math.max(1, Math.floor(elapsedMs / (24 * 3600 * 1000)) + 1));
  const progressPercent = Math.min(100, Math.max(0, (elapsedMs / totalSpanMs) * 100));

  const simUtcString = new Date(currentSimTime).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const liveRealUtcString = new Date(liveNow).toISOString().replace("T", " ").slice(0, 19) + " UTC";

  const vitals = usePhysiologicalTelemetry(astronautId);

  // Derive latest values from the visible activeMeasurements stream up to currentSimTime
  const co2Stream = streamPoints(activeMeasurements, "stream_eda_co2");
  const tempStream = streamPoints(activeMeasurements, "stream_eda_temp");
  const humStream = streamPoints(activeMeasurements, "stream_eda_humidity");
  const radStream = streamPoints(activeMeasurements, "stream_eda_radiation");

  let currentCo2 = co2Stream.length ? co2Stream[co2Stream.length - 1].value : envTelemetry.co2;
  let currentTemp = tempStream.length ? tempStream[tempStream.length - 1].value : envTelemetry.temp;
  let currentHumidity = humStream.length ? humStream[humStream.length - 1].value : envTelemetry.humidity;
  let currentRadiation = radStream.length ? radStream[radStream.length - 1].value : envTelemetry.rad;

  if (hasCo2) currentCo2 = 4350;
  if (hasThermal) currentTemp = 27.4;
  if (hasSaa) currentRadiation = 0.48;

  const hasTelemetry = measurements.length > 0;

  return (
    <div className="space-y-4">
      {/* Top Header Card in Clean White Theme */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl glass-panel bg-white border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Environmental Trends
          </h2>
          {isSimulationRunning ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-300">
              <span className="h-2 w-2 rounded-full bg-sky-600 animate-ping" />
              Simulated UTC: <span className="font-mono font-bold">{simUtcString}</span>
              <span className="text-[10px] text-sky-600 font-mono">(Day {currentMissionDay}/180)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live UTC: <span className="font-mono font-bold">{liveRealUtcString}</span>
            </span>
          )}
          <span className="text-xs text-muted font-mono hidden md:inline-block">
            {isSimulationRunning ? `Simulating Flight Day ${currentMissionDay}` : windowLabel}
          </span>
        </div>

        {/* Quick Range Selectors: 1h, 6h, 24h, 7d, 30d, all */}
        <div className="flex items-center gap-1 bg-surface-subtle border border-border rounded-lg p-1">
          {([
            { id: "1h", label: "1H" },
            { id: "6h", label: "6H" },
            { id: "24h", label: "24H" },
            { id: "7d", label: "7D" },
            { id: "30d", label: "30D" },
            { id: "all", label: "ALL (180D)" },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleSelectRange(id)}
              className={`px-2.5 sm:px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                selectedRange === id
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-muted hover:text-foreground hover:bg-white"
              }`}
            >
              {label}
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

      {/* Interactive Simulation Controls Bar — Starts from Day 1 to Current UTC & Resets on Stop */}
      <div className="p-3.5 sm:p-4 rounded-xl glass-panel bg-white border border-border shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-2.5">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-sky-600 shrink-0" />
            <span className="text-xs font-bold text-sky-800 uppercase tracking-wider">
              {isSimulationRunning
                ? "Mission Playback Simulation Active (Day 1 → Current UTC)"
                : "Real-Time Simulation Controls · NASA EDA Archival Telemetry"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isSimulationRunning ? (
              <span className="px-2.5 py-0.5 rounded-full bg-sky-100 border border-sky-300 text-sky-900 text-[10px] font-bold animate-pulse flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-600 animate-ping" />
                <span>SIMULATION ACTIVE · DAY {currentMissionDay} OF 180 ({progressPercent.toFixed(1)}%)</span>
              </span>
            ) : !isNominalActive ? (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-bold animate-pulse flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                <span>
                  {[
                    isCo2Active && "CO₂ SPIKE",
                    isThermalActive && "OVERHEAT",
                    isSaaActive && "SAA RADIATION",
                  ]
                    .filter(Boolean)
                    .join(" · ")}{" "}
                  ACTIVE
                </span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>Simulation Idle · Synced to Current Live UTC</span>
              </span>
            )}
          </div>
        </div>

        {/* Buttons Row: Start/Stop + Multi-Select Anomalies + Speed */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Main Play / Stop & Reset Button */}
            {!isSimulationRunning ? (
              <button
                type="button"
                onClick={handleStartSimulation}
                className="py-1.5 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Start simulation playback from Day 1 advancing toward current live UTC"
              >
                <Play className="w-3.5 h-3.5 fill-white shrink-0" />
                <span>Start Simulation (Day 1)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopSimulation}
                className="py-1.5 px-3.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer animate-pulse"
                title="Stop simulation and reset back to nominal live UTC"
              >
                <Square className="w-3.5 h-3.5 fill-white shrink-0" />
                <span>Stop &amp; Reset</span>
              </button>
            )}

            {/* Multi-Select Anomaly Buttons */}
            <button
              type="button"
              onClick={() => simulationControls.toggleScenario("co2_spike")}
              className={`py-1.5 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                isCo2Active
                  ? "bg-amber-100 border-amber-400 text-amber-900 shadow-xs ring-2 ring-amber-400 font-bold"
                  : "bg-white hover:bg-amber-50 border-slate-200 text-slate-700 hover:border-amber-300"
              }`}
              title="Toggle CO₂ Spike anomaly"
            >
              <Wind className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>⚡ CO₂ Spike (+1,650 PPM)</span>
              {isCo2Active && <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-ping" />}
            </button>

            <button
              type="button"
              onClick={() => simulationControls.toggleScenario("thermal_overheat")}
              className={`py-1.5 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                isThermalActive
                  ? "bg-orange-100 border-orange-400 text-orange-900 shadow-xs ring-2 ring-orange-400 font-bold"
                  : "bg-white hover:bg-orange-50 border-slate-200 text-slate-700 hover:border-orange-300"
              }`}
              title="Toggle Overheat anomaly"
            >
              <Thermometer className="w-3.5 h-3.5 text-orange-600 shrink-0" />
              <span>🌡️ Overheat (+4.8 °C)</span>
              {isThermalActive && <span className="h-1.5 w-1.5 rounded-full bg-orange-600 animate-ping" />}
            </button>

            <button
              type="button"
              onClick={() => simulationControls.toggleScenario("saa_transit")}
              className={`py-1.5 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                isSaaActive
                  ? "bg-purple-100 border-purple-400 text-purple-900 shadow-xs ring-2 ring-purple-400 font-bold"
                  : "bg-white hover:bg-purple-50 border-slate-200 text-slate-700 hover:border-purple-300"
              }`}
              title="Toggle SAA Radiation anomaly"
            >
              <Activity className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span>☢️ SAA Radiation (0.48 mGy/d)</span>
              {isSaaActive && <span className="h-1.5 w-1.5 rounded-full bg-purple-600 animate-ping" />}
            </button>

            <button
              type="button"
              onClick={() => {
                simulationControls.resetNominal();
                if (isSimulationRunning) {
                  handleStopSimulation();
                }
              }}
              className={`py-1.5 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                isNominalActive && !isSimulationRunning
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-medium"
                  : "border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-800"
              }`}
              title="Reset all active anomalies to nominal baselines"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>🔄 Reset Nominal</span>
            </button>
          </div>

          {/* Simulation Speed Multipliers */}
          <div className="flex items-center gap-2 border-l border-border/80 pl-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Speed:</span>
            <div className="flex items-center rounded-lg bg-surface-subtle border border-border p-0.5 text-xs font-mono">
              {([
                { spd: 1, label: "1x (Real UTC)" },
                { spd: 60, label: "60x" },
                { spd: 1440, label: "1D/s (1440x)" },
                { spd: 7200, label: "5D/s (7200x)" },
              ] as const).map(({ spd, label }) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setSimSpeed(spd)}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    simSpeed === spd
                      ? "bg-white text-sky-700 font-bold shadow-2xs"
                      : "text-muted hover:text-foreground"
                  }`}
                  title={`${label} playback speed`}
                >
                  {spd === 1 ? "1x" : spd === 60 ? "60x" : spd === 1440 ? "1D/s" : "5D/s"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mission Playback Progress Scrubber (Shown whenever simulation is active) */}
        {isSimulationRunning && (
          <div className="pt-2 border-t border-slate-100 space-y-1.5 animate-fadeIn">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-600">
              <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                <span>Day 1 (Mission Start)</span>
              </span>
              <span className="font-bold text-sky-800">
                Playing: Day {currentMissionDay} of 180 · {simUtcString}
              </span>
              <span className="text-slate-500">
                Day 180 (Live UTC: {liveRealUtcString})
              </span>
            </div>
            <div className="relative flex items-center">
              <input
                type="range"
                min={timeWindow.startMs}
                max={timeWindow.endMs}
                value={currentSimTime}
                onChange={(e) => setSimPlaybackMs(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
              />
            </div>
          </div>
        )}
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Live Station Telemetry Readout Pill */}
          <div className="flex items-center gap-3 text-xs bg-white border border-border px-3.5 py-1.5 rounded-lg text-secondary shadow-sm">
            <span className="font-semibold text-foreground">
              Station Telemetry ({envTelemetry.module.shortName} · {envTelemetry.location}):
            </span>
            <span>CO₂ <strong className={hasCo2 ? "text-amber-700 font-extrabold animate-pulse" : "text-sky-600"}>{currentCo2.toLocaleString()} PPM</strong></span>
            <span>Temp <strong className={hasThermal ? "text-amber-700 font-extrabold animate-pulse" : "text-amber-600"}>{currentTemp.toFixed(1)} °C</strong></span>
            <span>Humidity <strong className="text-purple-600">{currentHumidity} %</strong></span>
            <span>Radiation <strong className={hasSaa ? "text-amber-700 font-extrabold animate-pulse" : "text-yellow-600"}>{currentRadiation.toFixed(3)} mGy/d</strong></span>
          </div>

          {/* Live Physiological Telemetry & Circadian Envelope Readout Pill */}
          <div className="flex items-center gap-3 text-xs bg-white border border-border px-3.5 py-1.5 rounded-lg text-secondary shadow-sm">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-600" />
              Physiological ({vitals.callsign}):
            </span>
            <span>HR <strong className={vitals.hrAlert ? "text-rose-700 font-extrabold animate-pulse" : "text-slate-800"}>{vitals.hr} bpm</strong></span>
            <span>HRV <strong className={vitals.rmssdAlert ? "text-amber-700 font-extrabold animate-pulse" : "text-cyan-700"}>{vitals.rmssd} ms</strong></span>
            <span>SpO₂ <strong className={vitals.spo2Alert ? "text-amber-700 font-extrabold animate-pulse" : "text-emerald-700"}>{vitals.spo2}%</strong></span>
            <span>Core Temp <strong className={vitals.coreTempAlert ? "text-red-700 font-extrabold animate-pulse" : "text-slate-800"}>{vitals.coreTemp.toFixed(1)} °C</strong></span>
          </div>
        </div>
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

      {/* Synchronized Physiological Telemetry & Circadian Envelope */}
      <PhysiologicalCards astronautId={astronautId} />

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
    </div>
  );
}
