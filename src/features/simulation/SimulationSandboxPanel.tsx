/**
 * Isolated Component: Simulation Sandbox & Anomaly Injector Panel
 * Perplexity minimalist styling:
 * - font-semibold uppercase headers
 * - rounded-lg containers
 * - generous whitespace & micro-animations
 * - 100% preservation of test triggers & threshold sliders
 */

import React from "react";
import {
  RotateCcw,
  Sliders,
  Sparkles,
  Zap,
  Radio,
  Flame,
  ShieldAlert,
  CheckCircle2,
  User,
} from "lucide-react";
import { useSimulationSandbox, type AnomalyScenarioType } from "./SimulationSandboxModule";

interface SimulationSandboxPanelProps {
  onScenarioChange?: (scenario: AnomalyScenarioType) => void;
  className?: string;
}

export const SimulationSandboxPanel: React.FC<SimulationSandboxPanelProps> = ({
  onScenarioChange,
  className = "",
}) => {
  const [state, controls] = useSimulationSandbox();
  const { activeScenario, thresholds, profileOverrides, isAnomalyActive } = state;

  const handleInject = (sc: AnomalyScenarioType) => {
    controls.injectScenario(sc);
    onScenarioChange?.(sc);
  };

  const handleReset = () => {
    controls.resetNominal();
    onScenarioChange?.("nominal");
  };

  return (
    <section
      className={`p-5 sm:p-6 glass-panel rounded-xl relative overflow-hidden ${className}`}
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-3.5 h-3.5 text-sky-600" />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-700">
              Flight Surgeon Training Deck
            </span>
            <span className="text-[11px] font-mono text-muted">
              · Non-Destructive Simulation Overlay
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
            Simulation Sandbox &amp; Anomaly Injector
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Test detection pipelines, flight rule alert latches, and clinical assistant decision logic
          </p>
        </div>

        {isAnomalyActive && (
          <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-mono text-amber-800 flex items-center gap-2 self-start sm:self-auto">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Active Injection: {activeScenario.toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* 1-Click Anomaly Injection Buttons */}
      <div className="pt-6 space-y-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-700">
          1-Click Live Test Scenarios:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => handleInject("co2_spike")}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer glass-card-hover ${
              activeScenario === "co2_spike"
                ? "bg-sky-50 border-sky-300 border-l-2 border-l-sky-600 text-foreground"
                : "glass-panel-subtle text-secondary hover:text-foreground"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-[#0284c7]">CO₂ Pocket Anomaly</span>
              <Zap className="w-4 h-4 text-[#0284c7]" />
            </div>
            <p className="text-[11px] text-muted">
              Spike carbon dioxide &gt; 3,850 PPM in Node 2 to trigger Flight Rule B13-101.B.
            </p>
          </button>

          <button
            onClick={() => handleInject("saa_transit")}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer glass-card-hover ${
              activeScenario === "saa_transit"
                ? "bg-amber-50 border-amber-300 border-l-2 border-l-amber-600 text-foreground"
                : "glass-panel-subtle text-secondary hover:text-foreground"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-[#d97706]">SAA Radiation Crossing</span>
              <Radio className="w-4 h-4 text-[#d97706]" />
            </div>
            <p className="text-[11px] text-muted">
              Elevate TEPC dosimeter flux to 0.38 mGy/day during South Atlantic pass.
            </p>
          </button>

          <button
            onClick={() => handleInject("thermal_overheat")}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer glass-card-hover ${
              activeScenario === "thermal_overheat"
                ? "bg-orange-50 border-orange-300 border-l-2 border-l-orange-600 text-foreground"
                : "glass-panel-subtle text-secondary hover:text-foreground"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-[#ea580c]">Exercise Heat Surge</span>
              <Flame className="w-4 h-4 text-[#ea580c]" />
            </div>
            <p className="text-[11px] text-muted">
              Surge module temp to 27.2 °C during daily 2.5h CEVIS/T2 exercise.
            </p>
          </button>

          <button
            onClick={handleReset}
            className="p-4 rounded-xl glass-panel-subtle glass-card-hover hover:border-emerald-300 hover:bg-emerald-50 text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-emerald-700">Restore Nominal</span>
              <RotateCcw className="w-4 h-4 text-emerald-600 group-hover:-rotate-90 transition-transform" />
            </div>
            <p className="text-[11px] text-muted">
              Clear all simulated anomalies and restore verified orbital baselines.
            </p>
          </button>
        </div>
      </div>

      {/* Threshold Configuration Sliders */}
      <div className="mt-6 p-5 rounded-xl glass-panel-subtle space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-sky-700">
            <Sliders className="w-4 h-4 text-sky-600" />
            <span>Flight Safety Advisory Threshold Sliders</span>
          </div>
          <span className="text-[11px] font-mono text-muted">Live Calibration Bounds</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* CO2 Threshold */}
          <div className="p-4 rounded-xl bg-white border border-border space-y-2.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-secondary font-medium">CO₂ Advisory Trigger (Flight Rule B13-101.B)</span>
              <span className="text-[#0284c7] font-semibold">{thresholds.co2WarningPpm} PPM</span>
            </div>
            <input
              type="range"
              min={2500}
              max={4500}
              step={50}
              value={thresholds.co2WarningPpm}
              onChange={(e) => controls.updateThresholds({ co2WarningPpm: Number(e.target.value) })}
              className="w-full accent-[#0284c7] cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
            />
            <div className="flex justify-between text-[11px] font-mono text-muted">
              <span>2,500 PPM (Baseline)</span>
              <span>4,500 PPM (Critical)</span>
            </div>
          </div>

          {/* Radiation Threshold */}
          <div className="p-4 rounded-xl bg-white border border-border space-y-2.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-secondary font-medium">Radiation Rate Alert (SRAG ALARA)</span>
              <span className="text-[#d97706] font-semibold">{thresholds.radAlertRate.toFixed(2)} mGy/d</span>
            </div>
            <input
              type="range"
              min={0.15}
              max={0.50}
              step={0.01}
              value={thresholds.radAlertRate}
              onChange={(e) => controls.updateThresholds({ radAlertRate: Number(e.target.value) })}
              className="w-full accent-[#0284c7] cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
            />
            <div className="flex justify-between text-[11px] font-mono text-muted">
              <span>0.15 mGy/d (Quiet)</span>
              <span>0.50 mGy/d (Severe Belt)</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
