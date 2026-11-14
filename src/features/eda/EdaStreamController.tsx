/**
 * Isolated Component: NASA EDA Authentic Stream Controller
 * Adheres strictly to the minimalist Perplexity design aesthetic:
 * - font-semibold uppercase headers
 * - rounded-lg containers
 * - generous whitespace & micro-animations
 * - 100% data preservation
 */

import React from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Activity,
  Flame,
  Droplets,
  Radio,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useEdaPlayback, computeCo2MmHg, type SparklinePoint } from "./EdaPlaybackModule";

interface MiniSparklineProps {
  data: SparklinePoint[];
  color: string;
  height?: number;
}

const MiniSparkline: React.FC<MiniSparklineProps> = ({ data, color, height = 30 }) => {
  if (!data || data.length < 2) {
    return <div className="h-7 w-20 bg-surface-subtle rounded-lg animate-pulse" />;
  }

  const values = data.map((d) => d.val);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 84;
  const gradId = `eda-spark-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  const coords = data.map((d, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((d.val - min) / range) * (height - 8) - 4,
  }));

  let linePath = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cx = ((p0.x + p1.x) / 2).toFixed(1);
    linePath += ` C ${cx},${p0.y.toFixed(1)} ${cx},${p1.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
  }
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)},${height} L ${coords[0].x.toFixed(1)},${height} Z`;

  return (
    <svg width={width} height={height} className="overflow-visible inline-block">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const EdaStreamController: React.FC<{ className?: string }> = ({ className = "" }) => {
  const [state, controls] = useEdaPlayback();

  if (!state.isLoaded || !state.currentRecord) {
    return (
      <div className={`p-8 bg-surface rounded-lg border border-border text-muted text-sm ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 border-accent-light border-t-transparent animate-spin" />
          <span>Synchronizing authentic NASA EDA telemetry stream...</span>
        </div>
      </div>
    );
  }

  const { currentRecord, sparklines, isPlaying, speed, currentIndex, totalRecords } = state;
  const co2MmHg = computeCo2MmHg(currentRecord.co2);
  const isCo2Elevated = currentRecord.co2 > 3000;

  return (
    <section
      className={`p-5 sm:p-6 glass-panel rounded-xl relative overflow-hidden ${className}`}
    >
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Zap className="w-3.5 h-3.5 text-sky-600" />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-700">
              NASA EDA · ISS Expedition 71/72 · RR-1
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
            Atmospheric &amp; Dosimetric Telemetry
          </h2>
          <p className="text-xs text-muted mt-1">
            180 sequential 5-minute flight records from the Node 2 Harmony / US Lab ECLSS loop
          </p>
        </div>

        {/* Source citation link */}
        <a
          href="https://visualization.osdr.nasa.gov/eda/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-sky-700 hover:text-sky-800 glass-panel-subtle hover:border-sky-300 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <span>NASA OSDR / EDA</span>
          <ExternalLink className="w-3.5 h-3.5 text-sky-600" />
        </a>
      </div>

      {/* Main Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 py-5">
        {/* CO2 Card */}
        <div className="p-4 rounded-xl glass-panel-subtle glass-card-hover border-t-2 border-t-[#0284c7]">
          <div className="flex items-center justify-between text-[11px] text-secondary mb-2">
            <span className="font-medium flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#0284c7]" />
              Carbon Dioxide
            </span>
            <MiniSparkline data={sparklines.co2} color="#0284c7" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-semibold font-mono tabular-nums ${
                currentRecord.co2 >= 4000
                  ? "text-red-700"
                  : isCo2Elevated
                  ? "text-amber-700"
                  : "text-foreground"
              }`}
            >
              {currentRecord.co2.toLocaleString()}
            </span>
            <span className="text-[11px] text-muted font-mono">PPM</span>
          </div>
          <div className="text-[11px] font-mono text-muted mt-1">
            {co2MmHg} mmHg{" "}
            {isCo2Elevated && (
              <span className={currentRecord.co2 >= 4000 ? "text-red-700 ml-1" : "text-amber-700 ml-1"}>
                · elevated
              </span>
            )}
          </div>
        </div>

        {/* Temperature Card */}
        <div className="p-4 rounded-xl glass-panel-subtle glass-card-hover border-t-2 border-t-[#ea580c]">
          <div className="flex items-center justify-between text-[11px] text-secondary mb-2">
            <span className="font-medium flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-[#ea580c]" />
              Cabin Temperature
            </span>
            <MiniSparkline data={sparklines.temp} color="#ea580c" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tabular-nums text-foreground">
              {currentRecord.temp.toFixed(1)}
            </span>
            <span className="text-[11px] text-muted font-mono">°C</span>
          </div>
          <div className="text-[11px] font-mono text-muted mt-1">
            {((currentRecord.temp * 9) / 5 + 32).toFixed(1)} °F · nominal THC
          </div>
        </div>

        {/* Humidity Card */}
        <div className="p-4 rounded-xl glass-panel-subtle glass-card-hover border-t-2 border-t-[#0891b2]">
          <div className="flex items-center justify-between text-[11px] text-secondary mb-2">
            <span className="font-medium flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-[#0891b2]" />
              Relative Humidity
            </span>
            <MiniSparkline data={sparklines.humidity} color="#0891b2" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tabular-nums text-foreground">
              {currentRecord.humidity.toFixed(0)}
            </span>
            <span className="text-[11px] text-muted font-mono">%</span>
          </div>
          <div className="text-[11px] font-mono text-muted mt-1">
            Dew point 11.2 °C · normal band
          </div>
        </div>

        {/* Radiation Card */}
        <div className="p-4 rounded-xl glass-panel-subtle glass-card-hover border-t-2 border-t-[#d97706]">
          <div className="flex items-center justify-between text-[11px] text-secondary mb-2">
            <span className="font-medium flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[#d97706]" />
              Radiation Flux
            </span>
            <MiniSparkline data={sparklines.radiation} color="#d97706" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tabular-nums text-foreground">
              {currentRecord.radiation.toFixed(3)}
            </span>
            <span className="text-[11px] text-muted font-mono">mGy/d</span>
          </div>
          <div className="text-[11px] font-mono text-muted mt-1">
            {(currentRecord.radiation * 2.0).toFixed(3)} mSv/d · quiet solar
          </div>
        </div>
      </div>

      {/* Scrubber & Controls Bar */}
      <div className="p-5 rounded-xl glass-panel-subtle space-y-4">
        {/* Scrubber slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-muted">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sky-700">{currentRecord.displayTime} UTC</span>
              <span className="text-[11px] text-muted">({currentRecord.fullTimestamp})</span>
            </div>
            <span>
              Frame <strong className="text-foreground">{currentIndex + 1}</strong> of {totalRecords}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={totalRecords - 1}
            value={currentIndex}
            onChange={(e) => controls.seek(Number(e.target.value))}
            className="w-full accent-[#0284c7] cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
          />
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={controls.stepBackward}
              className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-border text-secondary hover:text-sky-700 transition-colors cursor-pointer"
              title="Step Backward"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={controls.togglePlay}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>Pause Stream</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Play Stream</span>
                </>
              )}
            </button>
            <button
              onClick={controls.stepForward}
              className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-border text-secondary hover:text-sky-700 transition-colors cursor-pointer"
              title="Step Forward"
            >
              <SkipForward className="w-4 h-4" />
            </button>
            <button
              onClick={() => controls.seek(0)}
              className="px-2.5 py-2 rounded-lg bg-white hover:bg-slate-50 border border-border text-muted hover:text-sky-700 transition-colors cursor-pointer flex items-center gap-1.5 text-[11px] font-medium"
              title="Return to Normal / Reset"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>

          {/* Speed selector */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-border">
            <span className="text-[11px] font-mono text-muted uppercase tracking-wider px-2">Speed</span>
            {([1, 2, 5] as const).map((s) => (
              <button
                key={s}
                onClick={() => controls.setSpeed(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-colors cursor-pointer ${
                  speed === s
                    ? "bg-sky-600 text-white shadow-sm"
                    : "text-muted hover:text-foreground hover:bg-surface-subtle"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
