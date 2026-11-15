/**
 * Isolated Component: Settings & Astronaut Profile Simulation
 *
 * Impeccable Production-Ready UI/UX:
 * - High-end, minimalist Perplexity design aesthetic
 * - Font-black display headings, rounded-[32px] primary containers, and soft shadow-2xs depth
 * - Distilled, uncluttered single-stage category switcher (zero feature loss)
 * - 100% preservation of all fields, controls, callbacks, and simulation injectors
 */

import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  HardDrive,
  Key,
  Layers,
  Loader2,
  Minus,
  Plus,
  Power,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  ShieldAlert,
  Sliders,
  Sparkles,
  Thermometer,
  Trash2,
  User,
  Volume2,
  Wind,
  Zap,
} from "lucide-react";
import { useAssistantStore } from "../../stores/assistantStore";
import { getAvailableVoices, type VoicePersona } from "../../lib/speech";
import {
  getSargalayApiKey,
  getSargalayModelLabel,
  testSargalayApiKey,
} from "../../services/ai/sargalayClient";
import {
  checkOllamaStatus,
  loadOllamaModel,
  type OllamaStatusResult,
} from "../../services/ai/ollamaClient";
import { useBiomedicalSettings } from "./SettingsModule";
import { useSimulationSandbox } from "../simulation";

interface SettingsViewProps {
  onTriggerScenario?: (scenario: string) => void;
  className?: string;
}

type SettingsCategory =
  | "profile"
  | "telemetry"
  | "intelligence"
  | "comms"
  | "simulation"
  | "all";

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

  const {
    autoSpeakEnabled,
    toggleAutoSpeak,
    quindarBeepsEnabled,
    setQuindarBeepsEnabled,
    voiceRate,
    setVoiceRate,
    voicePersona,
    setVoicePersona,
    selectedVoiceName,
    setSelectedVoiceName,
    voicePitch,
    setVoicePitch,
    speakMessage,
    isSpeaking,
    openVoiceModal,
    aiModelMode,
    setAiModelMode,
    localModelStatus,
    localModelProgress,
    localModelStatusText,
    localModelError,
    loadLocalModel,
    unloadLocalModel,
  } = useAssistantStore();

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("profile");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatusResult | null>(null);
  const [isCheckingOllama, setIsCheckingOllama] = useState(false);

  const refreshOllama = async () => {
    setIsCheckingOllama(true);
    const res = await checkOllamaStatus();
    setOllamaStatus(res);
    setIsCheckingOllama(false);
  };

  useEffect(() => {
    if (activeCategory === "intelligence" || activeCategory === "all") {
      refreshOllama();
    }
  }, [activeCategory]);

  useEffect(() => {
    const updateVoices = () => {
      setAvailableVoices(getAvailableVoices());
    };
    updateVoices();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const [simulationState, simulationControls] = useSimulationSandbox();
  const { activeScenario, thresholds } = simulationState;
  const activeScenarios =
    simulationState.activeScenarios || (activeScenario !== "nominal" ? [activeScenario] : []);

  const isCo2Active = activeScenarios.includes("co2_spike") || activeScenario === "co2_spike";
  const isThermalActive =
    activeScenarios.includes("thermal_overheat") || activeScenario === "thermal_overheat";
  const isSaaActive =
    activeScenarios.includes("saa_transit") || activeScenario === "saa_transit";
  const isNominalActive = !isCo2Active && !isThermalActive && !isSaaActive;

  const isMetric = settings.unitSystem === "metric";
  const displayCo2 = isMetric
    ? isCo2Active
      ? "4,350 PPM"
      : "2,250 PPM"
    : isCo2Active
    ? "5.80 mmHg"
    : "3.00 mmHg";
  const displayTemp = isMetric
    ? isThermalActive
      ? "27.4 °C"
      : "22.8 °C"
    : isThermalActive
    ? "81.3 °F"
    : "73.0 °F";
  const displayRad = isSaaActive ? "0.48 mGy/d" : "0.19 mGy/d";

  let displayHr = `${profile.baselineHeartRate} bpm`;
  if (isCo2Active) {
    displayHr = "92 bpm (+27)";
  } else if (isThermalActive) {
    displayHr = "80 bpm (+15)";
  }

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

  const handleToggleScenario = (
    scenario: "co2_spike" | "thermal_overheat" | "saa_transit",
  ) => {
    simulationControls.toggleScenario(scenario);
    const currentlyActive =
      scenario === "co2_spike"
        ? isCo2Active
        : scenario === "thermal_overheat"
        ? isThermalActive
        : isSaaActive;
    const title =
      scenario === "co2_spike"
        ? isMetric
          ? "CO₂ Pocket Spike (4,350 PPM)"
          : "CO₂ Pocket Spike (5.80 mmHg)"
        : scenario === "thermal_overheat"
        ? isMetric
          ? "Thermal Loop Excursion (27.4 °C)"
          : "Thermal Loop Excursion (81.3 °F)"
        : "SAA Orbital Radiation Transit (0.48 mGy/d)";

    if (currentlyActive) {
      notifyScenario(`Deactivated ${title}.`);
    } else {
      notifyScenario(`Injected ${title}. Propagated across Overview, Alerts & Timeline!`);
    }
  };

  const handleResetNominal = () => {
    simulationControls.resetNominal();
    notifyScenario("All systems restored to nominal baselines.");
  };

  const showSection = (cat: SettingsCategory) =>
    activeCategory === "all" || activeCategory === cat;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 1. Distilled Master Header & Segmented Controller */}
      <header className="rounded-[32px] border border-slate-200/90 bg-white p-6 sm:p-7 shadow-2xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-sky-50 text-sky-700 border border-sky-200/70">
                <Settings className="w-3.5 h-3.5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Platform Settings
              </h1>
            </div>
            <p className="text-xs text-slate-500">
              Personalized astronaut baselines, mission telemetry conventions, SI intelligence, and flight simulation.
            </p>
          </div>

          {/* Quick Context & Status Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {saveSuccess && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 animate-fadeIn">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Saved</span>
              </span>
            )}

            {scenarioNotice && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-xs font-semibold text-sky-800 animate-fadeIn">
                <Zap className="w-3.5 h-3.5 text-sky-600" />
                <span className="max-w-[200px] truncate">{scenarioNotice}</span>
              </span>
            )}
          </div>
        </div>

        {/* Ergonomic Category Controller */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between overflow-x-auto">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100/90 border border-slate-200/80">
            {[
              { id: "profile", label: "Crew Profile", icon: User },
              { id: "telemetry", label: "Telemetry & Limits", icon: Sliders },
              { id: "intelligence", label: "SI Engine", icon: Cpu },
              { id: "comms", label: "Audio & Comms", icon: Volume2 },
              { id: "simulation", label: "Simulation Sandbox", icon: Zap },
              { id: "all", label: "All Settings", icon: Layers },
            ].map((tab) => {
              const isActive = activeCategory === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id as SettingsCategory)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer select-none whitespace-nowrap ${
                    isActive
                      ? "bg-white text-slate-900 border border-slate-200/90 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? "text-sky-600" : "text-slate-400"
                    }`}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* 2. Crew Profile & Physiological Baselines */}
      {showSection("profile") && (
        <section className="rounded-[32px] border border-slate-200/90 bg-white p-6 sm:p-7 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-sky-50 text-sky-700 border border-sky-200/70">
                <User className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Astronaut Profile &amp; Physiological Baselines
                </h2>
                <p className="text-xs text-slate-500">
                  Crew identity, ALARA radiation exposure limit, and resting autonomic vitals.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: Compact Identity & ALARA bar */}
            <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-center shrink-0">
                  <User className="w-7 h-7 text-sky-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate">{profile.name}</h3>
                  <p className="text-xs text-sky-700 font-medium truncate">{profile.role}</p>
                  <p className="text-[11px] font-mono text-slate-500">
                    {profile.mission} · Day {profile.daysInSpace}
                  </p>
                </div>
              </div>

              {/* ALARA Progress Bar */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-600 font-medium">Career Radiation (ALARA)</span>
                  <span className="text-amber-700 font-bold">
                    {((profile.careerRadiationDoseMsv / profile.careerLimitMsv) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden p-0.5">
                  <div
                    style={{
                      width: `${(profile.careerRadiationDoseMsv / profile.careerLimitMsv) * 100}%`,
                    }}
                    className="h-full bg-gradient-to-r from-sky-500 via-cyan-500 to-amber-500 rounded-full transition-all duration-300"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block">
                  SRAG cumulative career safety threshold
                </span>
              </div>
            </div>

            {/* Right: Form & Ergonomic Steppers */}
            <form onSubmit={handleSaveProfile} className="lg:col-span-8 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Astronaut Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., CDR M. Vance"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-xs focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Flight Role / Specialty
                  </label>
                  <input
                    type="text"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    placeholder="e.g., Commander / Flight Medical Officer"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-xs focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Stepper Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                {/* Heart Rate Stepper */}
                <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/40 flex items-center justify-between gap-3">
                  <div>
                    <span className="block font-semibold text-slate-800">Baseline Heart Rate</span>
                    <span className="text-[10px] text-slate-400">Circadian resting target</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => adjustHeartRate(-1)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-sky-700 hover:bg-sky-50 hover:border-sky-300 transition-colors flex items-center justify-center cursor-pointer shadow-2xs select-none"
                      title="Decrease Heart Rate"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-16 text-center font-mono font-bold text-xs text-sky-800 bg-white border border-slate-200 py-1 rounded-lg shadow-2xs">
                      {profile.baselineHeartRate} bpm
                    </span>
                    <button
                      type="button"
                      onClick={() => adjustHeartRate(1)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-sky-700 hover:bg-sky-50 hover:border-sky-300 transition-colors flex items-center justify-center cursor-pointer shadow-2xs select-none"
                      title="Increase Heart Rate"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* SpO2 Stepper */}
                <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/40 flex items-center justify-between gap-3">
                  <div>
                    <span className="block font-semibold text-slate-800">Resting SpO₂ Target</span>
                    <span className="text-[10px] text-slate-400">Normoxic saturation baseline</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => adjustSpO2(-1)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-sky-700 hover:bg-sky-50 hover:border-sky-300 transition-colors flex items-center justify-center cursor-pointer shadow-2xs select-none"
                      title="Decrease SpO₂"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-16 text-center font-mono font-bold text-xs text-sky-800 bg-white border border-slate-200 py-1 rounded-lg shadow-2xs">
                      {profile.restingSpO2}%
                    </span>
                    <button
                      type="button"
                      onClick={() => adjustSpO2(1)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-sky-700 hover:bg-sky-50 hover:border-sky-300 transition-colors flex items-center justify-center cursor-pointer shadow-2xs select-none"
                      title="Increase SpO₂"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-xs font-bold text-white flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Update Crew Baseline</span>
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* 3. Telemetry Units & Safety Limits */}
      {showSection("telemetry") && (
        <section className="rounded-[32px] border border-slate-200/90 bg-white p-6 sm:p-7 shadow-2xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-sky-50 text-sky-700 border border-sky-200/70">
              <Sliders className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Telemetry Units &amp; Environmental Safety Limits
              </h2>
              <p className="text-xs text-slate-500">
                Display conventions and NASA flight rule advisory threshold trip points.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Preferences */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700">Display Unit System</label>
                  <span className="text-[10px] text-slate-400">Atmosphere, temp, and pressure</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateSettings({ unitSystem: "metric" })}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      settings.unitSystem === "metric"
                        ? "bg-white border-sky-400 text-sky-800 shadow-2xs font-bold"
                        : "border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white/80"
                    }`}
                  >
                    Metric (°C, PPM, kPa)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ unitSystem: "us" })}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      settings.unitSystem === "us"
                        ? "bg-white border-sky-400 text-sky-800 shadow-2xs font-bold"
                        : "border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white/80"
                    }`}
                  >
                    US Customary (°F, mmHg)
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/60">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700">Telemetry Stream Source</label>
                  <span className="text-[10px] text-slate-400">Real-time simulation vs NASA archives</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateSettings({ telemetrySource: "simulation" })}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      settings.telemetrySource === "simulation"
                        ? "bg-white border-sky-400 text-sky-800 shadow-2xs font-bold"
                        : "border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white/80"
                    }`}
                  >
                    Active Simulation
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ telemetrySource: "nasa-eda" })}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      settings.telemetrySource === "nasa-eda"
                        ? "bg-white border-sky-400 text-sky-800 shadow-2xs font-bold"
                        : "border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white/80"
                    }`}
                  >
                    NASA EDA Feed
                  </button>
                </div>
              </div>
            </div>

            {/* Threshold Sliders */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 space-y-4 text-xs">
              {/* CO2 Limit */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white space-y-2 shadow-2xs">
                <div className="flex justify-between items-center font-mono">
                  <span className="font-semibold text-slate-800">CO₂ Advisory Threshold</span>
                  <span className="font-bold text-[#0284c7] px-2 py-0.5 rounded bg-sky-50 border border-sky-200">
                    {settings.thresholds.co2WarningPpm} PPM
                  </span>
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
                    className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 text-sky-700 hover:bg-sky-50 transition-colors flex items-center justify-center cursor-pointer select-none"
                    title="Decrease CO₂ threshold by 50 PPM"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="range"
                    min="2500"
                    max="4500"
                    step="50"
                    value={settings.thresholds.co2WarningPpm}
                    onChange={(e) =>
                      updateSettings({
                        thresholds: {
                          ...settings.thresholds,
                          co2WarningPpm: Number(e.target.value),
                        },
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
                    className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 text-sky-700 hover:bg-sky-50 transition-colors flex items-center justify-center cursor-pointer select-none"
                    title="Increase CO₂ threshold by 50 PPM"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Flight Rule B13-101.B trigger (ECLSS Washout protocol)
                </span>
              </div>

              {/* Radiation Limit */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white space-y-2 shadow-2xs">
                <div className="flex justify-between items-center font-mono">
                  <span className="font-semibold text-slate-800">Radiation Rate Alert</span>
                  <span className="font-bold text-[#d97706] px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
                    {settings.thresholds.radAlertRate} mGy/d
                  </span>
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
                    className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 text-sky-700 hover:bg-sky-50 transition-colors flex items-center justify-center cursor-pointer select-none"
                    title="Decrease radiation threshold by 0.01 mGy/d"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="range"
                    min="0.15"
                    max="0.50"
                    step="0.01"
                    value={settings.thresholds.radAlertRate}
                    onChange={(e) =>
                      updateSettings({
                        thresholds: {
                          ...settings.thresholds,
                          radAlertRate: Number(e.target.value),
                        },
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
                    className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 text-sky-700 hover:bg-sky-50 transition-colors flex items-center justify-center cursor-pointer select-none"
                    title="Increase radiation threshold by 0.01 mGy/d"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Space Radiation Analysis Group (SRAG) ALARA countermeasure
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. SI Engine: Online SI vs Local SI */}
      {showSection("intelligence") && (
        <section className="rounded-[32px] border border-slate-200/90 bg-white p-6 sm:p-7 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-sky-50 text-sky-700 border border-sky-200/70">
                <Cpu className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  SI Engine
                </h2>
                <p className="text-xs text-slate-500">
                  Select between Online SI and Local SI.
                </p>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-auto ${
                aiModelMode === "local"
                  ? localModelStatus === "ready"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : "bg-amber-50 text-amber-800 border-amber-300"
                  : "bg-sky-50 text-sky-800 border-sky-300"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  aiModelMode === "local"
                    ? localModelStatus === "ready"
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-amber-500"
                    : "bg-sky-500 animate-pulse"
                }`}
              />
              {aiModelMode === "frontier"
                ? "Online SI Active"
                : localModelStatus === "ready"
                ? "Local SI Ready"
                : "Local SI (Needs Load)"}
            </span>
          </div>

          {/* Master 2-Mode Buttons: Online SI and Local SI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Button 1: Online SI */}
            <button
              type="button"
              onClick={() => setAiModelMode("frontier")}
              className={`p-4.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between gap-3 ${
                aiModelMode === "frontier"
                  ? "bg-white border-sky-500 shadow-xs ring-2 ring-sky-500/20"
                  : "bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Online SI</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Hosted Gateway · Gemini 2.5 Flash, DeepSeek &amp; GPT-4o-mini
                    </p>
                  </div>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    aiModelMode === "frontier"
                      ? "border-sky-600 bg-sky-600 text-white"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {aiModelMode === "frontier" && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-100">
                <span>Latency: ~400ms</span>
                <span>•</span>
                <span>Self-Healing Multi-Model Failover</span>
              </div>
            </button>

            {/* Button 2: Local SI */}
            <button
              type="button"
              onClick={() => setAiModelMode("local")}
              className={`p-4.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between gap-3 ${
                aiModelMode === "local"
                  ? "bg-white border-sky-500 shadow-xs ring-2 ring-sky-500/20"
                  : "bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Local SI</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      100% Station Offline · Ollama port 11434 (qwen2.5:7b / tommy)
                    </p>
                  </div>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    aiModelMode === "local"
                      ? "border-sky-600 bg-sky-600 text-white"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {aiModelMode === "local" && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-100">
                <span>Latency: ~120ms</span>
                <span>•</span>
                <span>Zero Cloud Dependency</span>
              </div>
            </button>
          </div>

          {/* Mode 1 Details: Online SI */}
          {aiModelMode === "frontier" && (
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={isTestingKey}
                  onClick={async () => {
                    setIsTestingKey(true);
                    setKeyTestResult(null);
                    const res = await testSargalayApiKey(getSargalayApiKey() || "");
                    setKeyTestResult(res);
                    setIsTestingKey(false);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0 self-start sm:self-auto"
                >
                  {isTestingKey ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Radio className="w-3.5 h-3.5" />
                  )}
                  <span>{isTestingKey ? "Pinging Gateway..." : "Test Gateway Connection"}</span>
                </button>
              </div>

              {keyTestResult && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
                    keyTestResult.success
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-rose-50 text-rose-800 border-rose-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {keyTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span className="font-medium">{keyTestResult.message}</span>
                  </div>
                  {keyTestResult.latencyMs && (
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {keyTestResult.latencyMs} ms
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mode 2 Details: Local SI */}
          {aiModelMode === "local" && (
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-4 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/70">
                <div className="flex items-center gap-2.5">
                  <HardDrive className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>Local SI Station Bridge</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                        localhost:11434
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Native background runtime for autonomous flight operations without telemetry uplink.
                    </p>
                  </div>
                </div>

                {/* Primary Action: Load into VRAM / Check Button */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    disabled={isCheckingOllama}
                    onClick={refreshOllama}
                    className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs transition-all cursor-pointer shadow-2xs"
                    title="Refresh Ollama daemon probe"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingOllama ? "animate-spin text-sky-600" : ""}`} />
                  </button>

                  {localModelStatus === "ready" ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={loadLocalModel}
                        className="px-3.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>VRAM Loaded</span>
                      </button>
                      <button
                        type="button"
                        onClick={unloadLocalModel}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                        title="Free GPU VRAM memory"
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>Unload</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={localModelStatus === "loading"}
                      onClick={loadLocalModel}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs"
                    >
                      {localModelStatus === "loading" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4" />
                      )}
                      <span>
                        {localModelStatus === "loading"
                          ? "Loading into VRAM..."
                          : "Load Local SI into VRAM"}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Status and Diagnostics */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <span className="text-slate-600 font-medium">Local SI Daemon:</span>
                  <span
                    className={`font-mono font-bold flex items-center gap-1.5 ${
                      ollamaStatus?.online
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        ollamaStatus?.online ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                    {ollamaStatus?.online
                      ? "Online & Responding (Port 11434)"
                      : "Checking or Offline"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <span className="text-slate-600 font-medium">Model Execution State:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {localModelStatusText || "Idle / Not loaded"}
                  </span>
                </div>

                {/* Loading Progress Bar */}
                {localModelStatus === "loading" && (
                  <div className="space-y-1.5 p-3 rounded-xl bg-white border border-emerald-200 shadow-2xs">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-emerald-800 font-bold">Warming up model pipeline</span>
                      <span className="text-emerald-700 font-bold">{localModelProgress}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${localModelProgress}%` }}
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      />
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {localModelError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{localModelError}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 5. SI Voice & Spaceflight Comms Audio */}
      {showSection("comms") && (
        <section className="rounded-[32px] border border-slate-200/90 bg-white p-6 sm:p-7 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-sky-50 text-sky-700 border border-sky-200/70">
                <Volume2 className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  SI Voice &amp; Spaceflight Comms Audio
                </h2>
                <p className="text-xs text-slate-500">
                  Natural speech synthesis, Apollo/ISS Quindar beeps, and audio personas.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={openVoiceModal}
              className="px-3.5 py-1.5 rounded-xl border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs self-start sm:self-auto"
            >
              <Radio className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
              <span>Launch Voice Mode</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Auto-Speak */}
            <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-2">
              <label className="block text-slate-700 font-semibold">Auto-Speak Guidance</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!autoSpeakEnabled) toggleAutoSpeak();
                  }}
                  className={`py-1.5 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    autoSpeakEnabled
                      ? "bg-white border-sky-400 text-sky-800 shadow-2xs font-bold"
                      : "border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white/80"
                  }`}
                >
                  Enabled
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (autoSpeakEnabled) toggleAutoSpeak();
                  }}
                  className={`py-1.5 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    !autoSpeakEnabled
                      ? "bg-white border-sky-400 text-sky-800 shadow-2xs font-bold"
                      : "border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white/80"
                  }`}
                >
                  Muted
                </button>
              </div>
              <span className="text-[10px] text-slate-400 block">Vocalize triage answers</span>
            </div>

            {/* Quindar Beeps */}
            <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-2">
              <label className="block text-slate-700 font-semibold">Quindar Comms Beeps</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuindarBeepsEnabled(true)}
                  className={`py-1.5 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    quindarBeepsEnabled
                      ? "bg-white border-sky-400 text-sky-800 shadow-2xs font-bold"
                      : "border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white/80"
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setQuindarBeepsEnabled(false)}
                  className={`py-1.5 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    !quindarBeepsEnabled
                      ? "bg-white border-sky-400 text-sky-800 shadow-2xs font-bold"
                      : "border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white/80"
                  }`}
                >
                  Off
                </button>
              </div>
              <span className="text-[10px] text-slate-400 block">2525Hz &amp; 2475Hz tone cues</span>
            </div>

            {/* Rate Slider */}
            <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-slate-700 font-semibold">Voice Rate</label>
                <span className="font-mono text-xs font-bold text-sky-700">{voiceRate.toFixed(2)}x</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setVoiceRate(Math.max(0.75, Number((voiceRate - 0.05).toFixed(2))))}
                  className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-sky-700 hover:bg-sky-50 transition-colors flex items-center justify-center cursor-pointer select-none"
                  title="Decrease speech rate"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="range"
                  min="0.75"
                  max="1.50"
                  step="0.05"
                  value={voiceRate}
                  onChange={(e) => setVoiceRate(Number(e.target.value))}
                  className="flex-1 accent-[#0284c7] cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                />
                <button
                  type="button"
                  onClick={() => setVoiceRate(Math.min(1.5, Number((voiceRate + 0.05).toFixed(2))))}
                  className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-sky-700 hover:bg-sky-50 transition-colors flex items-center justify-center cursor-pointer select-none"
                  title="Increase speech rate"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <span className="text-[10px] text-slate-400 block">Cadence multiplier</span>
            </div>
          </div>

          {/* Row 2: Personas, Voice Picker, Pitch & Preview */}
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
            {/* Personas */}
            <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-2">
              <label className="block text-slate-700 font-semibold">Voice Persona</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "nova", label: "Nova", hint: "Warm" },
                  { id: "orion", label: "Orion", hint: "Calm" },
                  { id: "athena", label: "Athena", hint: "British" },
                  { id: "capcom", label: "Capcom", hint: "Comms" },
                ].map((p) => {
                  const isSelected = voicePersona === p.id && !selectedVoiceName;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setVoicePersona(p.id as VoicePersona);
                        setSelectedVoiceName(null);
                        speakMessage(
                          "test-persona",
                          `HabiTrack voice persona switched to ${p.label}.`,
                        );
                      }}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? "bg-white border-sky-400 text-sky-900 font-bold shadow-2xs ring-1 ring-sky-400/30"
                          : "border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white"
                      }`}
                    >
                      <div className="font-semibold text-xs">{p.label}</div>
                      <div className="text-[10px] text-slate-400">{p.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Voice Dropdown */}
            <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-slate-700 font-semibold">Browser Voice</label>
                {selectedVoiceName && (
                  <button
                    type="button"
                    onClick={() => setSelectedVoiceName(null)}
                    className="text-[10px] text-sky-600 hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
              <select
                aria-label="Installed Browser Voice"
                value={selectedVoiceName || ""}
                onChange={(e) => {
                  const val = e.target.value || null;
                  setSelectedVoiceName(val);
                  if (val) {
                    setVoicePersona("custom");
                    speakMessage("test-voice", `Selected ${val}.`);
                  }
                }}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                <option value="">Auto by Persona ({voicePersona.toUpperCase()})</option>
                {availableVoices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 block">
                Installed browser synthesis engine
              </span>
            </div>

            {/* Pitch & Test */}
            <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-slate-700 font-semibold">Pitch &amp; Preview</label>
                <span className="font-mono text-xs font-bold text-sky-700">{voicePitch.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setVoicePitch(Math.max(0.65, Number((voicePitch - 0.05).toFixed(2))))
                  }
                  className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-sky-700 hover:bg-sky-50 transition-colors flex items-center justify-center cursor-pointer select-none"
                  title="Lower pitch"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="range"
                  min="0.65"
                  max="1.35"
                  step="0.05"
                  value={voicePitch}
                  onChange={(e) => setVoicePitch(Number(e.target.value))}
                  className="flex-1 accent-[#0284c7] cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setVoicePitch(Math.min(1.35, Number((voicePitch + 0.05).toFixed(2))))
                  }
                  className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-sky-700 hover:bg-sky-50 transition-colors flex items-center justify-center cursor-pointer select-none"
                  title="Higher pitch"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  speakMessage(
                    "preview-voice-btn",
                    "This is HabiTrack operational health intelligence. Telemetry nominal.",
                  )
                }
                className="w-full py-1.5 rounded-xl border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs mt-1"
              >
                <Volume2
                  className={`w-3.5 h-3.5 ${isSpeaking ? "animate-pulse text-sky-600" : ""}`}
                />
                <span>{isSpeaking ? "Speaking..." : "Test Voice Preview"}</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 6. Simulation Sandbox & Anomaly Injectors */}
      {showSection("simulation") && (
        <section className="rounded-[32px] border border-slate-200/90 bg-white p-6 sm:p-7 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-sky-50 text-sky-700 border border-sky-200/70">
                <Zap className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Interactive Simulation Sandbox &amp; Anomaly Injectors
                </h2>
                <p className="text-xs text-slate-500">
                  Inject live environmental excursions to test multi-signal concordance and flight rules.
                </p>
              </div>
            </div>

            {!isNominalActive ? (
              <span className="px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold animate-pulse flex items-center gap-1.5 self-start sm:self-auto shadow-2xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
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
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Baselines Nominal</span>
              </span>
            )}
          </div>

          {/* Compact Telemetry Readout Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Cabin CO₂ ({isMetric ? "PPM" : "mmHg"})
              </span>
              <span
                className={`font-mono text-sm block mt-0.5 ${
                  isCo2Active ? "text-amber-700 font-black" : "text-slate-900 font-bold"
                }`}
              >
                {displayCo2}
              </span>
            </div>
            <div className="p-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Heart Rate
              </span>
              <span
                className={`font-mono text-sm block mt-0.5 ${
                  isCo2Active || isThermalActive
                    ? "text-rose-600 font-black"
                    : "text-slate-900 font-bold"
                }`}
              >
                {displayHr}
              </span>
            </div>
            <div className="p-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Cabin Temp ({isMetric ? "°C" : "°F"})
              </span>
              <span
                className={`font-mono text-sm block mt-0.5 ${
                  isThermalActive ? "text-orange-600 font-black" : "text-slate-900 font-bold"
                }`}
              >
                {displayTemp}
              </span>
            </div>
            <div className="p-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Radiation Rate
              </span>
              <span
                className={`font-mono text-sm block mt-0.5 ${
                  isSaaActive ? "text-purple-600 font-black" : "text-slate-900 font-bold"
                }`}
              >
                {displayRad}
              </span>
            </div>
          </div>

          {/* Anomaly Buttons & Action Deck */}
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => handleToggleScenario("co2_spike")}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all duration-150 flex items-center justify-center gap-1.5 ${
                  isCo2Active
                    ? "bg-amber-50 border-amber-400 text-amber-900 shadow-xs ring-2 ring-amber-400/40 font-bold"
                    : "bg-white hover:bg-amber-50/60 border-slate-200 text-slate-700 hover:border-amber-300"
                }`}
                title="Toggle CO₂ Spike simulation anomaly"
              >
                <Wind className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>CO₂ Spike</span>
                {isCo2Active && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-ping" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleToggleScenario("thermal_overheat")}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all duration-150 flex items-center justify-center gap-1.5 ${
                  isThermalActive
                    ? "bg-orange-50 border-orange-400 text-orange-900 shadow-xs ring-2 ring-orange-400/40 font-bold"
                    : "bg-white hover:bg-orange-50/60 border-slate-200 text-slate-700 hover:border-orange-300"
                }`}
                title="Toggle Thermal Loop Overheat anomaly"
              >
                <Thermometer className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                <span>Overheat</span>
                {isThermalActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-600 animate-ping" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleToggleScenario("saa_transit")}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all duration-150 flex items-center justify-center gap-1.5 ${
                  isSaaActive
                    ? "bg-purple-50 border-purple-400 text-purple-900 shadow-xs ring-2 ring-purple-400/40 font-bold"
                    : "bg-white hover:bg-purple-50/60 border-slate-200 text-slate-700 hover:border-purple-300"
                }`}
                title="Toggle SAA Radiation belt transit anomaly"
              >
                <Activity className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span>SAA Radiation</span>
                {isSaaActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-600 animate-ping" />
                )}
              </button>

              <button
                type="button"
                onClick={handleResetNominal}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all duration-150 flex items-center justify-center gap-1.5 ${
                  isNominalActive
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-bold"
                    : "border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-800"
                }`}
                title="Reset all active simulation anomalies to nominal baselines"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Reset Nominal</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("habitrack_symptom_diary_v3");
                    window.dispatchEvent(new Event("habitrack_symptom_logged"));
                    notifyScenario("Cleared all logged symptoms from local station diary.");
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="Clear logged symptoms"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear Symptoms</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    simulationControls.injectScenario("co2_spike");
                    notifyScenario("Loaded NASA Hypercapnia Case Study (CO₂ Spike active).");
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="Load NASA case study"
                >
                  <Sparkles className="w-3 h-3 text-sky-600" />
                  <span>Load Case Study</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
