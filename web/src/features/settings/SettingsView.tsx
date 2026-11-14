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
} from "lucide-react";
import { useBiomedicalSettings } from "./SettingsModule";

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
    setTimeout(() => setScenarioNotice(null), 3000);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Banner */}
      <div className="p-4 sm:p-6 bg-surface rounded-lg border border-border flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-3.5 h-3.5 text-muted" />
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">Flight Deck Platform Configuration</span>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
            Astronaut Profile &amp; Biomedical Baseline Simulation
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Crew biomedical thresholds, telemetry synchronization feeds, and simulation injectors
          </p>
        </div>

        {saveSuccess && (
          <div className="px-3 py-1.5 rounded-md bg-surface-elevated border border-border text-[11px] font-medium text-foreground flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4" />
            <span>Profile Saved to Flight Deck!</span>
          </div>
        )}

        {scenarioNotice && (
          <div className="px-3 py-1.5 rounded-md bg-surface-elevated border border-border text-[11px] font-medium text-foreground flex items-center gap-2 animate-fadeIn">
            <Zap className="w-4 h-4" />
            <span>Scenario Triggered: {scenarioNotice}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Astronaut Profile Card */}
        <div className="p-4 sm:p-6 bg-surface rounded-lg border border-border flex flex-col justify-between space-y-6">
          <div className="text-center space-y-3">
            <div className="w-24 h-24 mx-auto rounded-lg bg-surface-elevated border border-border flex items-center justify-center">
              <User className="w-12 h-12 text-secondary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground tracking-tight">{profile.name}</h3>
              <p className="text-xs text-secondary font-medium">{profile.role}</p>
              <p className="text-[11px] font-mono text-muted mt-0.5">
                {profile.mission} · Day {profile.daysInSpace}
              </p>
            </div>
            {/* Radiation Dose Bar */}
            <div className="pt-2 text-left space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-muted">Career Dose (ALARA):</span>
                <span className="text-secondary font-semibold">
                  {profile.careerRadiationDoseMsv} / {profile.careerLimitMsv} mSv
                </span>
              </div>
              <div className="h-2 w-full bg-surface-subtle rounded-full overflow-hidden">
                <div
                  style={{ width: `${(profile.careerRadiationDoseMsv / profile.careerLimitMsv) * 100}%` }}
                  className="h-full bg-foreground rounded-full"
                />
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div>
              <label className="block text-muted font-semibold mb-1.5">Astronaut Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-accent-light"
              />
            </div>

            <div>
              <label className="block text-muted font-semibold mb-1.5">Flight Role / Specialty</label>
              <input
                type="text"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-accent-light"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-muted font-semibold mb-1.5">Baseline HR (bpm)</label>
                <div className="flex items-center rounded-lg bg-surface-elevated border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => adjustHeartRate(-1)}
                    className="p-2 text-secondary hover:text-foreground hover:bg-surface-subtle cursor-pointer select-none"
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
                    className="p-2 text-secondary hover:text-foreground hover:bg-surface-subtle cursor-pointer select-none"
                    title="Increase Heart Rate"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-muted font-semibold mb-1.5">Resting SpO₂ (%)</label>
                <div className="flex items-center rounded-lg bg-surface-elevated border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => adjustSpO2(-1)}
                    className="p-2 text-secondary hover:text-foreground hover:bg-surface-subtle cursor-pointer select-none"
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
                    className="p-2 text-secondary hover:text-foreground hover:bg-surface-subtle cursor-pointer select-none"
                    title="Increase SpO₂"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-accent-secondary hover:bg-accent-hover text-xs font-semibold text-foreground flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-2"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Update Crew Baseline</span>
            </button>
          </form>
        </div>

        {/* Right 2 Columns: Threshold Configuration & System Options */}
        <div className="lg:col-span-2 space-y-6">
          {/* Thresholds Card */}
          <div className="p-4 sm:p-6 bg-surface rounded-lg border border-border space-y-4">
            <h3 className="text-xs font-semibold text-secondary uppercase tracking-[0.14em] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-muted" />
              <span>Environmental Alarm Thresholds (NASA Flight Safety)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-lg bg-surface-elevated border border-border space-y-2">
                <div className="flex justify-between font-mono">
                  <span className="font-semibold text-foreground">CO₂ Advisory Threshold</span>
                  <span className="font-semibold text-foreground">{settings.thresholds.co2WarningPpm} PPM</span>
                </div>
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
                  className="w-full accent-[#8b9dff] cursor-pointer h-1.5 bg-surface-subtle rounded-lg appearance-none"
                />
                <span className="text-[10px] text-muted">Flight Rule B13-101.B trigger</span>
              </div>

              <div className="p-4 rounded-lg bg-surface-elevated border border-border space-y-2">
                <div className="flex justify-between font-mono">
                  <span className="font-semibold text-foreground">Radiation Rate Alert</span>
                  <span className="font-semibold text-secondary">{settings.thresholds.radAlertRate} mGy/d</span>
                </div>
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
                  className="w-full accent-[#8b9dff] cursor-pointer h-1.5 bg-surface-subtle rounded-lg appearance-none"
                />
                <span className="text-[10px] text-muted">SRAG ALARA advisory trigger</span>
              </div>
            </div>
          </div>

          {/* Unit Preferences & Feeds */}
          <div className="p-4 sm:p-6 bg-surface rounded-lg border border-border space-y-4">
            <h3 className="text-xs font-semibold text-secondary uppercase tracking-[0.14em] flex items-center gap-2">
              <Radio className="w-4 h-4 text-muted" />
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
                        ? "bg-surface-subtle border-border-strong text-foreground"
                        : "border-border text-muted hover:text-foreground bg-surface-elevated"
                    }`}
                  >
                    Metric (°C, PPM, kPa)
                  </button>
                  <button
                    onClick={() => updateSettings({ unitSystem: "us" })}
                    className={`py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      settings.unitSystem === "us"
                        ? "bg-surface-subtle border-border-strong text-foreground"
                        : "border-border text-muted hover:text-foreground bg-surface-elevated"
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
                        ? "bg-surface-subtle border-border-strong text-foreground"
                        : "border-border text-muted hover:text-foreground bg-surface-elevated"
                    }`}
                  >
                    Active Simulation
                  </button>
                  <button
                    onClick={() => updateSettings({ telemetrySource: "nasa-eda" })}
                    className={`py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      settings.telemetrySource === "nasa-eda"
                        ? "bg-surface-subtle border-border-strong text-foreground"
                        : "border-border text-muted hover:text-foreground bg-surface-elevated"
                    }`}
                  >
                    NASA EDA Feed
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Test Trigger Actions & Data Management */}
          <div className="p-4 sm:p-6 bg-surface rounded-lg border border-border space-y-4">
            <h3 className="text-xs font-semibold text-secondary uppercase tracking-[0.14em] flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-muted" />
              <span>Simulation Scenario Testing &amp; Data Management</span>
            </h3>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <button
                  onClick={() => notifyScenario("Cleared Symptoms")}
                  className="px-3.5 py-2 rounded-md bg-transparent hover:bg-critical/10 border border-critical/40 text-critical font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All Symptoms</span>
                </button>

                <button
                  onClick={() => notifyScenario("Loaded NASA Sample Case")}
                  className="px-3.5 py-2 rounded-md bg-surface-elevated hover:bg-surface-subtle border border-border text-secondary hover:text-foreground font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Load NASA Sample Case Study</span>
                </button>
              </div>

              <div className="pt-2 border-t border-border flex flex-wrap items-center gap-3 text-xs">
                <button
                  onClick={() => notifyScenario("CO₂ Pocket Anomaly (>3,800 PPM)")}
                  className="px-3.5 py-2 rounded-md bg-surface-elevated hover:bg-surface-subtle border border-border text-secondary hover:text-foreground font-medium transition-colors cursor-pointer"
                >
                  Inject CO₂ Pocket Anomaly (&gt; 3,800 PPM)
                </button>
                <button
                  onClick={() => notifyScenario("SAA Orbital Crossing")}
                  className="px-3.5 py-2 rounded-md bg-surface-elevated hover:bg-surface-subtle border border-border text-secondary hover:text-foreground font-medium transition-colors cursor-pointer"
                >
                  Simulate SAA Orbital Crossing
                </button>
                <button
                  onClick={() => notifyScenario("Nominal Baselines Restored")}
                  className="px-3.5 py-2 rounded-md bg-surface-elevated hover:bg-surface-subtle border border-border text-secondary hover:text-foreground font-medium transition-colors cursor-pointer"
                >
                  Reset All to Nominal Baselines
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
