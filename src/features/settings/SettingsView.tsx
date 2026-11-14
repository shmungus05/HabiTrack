/**
 * Isolated Component: Settings & Astronaut Profile Simulation
 * Perplexity minimalist styling:
 * - font-semibold uppercase headers
 * - rounded-lg containers
 * - generous whitespace & micro-animations
 * - 100% preservation of friend's fields, +/- controls, sliders, and buttons
 */

import React, { useState } from "react";
import {
  Settings,
  User,
  Sliders,
  Radio,
  CheckCircle2,
  Save,
  Trash2,
  Sparkles,
  Minus,
  Plus,
  RotateCcw,
  Zap,
  Activity,
  Wind,
  Thermometer,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import { useBiomedicalSettings } from "./SettingsModule";
import { useSimulationSandbox } from "../simulation";

interface SettingsViewProps {
  onTriggerScenario?: (scenario: string) => void;
  className?: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onTriggerScenario,
  className = "",
}) => {
  const {
    profile,
    settings,
    saveSuccess,
    updateProfile,
    updateSettings,
    adjustHeartRate,
    adjustSpO2,
  } = useBiomedicalSettings();

  const [simulationState, simulationControls] = useSimulationSandbox();
  const { activeScenario, isAnomalyActive, thresholds } = simulationState;

  const [formName, setFormName] = useState(profile.name);
  const [formRole, setFormRole] = useState(profile.role);
  const [scenarioNotice, setScenarioNotice] = useState<string | null>(null);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      name: formName,
      role: formRole,
    });
  };

  const notifyScenario = (name: string) => {
    setScenarioNotice(name);
    onTriggerScenario?.(name);
    setTimeout(() => setScenarioNotice(null), 3500);
  };

  const handleInjectScenario = (
    scenario: "co2_spike" | "thermal_overheat" | "saa_transit" | "nominal"
  ) => {
    if (scenario === "nominal") {
      simulationControls.resetNominal();
      notifyScenario("All systems restored to nominal baselines.");
    } else {
      simulationControls.injectScenario(scenario);
      const title =
        scenario === "co2_spike"
          ? "CO₂ Pocket Spike (>3,800 PPM / 5.8 mmHg)"
          : scenario === "thermal_overheat"
          ? "Thermal Loop Excursion (27.4 °C)"
          : "SAA Orbital Radiation Transit";
      notifyScenario(`Injected ${title}. Overview & Alerts reacting in real time!`);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Banner */}
      <div className="p-5 sm:p-6 glass-panel rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-3.5 h-3.5 text-sky-600" />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-700">
              Flight Deck Platform Configuration
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
            Astronaut Profile &amp; Biomedical Baseline Simulation
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Crew biomedical thresholds, telemetry synchronization feeds, and simulation injectors
          </p>
        </div>

        {saveSuccess && (
          <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-medium text-emerald-700 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Profile Saved to Flight Deck!</span>
          </div>
        )}

        {scenarioNotice && (
          <div className="px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-[11px] font-medium text-sky-700 flex items-center gap-2 animate-fadeIn">
            <Zap className="w-4 h-4 text-sky-600" />
            <span>Scenario Triggered: {scenarioNotice}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Astronaut Profile Card */}
        <div className="p-5 sm:p-6 glass-panel rounded-xl flex flex-col justify-between space-y-6">
          <div className="text-center space-y-3">
            <div className="w-24 h-24 mx-auto rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center">
              <User className="w-12 h-12 text-sky-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground tracking-tight">{profile.name}</h3>
              <p className="text-xs text-sky-700 font-medium">{profile.role}</p>
              <p className="text-[11px] font-mono text-muted mt-0.5">
                {profile.mission} · Day {profile.daysInSpace}
              </p>
            </div>
            {/* Radiation Dose Bar */}
            <div className="pt-2 text-left space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-muted">Career Dose (ALARA):</span>
                <span className="text-amber-700 font-semibold">
                  {profile.careerRadiationDoseMsv} / {profile.careerLimitMsv} mSv
                </span>
              </div>
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  style={{ width: `${(profile.careerRadiationDoseMsv / profile.careerLimitMsv) * 100}%` }}
                  className="h-full bg-gradient-to-r from-sky-500 via-cyan-500 to-amber-500 rounded-full transition-all"
                />
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div>
              <label className="block text-secondary font-semibold mb-1.5">Astronaut Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-border text-foreground text-xs focus:outline-none focus:border-sky-600"
              />
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1.5">Flight Role / Specialty</label>
              <input
                type="text"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-border text-foreground text-xs focus:outline-none focus:border-sky-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-secondary font-semibold mb-1.5">Baseline HR (bpm)</label>
                <div className="flex items-center rounded-lg bg-white border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => adjustHeartRate(-1)}
                    className="p-2 text-sky-700 border-r border-border hover:bg-sky-50 hover:text-sky-800 transition-colors cursor-pointer select-none"
                    title="Decrease Heart Rate"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    value={profile.baselineHeartRate}
                    readOnly
                    className="w-full text-center bg-transparent text-foreground text-xs font-mono py-1.5"
                  />
                  <button
                    type="button"
                    onClick={() => adjustHeartRate(1)}
                    className="p-2 text-sky-700 border-l border-border hover:bg-sky-50 hover:text-sky-800 transition-colors cursor-pointer select-none"
                    title="Increase Heart Rate"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-secondary font-semibold mb-1.5">Resting SpO₂ (%)</label>
                <div className="flex items-center rounded-lg bg-white border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => adjustSpO2(-1)}
                    className="p-2 text-sky-700 border-r border-border hover:bg-sky-50 hover:text-sky-800 transition-colors cursor-pointer select-none"
                    title="Decrease SpO₂"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    value={profile.restingSpO2}
                    readOnly
                    className="w-full text-center bg-transparent text-foreground text-xs font-mono py-1.5"
                  />
                  <button
                    type="button"
                    onClick={() => adjustSpO2(1)}
                    className="p-2 text-sky-700 border-l border-border hover:bg-sky-50 hover:text-sky-800 transition-colors cursor-pointer select-none"
                    title="Increase SpO₂"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-xs font-semibold text-white flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer mt-2"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Update Crew Baseline</span>
            </button>
          </form>
        </div>

        {/* Right 2 Columns: Threshold Configuration & System Options */}
        <div className="lg:col-span-2 space-y-6">
          {/* Thresholds Card */}
          <div className="p-5 sm:p-6 glass-panel rounded-xl space-y-4">
            <h3 className="text-xs font-semibold text-sky-700 uppercase tracking-[0.14em] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-600" />
              <span>Environmental Alarm Thresholds (NASA Flight Safety)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl glass-panel-subtle space-y-2.5">
                <div className="flex justify-between font-mono">
                  <span className="font-semibold text-foreground">CO₂ Advisory Threshold</span>
                  <span className="font-semibold text-[#0284c7]">{settings.thresholds.co2WarningPpm} PPM</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings({
                        thresholds: {
                          ...settings.thresholds,
                          co2WarningPpm: Math.max(2500, settings.thresholds.co2WarningPpm - 50),
                        },
                      })
                    }
                    className="p-1.5 rounded-md bg-white border border-border text-sky-700 hover:bg-sky-50 hover:text-sky-800 transition-colors cursor-pointer"
                    title="Decrease CO₂ threshold by 50 PPM"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="range"
                    min="2500"
                    max="4500"
                    step="50"
                    value={settings.thresholds.co2WarningPpm}
                    onChange={(e) =>
                      updateSettings({
                        thresholds: { ...settings.thresholds, co2WarningPpm: Number(e.target.value) },
                      })
                    }
                    className="flex-1 accent-[#0284c7] cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings({
                        thresholds: {
                          ...settings.thresholds,
                          co2WarningPpm: Math.min(4500, settings.thresholds.co2WarningPpm + 50),
                        },
                      })
                    }
                    className="p-1.5 rounded-md bg-white border border-border text-sky-700 hover:bg-sky-50 hover:text-sky-800 transition-colors cursor-pointer"
                    title="Increase CO₂ threshold by 50 PPM"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-[11px] text-muted block">Flight Rule B13-101.B trigger</span>
              </div>

              <div className="p-4 rounded-xl glass-panel-subtle space-y-2.5">
                <div className="flex justify-between font-mono">
                  <span className="font-semibold text-foreground">Radiation Rate Alert</span>
                  <span className="font-semibold text-[#d97706]">{settings.thresholds.radAlertRate} mGy/d</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings({
                        thresholds: {
                          ...settings.thresholds,
                          radAlertRate: Math.max(
                            0.15,
                            Number((settings.thresholds.radAlertRate - 0.01).toFixed(2)),
                          ),
                        },
                      })
                    }
                    className="p-1.5 rounded-md bg-white border border-border text-sky-700 hover:bg-sky-50 hover:text-sky-800 transition-colors cursor-pointer"
                    title="Decrease radiation threshold by 0.01 mGy/d"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="range"
                    min="0.15"
                    max="0.50"
                    step="0.01"
                    value={settings.thresholds.radAlertRate}
                    onChange={(e) =>
                      updateSettings({
                        thresholds: { ...settings.thresholds, radAlertRate: Number(e.target.value) },
                      })
                    }
                    className="flex-1 accent-[#0284c7] cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings({
                        thresholds: {
                          ...settings.thresholds,
                          radAlertRate: Math.min(
                            0.5,
                            Number((settings.thresholds.radAlertRate + 0.01).toFixed(2)),
                          ),
                        },
                      })
                    }
                    className="p-1.5 rounded-md bg-white border border-border text-sky-700 hover:bg-sky-50 hover:text-sky-800 transition-colors cursor-pointer"
                    title="Increase radiation threshold by 0.01 mGy/d"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-[11px] text-muted block">SRAG ALARA advisory trigger</span>
              </div>
            </div>
          </div>

          {/* Unit Preferences & Feeds */}
          <div className="p-5 sm:p-6 glass-panel rounded-xl space-y-4">
            <h3 className="text-xs font-semibold text-sky-700 uppercase tracking-[0.14em] flex items-center gap-2">
              <Radio className="w-4 h-4 text-sky-600" />
              <span>Unit Systems &amp; Telemetry Feeds</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-secondary font-semibold mb-2">Unit System</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => updateSettings({ unitSystem: "metric" })}
                    className={`py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      settings.unitSystem === "metric"
                        ? "bg-sky-50 border-sky-300 text-sky-700"
                        : "border-border text-muted hover:text-foreground glass-panel-subtle"
                    }`}
                  >
                    Metric (°C, PPM, kPa)
                  </button>
                  <button
                    onClick={() => updateSettings({ unitSystem: "us" })}
                    className={`py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      settings.unitSystem === "us"
                        ? "bg-sky-50 border-sky-300 text-sky-700"
                        : "border-border text-muted hover:text-foreground glass-panel-subtle"
                    }`}
                  >
                    US Customary (°F, mmHg)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-secondary font-semibold mb-2">Telemetry Feed Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => updateSettings({ telemetrySource: "simulation" })}
                    className={`py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      settings.telemetrySource === "simulation"
                        ? "bg-sky-50 border-sky-300 text-sky-700"
                        : "border-border text-muted hover:text-foreground glass-panel-subtle"
                    }`}
                  >
                    Active Simulation
                  </button>
                  <button
                    onClick={() => updateSettings({ telemetrySource: "nasa-eda" })}
                    className={`py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      settings.telemetrySource === "nasa-eda"
                        ? "bg-sky-50 border-sky-300 text-sky-700"
                        : "border-border text-muted hover:text-foreground glass-panel-subtle"
                    }`}
                  >
                    NASA EDA Feed
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Real-Time Testing & Navigation Indicators */}
          <div className="p-5 sm:p-6 glass-panel rounded-xl space-y-5 border border-sky-200/80 bg-white shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3.5">
              <div>
                <h3 className="text-xs font-bold text-sky-700 uppercase tracking-[0.14em] flex items-center gap-2">
                  <Zap className="w-4 h-4 text-sky-600" />
                  <span>Interactive Real-Time Testing &amp; Navigation Indicators</span>
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Direct telemetry anomaly injectors. Injections propagate immediately to Overview, Alerts, and Timeline.
                </p>
              </div>

              {isAnomalyActive && (
                <span className="px-2.5 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[11px] font-bold animate-pulse flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Live Override: {activeScenario.replace(/_/g, " ").toUpperCase()}</span>
                </span>
              )}
            </div>

            {/* Live Synchronized Telemetry Status Ribbon */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Live Cabin CO₂</span>
                <span className={`font-mono font-bold text-sm ${activeScenario === "co2_spike" ? "text-amber-700" : "text-slate-900"}`}>
                  {activeScenario === "co2_spike" ? "5.80 mmHg (4,350 PPM)" : "3.00 mmHg (2,250 PPM)"}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Heart Rate</span>
                <span className={`font-mono font-bold text-sm ${activeScenario === "co2_spike" ? "text-rose-600" : "text-slate-900"}`}>
                  {activeScenario === "co2_spike" ? "92 bpm (+27 bpm)" : `${profile.baselineHeartRate} bpm (Nominal)`}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Cabin Temp</span>
                <span className={`font-mono font-bold text-sm ${activeScenario === "thermal_overheat" ? "text-orange-600" : "text-slate-900"}`}>
                  {activeScenario === "thermal_overheat" ? "27.4 °C (Excursion)" : "22.8 °C (Nominal)"}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Radiation Flux</span>
                <span className={`font-mono font-bold text-sm ${activeScenario === "saa_transit" ? "text-purple-600" : "text-slate-900"}`}>
                  {activeScenario === "saa_transit" ? "0.48 mGy/d (SAA)" : "0.19 mGy/d (Quiet)"}
                </span>
              </div>
            </div>

            {/* Test Trigger Injector Buttons */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                Click to Inject Test Anomalies (Real-Time Propagation)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleInjectScenario("co2_spike")}
                  className={`px-3.5 py-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all flex items-center justify-between ${
                    activeScenario === "co2_spike"
                      ? "bg-amber-100 border-amber-400 text-amber-900 shadow-xs ring-2 ring-amber-300"
                      : "bg-white hover:bg-amber-50 border-slate-200 text-slate-700 hover:border-amber-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Wind className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>⚡ Inject CO₂ Spike (&gt;3,800 PPM)</span>
                  </div>
                  {activeScenario === "co2_spike" && (
                    <span className="text-[10px] bg-amber-200 px-1.5 py-0.5 rounded font-mono font-bold">ACTIVE</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleInjectScenario("thermal_overheat")}
                  className={`px-3.5 py-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all flex items-center justify-between ${
                    activeScenario === "thermal_overheat"
                      ? "bg-orange-100 border-orange-400 text-orange-900 shadow-xs ring-2 ring-orange-300"
                      : "bg-white hover:bg-orange-50 border-slate-200 text-slate-700 hover:border-orange-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-orange-600 shrink-0" />
                    <span>🌡️ Inject Thermal Excursion (27.4 °C)</span>
                  </div>
                  {activeScenario === "thermal_overheat" && (
                    <span className="text-[10px] bg-orange-200 px-1.5 py-0.5 rounded font-mono font-bold">ACTIVE</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleInjectScenario("saa_transit")}
                  className={`px-3.5 py-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all flex items-center justify-between ${
                    activeScenario === "saa_transit"
                      ? "bg-purple-100 border-purple-400 text-purple-900 shadow-xs ring-2 ring-purple-300"
                      : "bg-white hover:bg-purple-50 border-slate-200 text-slate-700 hover:border-purple-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>☢️ Simulate SAA Radiation Transit</span>
                  </div>
                  {activeScenario === "saa_transit" && (
                    <span className="text-[10px] bg-purple-200 px-1.5 py-0.5 rounded font-mono font-bold">ACTIVE</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleInjectScenario("nominal")}
                  className="px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 text-xs font-semibold cursor-pointer transition-all flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>🔄 Reset to Nominal Baselines</span>
                </button>
              </div>
            </div>

            {/* Data Management Actions */}
            <div className="pt-3 border-t border-border flex flex-wrap items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => notifyScenario("Cleared Symptoms")}
                className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Stored Symptoms</span>
              </button>

              <button
                type="button"
                onClick={() => notifyScenario("Loaded NASA Sample Case Study")}
                className="px-3 py-1.5 rounded-lg glass-panel-subtle hover:border-sky-300 hover:bg-sky-50 text-secondary hover:text-sky-700 font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                <span>Load NASA Case Study</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
