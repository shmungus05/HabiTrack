/**
 * Isolated Component: Settings & Astronaut Profile Simulation
 * Perplexity minimalist styling:
 * - font-semibold uppercase headers
 * - rounded-lg containers
 * - generous whitespace & micro-animations
 * - 100% preservation of friend's fields, +/- controls, sliders, and buttons
 */

import React, { useEffect, useState } from "react";
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
  Volume2,
  VolumeX,
  Cpu,
  Key,
  HardDrive,
  Loader2,
  Power,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useAssistantStore } from "../../stores/assistantStore";
import { getAvailableVoices, type VoicePersona } from "../../lib/speech";
import { getGeminiApiKey, getGeminiModelLabel, setGeminiApiKey, testGeminiApiKey } from "../../services/ai/geminiClient";
import { purgeCorruptedWebLLMCache } from "../../services/ai/localModelService";
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
    checkWebGpu,
    isWebGpuSupported,
  } = useAssistantStore();

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [apiKeyInput, setApiKeyInput] = useState(getGeminiApiKey() || "");
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    checkWebGpu();
  }, [checkWebGpu]);

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
  const { activeScenario, isAnomalyActive, thresholds } = simulationState;
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
    ? (isCo2Active ? "4,350 PPM" : "2,250 PPM")
    : (isCo2Active ? "5.80 mmHg" : "3.00 mmHg");
  const displayTemp = isMetric
    ? (isThermalActive ? "27.4 °C" : "22.8 °C")
    : (isThermalActive ? "81.3 °F" : "73.0 °F");
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
    scenario: "co2_spike" | "thermal_overheat" | "saa_transit"
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
        ? (isMetric ? "CO₂ Pocket Spike (4,350 PPM)" : "CO₂ Pocket Spike (5.80 mmHg)")
        : scenario === "thermal_overheat"
        ? (isMetric ? "Thermal Loop Excursion (27.4 °C)" : "Thermal Loop Excursion (81.3 °F)")
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

          {/* SI Intelligence & Execution Engine (Frontier vs Local WebGPU) */}
          <div className="p-5 sm:p-6 glass-panel rounded-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-sky-700 uppercase tracking-[0.14em] flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-sky-600" />
                  <span>SI Intelligence &amp; Execution Engine</span>
                </h3>
                <p className="text-xs text-muted mt-1">
                  Select your primary clinical intelligence provider. Choose Frontier for cloud reasoning or Local for 100% offline flight.
                </p>
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  aiModelMode === "local"
                    ? localModelStatus === "ready"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "bg-amber-50 text-amber-700 border-amber-300"
                    : "bg-sky-50 text-sky-700 border-sky-300"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    aiModelMode === "local"
                      ? localModelStatus === "ready" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                      : "bg-sky-500 animate-pulse"
                  }`} />
                  {aiModelMode === "frontier" ? "Frontier Active" : localModelStatus === "ready" ? "Local Offline Ready" : "Local (Needs Init)"}
                </span>
              </div>
            </div>

            {/* Binary Model Selector: Exactly Two Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Option 1: Frontier (Gemini) */}
              <button
                type="button"
                onClick={() => setAiModelMode("frontier")}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  aiModelMode === "frontier"
                    ? "bg-white border-sky-500 shadow-sm ring-1 ring-sky-500/30"
                    : "bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-100 text-sky-700">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span>Frontier Cloud</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-100 text-sky-800">
                          {getGeminiModelLabel()}
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Deep biomedical RAG synthesis via Google Gemini (Frontier SI)
                      </p>
                    </div>
                  </div>
                  <span className={`w-4 h-4 rounded-full border grid place-items-center ${
                    aiModelMode === "frontier"
                      ? "border-sky-600 bg-sky-600 text-white"
                      : "border-slate-300 bg-white"
                  }`}>
                    {aiModelMode === "frontier" && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-100">
                  <span>Latency: ~600ms</span>
                  <span>•</span>
                  <span>Internet: Required</span>
                </div>
              </button>

              {/* Option 2: Local WebGPU (Llama-3.2-1B-Instruct) */}
              <button
                type="button"
                onClick={() => setAiModelMode("local")}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  aiModelMode === "local"
                    ? "bg-white border-sky-500 shadow-sm ring-1 ring-sky-500/30"
                    : "bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                      <Zap className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span>Local WebGPU</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                          Llama-3.2-1B
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        100% In-Browser &amp; Zero-Server Offline Flight
                      </p>
                    </div>
                  </div>
                  <span className={`w-4 h-4 rounded-full border grid place-items-center ${
                    aiModelMode === "local"
                      ? "border-sky-600 bg-sky-600 text-white"
                      : "border-slate-300 bg-white"
                  }`}>
                    {aiModelMode === "local" && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-100">
                  <span>Latency: ~120ms</span>
                  <span>•</span>
                  <span>Offline: 100% Standalone</span>
                </div>
              </button>
            </div>

            {/* Frontier Specific Configuration */}
            {aiModelMode === "frontier" && (
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-3 animate-in fade-in-50 duration-150">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-sky-600" />
                    <span>Gemini API Key</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Stored locally in browser localStorage
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => {
                      setApiKeyInput(e.target.value);
                      setGeminiApiKey(e.target.value);
                      setKeyTestResult(null);
                    }}
                    placeholder="AIzaSy..."
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="button"
                    disabled={!apiKeyInput.trim() || isTestingKey}
                    onClick={async () => {
                      setIsTestingKey(true);
                      setKeyTestResult(null);
                      const res = await testGeminiApiKey(apiKeyInput);
                      setKeyTestResult(res);
                      setIsTestingKey(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {isTestingKey && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isTestingKey ? "Testing..." : "Test Key"}</span>
                  </button>
                </div>

                {keyTestResult && (
                  <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
                    keyTestResult.success
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-rose-50 text-rose-800 border-rose-200"
                  }`}>
                    {keyTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{keyTestResult.message}</span>
                  </div>
                )}
              </div>
            )}

            {/* Local WebGPU Specific Configuration */}
            {aiModelMode === "local" && (
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-3.5 animate-in fade-in-50 duration-150">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-emerald-600" />
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">
                        Llama-3.2-1B-Instruct-q4f16_1-MLC
                      </h5>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        677.9 MB weights stored locally in /public/models/
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {localModelStatus === "ready" ? (
                      <button
                        type="button"
                        onClick={unloadLocalModel}
                        className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-600 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
                        title="Free GPU VRAM memory"
                      >
                        <Power className="w-3 h-3" />
                        <span>Unload</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={localModelStatus === "loading"}
                        onClick={loadLocalModel}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      >
                        {localModelStatus === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>{localModelStatus === "loading" ? "Initializing..." : "Load into VRAM"}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* WebGPU Hardware Capability Badge */}
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-slate-600">WebGPU Acceleration:</span>
                  <span className={`font-mono font-bold flex items-center gap-1.5 ${
                    isWebGpuSupported === false ? "text-rose-600" : "text-emerald-700"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isWebGpuSupported === false ? "bg-rose-500" : "bg-emerald-500"}`} />
                    {isWebGpuSupported === false ? "Unsupported in this browser" : "Hardware Acceleration Active"}
                  </span>
                </div>

                {/* Progress bar during loading */}
                {localModelStatus === "loading" && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 font-medium">{localModelStatusText}</span>
                      <span className="font-mono font-bold text-sky-700">{localModelProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-300"
                        style={{ width: `${localModelProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error Banner if loading failed */}
                {localModelStatus === "error" && localModelError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Initialization Error</p>
                        <p className="text-[11px] mt-0.5 font-mono break-all">{localModelError}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1.5 border-t border-rose-200/70">
                      <button
                        type="button"
                        onClick={async () => {
                          await purgeCorruptedWebLLMCache(true);
                          await loadLocalModel();
                        }}
                        className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Clear Cache &amp; Retry</span>
                      </button>
                      <span className="text-[10px] text-rose-600">
                        Purges cached HTML from browser CacheStorage
                      </span>
                    </div>
                  </div>
                )}

                {/* Ready Status Banner */}
                {localModelStatus === "ready" && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Model compiled &amp; active in WebGPU memory. Offline queries enabled.</span>
                    </div>
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      Zero Server
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="p-5 sm:p-6 glass-panel rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-sky-700 uppercase tracking-[0.14em] flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-sky-600" />
                <span>SI Voice &amp; Spaceflight Comms Audio</span>
              </h3>
              <button
                type="button"
                onClick={openVoiceModal}
                className="px-3 py-1 rounded-lg border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Radio className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
                <span>Launch Voice Mode</span>
              </button>
            </div>

            {/* Row 1: Basic Audio Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-secondary font-semibold mb-2">Auto-Speak Guidance</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!autoSpeakEnabled) toggleAutoSpeak();
                    }}
                    className={`py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      autoSpeakEnabled
                        ? "bg-sky-50 border-sky-300 text-sky-700 font-bold"
                        : "border-border text-muted hover:text-foreground glass-panel-subtle"
                    }`}
                  >
                    Enabled
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (autoSpeakEnabled) toggleAutoSpeak();
                    }}
                    className={`py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      !autoSpeakEnabled
                        ? "bg-sky-50 border-sky-300 text-sky-700 font-bold"
                        : "border-border text-muted hover:text-foreground glass-panel-subtle"
                    }`}
                  >
                    Muted
                  </button>
                </div>
                <span className="text-[11px] text-muted block mt-1.5">
                  Automatically read aloud SI triage responses
                </span>
              </div>

              <div>
                <label className="block text-secondary font-semibold mb-2">NASA Quindar Comms Beeps</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuindarBeepsEnabled(true)}
                    className={`py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      quindarBeepsEnabled
                        ? "bg-sky-50 border-sky-300 text-sky-700 font-bold"
                        : "border-border text-muted hover:text-foreground glass-panel-subtle"
                    }`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuindarBeepsEnabled(false)}
                    className={`py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      !quindarBeepsEnabled
                        ? "bg-sky-50 border-sky-300 text-sky-700 font-bold"
                        : "border-border text-muted hover:text-foreground glass-panel-subtle"
                    }`}
                  >
                    Off
                  </button>
                </div>
                <span className="text-[11px] text-muted block mt-1.5">
                  Apollo/ISS 2525Hz &amp; 2475Hz comms audio cues
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-secondary font-semibold">Voice Playback Rate</label>
                  <span className="font-mono text-xs font-bold text-sky-700">{voiceRate.toFixed(2)}x</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVoiceRate(Math.max(0.75, Number((voiceRate - 0.05).toFixed(2))))}
                    className="p-1.5 rounded-md bg-white border border-border text-sky-700 hover:bg-sky-50 transition-colors cursor-pointer"
                    title="Decrease speech rate"
                  >
                    <Minus className="w-3.5 h-3.5" />
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
                    className="p-1.5 rounded-md bg-white border border-border text-sky-700 hover:bg-sky-50 transition-colors cursor-pointer"
                    title="Increase speech rate"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-[11px] text-muted block mt-1.5">Speech synthesis cadence multiplier</span>
              </div>
            </div>

            {/* Row 2: Voice Persona, Pitch, & System Voice Selection */}
            <div className="pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* Voice Persona Preset */}
              <div>
                <label className="block text-secondary font-semibold mb-2">SI Voice Persona</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: "nova", label: "Nova (Female)", hint: "Warm & Clear" },
                    { id: "orion", label: "Orion (Male)", hint: "Calm & Grounded" },
                    { id: "athena", label: "Athena (British)", hint: "Refined British" },
                    { id: "capcom", label: "Capcom (Comms)", hint: "Space Comms" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setVoicePersona(p.id as VoicePersona);
                        setSelectedVoiceName(null);
                        speakMessage("test-persona", `HabiTrack voice persona switched to ${p.label}.`);
                      }}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        voicePersona === p.id && !selectedVoiceName
                          ? "bg-sky-50 border-sky-400 text-sky-800 font-bold shadow-2xs"
                          : "border-border text-slate-600 hover:text-slate-900 glass-panel-subtle hover:bg-white"
                      }`}
                    >
                      <div className="font-semibold text-[11px]">{p.label}</div>
                      <div className="text-[10px] text-muted">{p.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific Installed Browser Voice Picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-secondary font-semibold">Installed Browser Voice</label>
                  {selectedVoiceName && (
                    <button
                      type="button"
                      onClick={() => setSelectedVoiceName(null)}
                      className="text-[10px] text-sky-600 hover:underline cursor-pointer"
                    >
                      Reset to Persona
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
                  className="w-full px-3 py-2 rounded-lg bg-white border border-border text-foreground text-xs focus:outline-none focus:border-sky-600 cursor-pointer"
                >
                  <option value="">Auto-Selected by Persona ({voicePersona.toUpperCase()})</option>
                  {availableVoices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-muted block mt-1.5">
                  Select any specific natural voice installed in your browser
                </span>
              </div>

              {/* Voice Pitch & Test Button */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-secondary font-semibold">Voice Pitch &amp; Test</label>
                  <span className="font-mono text-xs font-bold text-sky-700">{voicePitch.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVoicePitch(Math.max(0.65, Number((voicePitch - 0.05).toFixed(2))))}
                    className="p-1.5 rounded-md bg-white border border-border text-sky-700 hover:bg-sky-50 transition-colors cursor-pointer"
                    title="Lower pitch"
                  >
                    <Minus className="w-3.5 h-3.5" />
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
                    onClick={() => setVoicePitch(Math.min(1.35, Number((voicePitch + 0.05).toFixed(2))))}
                    className="p-1.5 rounded-md bg-white border border-border text-sky-700 hover:bg-sky-50 transition-colors cursor-pointer"
                    title="Higher pitch"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Preview Voice Button */}
                <button
                  type="button"
                  onClick={() =>
                    speakMessage(
                      "preview-voice-btn",
                      "This is HabiTrack operational health intelligence. Telemetry nominal."
                    )
                  }
                  className="w-full mt-2.5 py-1.5 rounded-lg border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
                >
                  <Volume2 className={`w-3.5 h-3.5 ${isSpeaking ? "animate-pulse text-sky-600" : ""}`} />
                  <span>{isSpeaking ? "Speaking Preview..." : "Test Voice Preview"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Real-Time Testing & Navigation Indicators Card — Under Metrics Card */}
          <div className="p-4 sm:p-5 glass-panel rounded-xl space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-sky-600 shrink-0" />
                <h3 className="text-xs font-bold text-sky-700 uppercase tracking-wider">
                  Interactive Real-Time Testing &amp; Navigation Indicators
                </h3>
              </div>

              {!isNominalActive ? (
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
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-medium">
                  Baselines Nominal
                </span>
              )}
            </div>

            {/* Compact Live Telemetry Status Ribbon - Strictly Showing Chosen Unit */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Cabin CO₂ ({isMetric ? "PPM" : "mmHg"})
                </span>
                <span className={`font-mono font-bold text-xs ${isCo2Active ? "text-amber-700 font-extrabold" : "text-slate-900"}`}>
                  {displayCo2}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Heart Rate</span>
                <span className={`font-mono font-bold text-xs ${isCo2Active || isThermalActive ? "text-rose-600 font-extrabold" : "text-slate-900"}`}>
                  {displayHr}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Cabin Temp ({isMetric ? "°C" : "°F"})
                </span>
                <span className={`font-mono font-bold text-xs ${isThermalActive ? "text-orange-600 font-extrabold" : "text-slate-900"}`}>
                  {displayTemp}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Radiation</span>
                <span className={`font-mono font-bold text-xs ${isSaaActive ? "text-purple-600 font-extrabold" : "text-slate-900"}`}>
                  {displayRad}
                </span>
              </div>
            </div>

            {/* Compact Injector Buttons & Quick Actions */}
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleScenario("co2_spike")}
                  className={`py-1.5 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                    isCo2Active
                      ? "bg-amber-100 border-amber-400 text-amber-900 shadow-xs ring-2 ring-amber-400 font-bold"
                      : "bg-white hover:bg-amber-50 border-slate-200 text-slate-700 hover:border-amber-300"
                  }`}
                  title="Toggle CO₂ Spike simulation anomaly"
                >
                  <Wind className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>CO₂ Spike</span>
                  {isCo2Active && (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-ping ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleScenario("thermal_overheat")}
                  className={`py-1.5 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                    isThermalActive
                      ? "bg-orange-100 border-orange-400 text-orange-900 shadow-xs ring-2 ring-orange-400 font-bold"
                      : "bg-white hover:bg-orange-50 border-slate-200 text-slate-700 hover:border-orange-300"
                  }`}
                  title="Toggle Thermal Loop Overheat anomaly"
                >
                  <Thermometer className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                  <span>Overheat</span>
                  {isThermalActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-600 animate-ping ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleScenario("saa_transit")}
                  className={`py-1.5 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                    isSaaActive
                      ? "bg-purple-100 border-purple-400 text-purple-900 shadow-xs ring-2 ring-purple-400 font-bold"
                      : "bg-white hover:bg-purple-50 border-slate-200 text-slate-700 hover:border-purple-300"
                  }`}
                  title="Toggle SAA Radiation belt transit anomaly"
                >
                  <Activity className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>SAA Radiation</span>
                  {isSaaActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-600 animate-ping ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResetNominal}
                  className={`py-1.5 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                    isNominalActive
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                      : "border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-800"
                  }`}
                  title="Reset all active simulation anomalies to nominal baselines"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Reset Nominal</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-muted">
                  Direct telemetry anomaly injectors. Live propagation to Overview, Alerts &amp; Timeline.
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem("habitrack_symptom_diary_v3");
                      window.dispatchEvent(new Event("habitrack_symptom_logged"));
                      notifyScenario("Cleared all logged symptoms from local station diary.");
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
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
                    className="px-2.5 py-1.5 rounded-lg glass-panel-subtle hover:border-sky-300 hover:bg-sky-50 text-secondary hover:text-sky-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                    title="Load NASA case study"
                  >
                    <Sparkles className="w-3 h-3 text-sky-600" />
                    <span>Case Study</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
