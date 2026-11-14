/**
 * Isolated Component: Clinical Risk & Biological Delay Matrix
 * Designed in the minimalist Perplexity style:
 * - font-semibold uppercase headers
 * - rounded-lg containers
 * - generous whitespace & micro-animations
 * - 100% preservation of NASA clinical parameters
 */

import React, { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Clock,
  Droplets,
  Flame,
  HelpCircle,
  Radio,
  ShieldCheck,
  Wind,
  Layers,
  ChevronRight,
} from "lucide-react";
import {
  CO2_HEADACHE_CURVE,
  CO2_LAG_DATA,
  RADIATION_FATIGUE_CURVE,
  HUMIDITY_DRY_EYE_CURVE,
  TEMPERATURE_STRAIN_CURVE,
  evaluateClinicalRisk,
  type EnvironmentalSnapshot,
} from "./ClinicalRiskModule";

interface ClinicalRiskMatrixProps {
  currentMetrics?: {
    co2: number;
    temp: number;
    humidity: number;
    radiation: number;
    pressure?: number;
  };
  className?: string;
}

export const ClinicalRiskMatrix: React.FC<ClinicalRiskMatrixProps> = ({
  currentMetrics = {
    co2: 3197,
    temp: 22.8,
    humidity: 43.9,
    radiation: 0.20,
    pressure: 758.2,
  },
  className = "",
}) => {
  const [activeFactor, setActiveFactor] = useState<
    "co2" | "radiation" | "humidity" | "temperature" | "matrix"
  >("co2");

  const snapshot: EnvironmentalSnapshot = {
    co2Ppm: currentMetrics.co2,
    tempC: currentMetrics.temp,
    humidityPct: currentMetrics.humidity,
    radiationRateMGy: currentMetrics.radiation,
    pressureMmHg: currentMetrics.pressure,
  };

  const evaluation = evaluateClinicalRisk(snapshot);

  return (
    <section
      className={`p-4 sm:p-6 bg-surface rounded-lg border border-border relative overflow-hidden ${className}`}
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-3.5 h-3.5 text-muted" />
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">NASA LSDA & RadLab Predictive Models</span>
            <span className="text-[11px] font-mono text-muted">
              Epidemiological Causality & Latency
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
            Environmental Risk & Biological Delay Engine
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Non-linear physiological consequence curves and post-exposure onset windows
          </p>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-surface-elevated p-1.5 rounded-lg border border-border">
          {(
            [
              { key: "co2", label: "CO₂ & Headache Lag", icon: Wind },
              { key: "radiation", label: "Radiation Fatigue", icon: Radio },
              { key: "humidity", label: "Dry Eye / Ocular", icon: Droplets },
              { key: "temperature", label: "Thermal Strain", icon: Flame },
              { key: "matrix", label: "5-Factor Matrix", icon: Layers },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeFactor === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFactor(tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isActive
                    ? "bg-surface-subtle text-foreground border border-border-strong"
                    : "text-muted hover:text-foreground hover:bg-surface-subtle"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Flight Rule Violations Banner */}
      {evaluation.activeFlightRules.length > 0 && (
        <div className="mt-5 p-4 rounded-lg bg-critical/5 border border-critical/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-critical shrink-0" />
            <div>
              <p className="text-xs font-semibold text-critical">
                {evaluation.activeFlightRules[0].ruleId}: {evaluation.activeFlightRules[0].title}
              </p>
              <p className="text-[11px] text-secondary mt-0.5">
                {evaluation.activeFlightRules[0].description}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider bg-transparent text-critical border border-critical/40 shrink-0">
            Active Warning
          </span>
        </div>
      )}

      {/* Dynamic Content Views */}
      <div className="mt-6">
        {/* TAB 1: CO2 & Delay Curve */}
        {activeFactor === "co2" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Curve 1: Probability of Headache */}
              <div className="p-5 rounded-lg bg-surface-elevated border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                      CO₂ Exposure vs. Headache Incidence Odds
                    </h3>
                    <p className="text-xs text-muted">
                      NASA LSDA Study #10.1097/JOM.0000000000000059
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-xl font-semibold text-foreground">
                      {evaluation.headacheProbabilityPct}%
                    </span>
                    <p className="text-[10px] text-muted">Current Risk ({evaluation.headacheRiskCategory})</p>
                  </div>
                </div>

                {/* SVG Curve Representation */}
                <div className="pt-2">
                  <div className="h-40 w-full flex items-end gap-2 border-b border-l border-border pb-1 pl-1">
                    {CO2_HEADACHE_CURVE.map((pt) => {
                      const isCurrent =
                        Math.abs(pt.ppm - currentMetrics.co2) < 400 ||
                        (currentMetrics.co2 > pt.ppm &&
                          pt === CO2_HEADACHE_CURVE[CO2_HEADACHE_CURVE.length - 1]);
                      const heightPct = (pt.probability / 80) * 100;
                      return (
                        <div key={pt.ppm} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <span className="text-[10px] font-mono text-muted opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5">
                            {pt.probability}%
                          </span>
                          <div
                            style={{ height: `${heightPct}%` }}
                            className={`w-full rounded-t-lg transition-colors ${
                              isCurrent ? "bg-foreground" : "bg-foreground/30 hover:bg-foreground/60"
                            }`}
                          />
                          <span className="text-[9px] font-mono text-muted truncate w-full text-center">
                            {pt.ppm}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-faint pt-1">
                    <span>1,970 PPM (Nominal)</span>
                    <span>CO₂ Partial Pressure (PPM)</span>
                    <span>5,920 PPM (Emergency)</span>
                  </div>
                </div>
              </div>

              {/* Curve 2: Biological Delay Lag Window */}
              <div className="p-5 rounded-lg bg-surface-elevated border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                      Biological Onset Latency (Intracranial Lag)
                    </h3>
                    <p className="text-xs text-muted">
                      Hours after cabin hypercapnic spike before headache reports peak
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-xl font-semibold text-foreground">1.5 - 2.0 h</span>
                    <p className="text-[10px] text-muted">Peak Window (84% Correlation)</p>
                  </div>
                </div>

                {/* Lag Distribution Bars */}
                <div className="space-y-2 pt-2">
                  {CO2_LAG_DATA.slice(0, 5).map((lag) => (
                    <div key={lag.delayHours} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-secondary">{lag.delayHours}</span>
                        <span className="text-foreground font-semibold">{lag.matchPercent}% match</span>
                      </div>
                      <div className="h-2 w-full bg-surface-subtle rounded-full overflow-hidden">
                        <div
                          style={{ width: `${lag.matchPercent}%` }}
                          className={`h-full rounded-full ${
                            lag.matchPercent > 80 ? "bg-foreground" : "bg-foreground/40"
                          }`}
                        />
                      </div>
                      <p className="text-[10px] text-muted">{lag.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Radiation Cellular Fatigue */}
        {activeFactor === "radiation" && (
          <div className="p-5 rounded-lg bg-surface-elevated border border-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                  NASA RadLab — Ionizing Dose vs. Cellular Fatigue Index (0–100)
                </h3>
                <p className="text-xs text-muted">
                  TEPC Dosimeter flux impact on microvascular tissue and circadian recovery
                </p>
              </div>
              <div className="text-right font-mono">
                <span className="text-xl font-semibold text-secondary">
                  Score: {evaluation.cellularFatigueIndex} / 100
                </span>
                <p className="text-[10px] text-muted">Active Dosimeter Burden</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2">
              {RADIATION_FATIGUE_CURVE.map((pt) => {
                const isCurrent = Math.abs(pt.dose - currentMetrics.radiation) < 0.05;
                return (
                  <div
                    key={pt.dose}
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      isCurrent
                        ? "bg-surface-elevated border-foreground/50 text-foreground"
                        : "bg-surface-subtle border-border text-secondary"
                    }`}
                  >
                    <span className="block text-xs font-mono font-semibold text-secondary">
                      {pt.dose.toFixed(2)} mGy
                    </span>
                    <span className="block text-lg font-semibold font-mono my-1">{pt.fatigueScore}</span>
                    <span className="block text-[10px] text-muted leading-tight">{pt.event}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: Humidity Dry Eye Curve */}
        {activeFactor === "humidity" && (
          <div className="p-5 rounded-lg bg-surface-elevated border border-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                  Cabin Relative Humidity vs. Keratoconjunctivitis (Dry Eye Rate)
                </h3>
                <p className="text-xs text-muted">
                  Tear film stability and mucosal dryness in forced microgravity ventilation
                </p>
              </div>
              <div className="text-right font-mono">
                <span className="text-xl font-semibold text-secondary">
                  {evaluation.mucosalIrritationRate}%
                </span>
                <p className="text-[10px] text-muted">Ocular Irritation Risk</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-2">
              {HUMIDITY_DRY_EYE_CURVE.map((pt) => {
                const isCurrent = Math.abs(pt.humidity - currentMetrics.humidity) < 4;
                return (
                  <div
                    key={pt.humidity}
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      isCurrent
                        ? "bg-surface-elevated border-foreground/50 text-foreground"
                        : "bg-surface-subtle border-border text-secondary"
                    }`}
                  >
                    <span className="block text-xs font-mono font-semibold text-secondary">
                      {pt.humidity}% RH
                    </span>
                    <span className="block text-lg font-semibold font-mono my-1">{pt.irritationRate}%</span>
                    <span className="block text-[10px] text-muted leading-tight">{pt.status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: Temperature & Exercise Thermal Strain */}
        {activeFactor === "temperature" && (
          <div className="p-5 rounded-lg bg-surface-elevated border border-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                  Cabin Temp vs. Core Heat Rise During Daily 2.5h Workout
                </h3>
                <p className="text-xs text-muted">
                  Lack of natural convection traps sweat film, increasing thermoregulatory strain
                </p>
              </div>
              <div className="text-right font-mono">
                <span className="text-xl font-semibold text-foreground">
                  +{evaluation.exerciseCoreHeatRiseDegC} °C
                </span>
                <p className="text-[10px] text-muted">
                  Recovery: ~{evaluation.exerciseRecoveryMinutes} mins
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
              {TEMPERATURE_STRAIN_CURVE.map((pt) => {
                const isCurrent = Math.abs(pt.cabinTemp - currentMetrics.temp) < 0.8;
                return (
                  <div
                    key={pt.cabinTemp}
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      isCurrent
                        ? "bg-surface-elevated border-foreground/50 text-foreground"
                        : "bg-surface-subtle border-border text-secondary"
                    }`}
                  >
                    <span className="block text-xs font-mono font-semibold text-foreground">
                      {pt.cabinTemp.toFixed(1)} °C
                    </span>
                    <span className="block text-lg font-semibold font-mono my-1">
                      +{pt.coreTempRise} °C
                    </span>
                    <span className="block text-[10px] text-muted leading-tight">
                      {pt.recoveryMinutes}m recov · {pt.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: Comprehensive 5-Factor Matrix */}
        {activeFactor === "matrix" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted font-mono uppercase tracking-wider text-[10px]">
                  <th className="p-3">Environmental Factor</th>
                  <th className="p-3">Nominal Band</th>
                  <th className="p-3">Current Telemetry</th>
                  <th className="p-3">Clinical Biological Mechanism</th>
                  <th className="p-3">Latency Lag</th>
                  <th className="p-3">Onboard Countermeasure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                <tr className="hover:bg-surface-subtle transition-colors">
                  <td className="p-3 font-medium text-foreground flex items-center gap-1.5">
                    <Wind className="w-3.5 h-3.5 text-muted" /> Carbon Dioxide (ppCO₂)
                  </td>
                  <td className="p-3 font-mono text-muted">&lt; 2,500 PPM</td>
                  <td className="p-3 font-mono font-semibold text-foreground">{currentMetrics.co2} PPM</td>
                  <td className="p-3 text-secondary">
                    Cephalic fluid shift triggers frontal throbbing headaches &amp; mental fog
                  </td>
                  <td className="p-3 font-mono text-foreground">1.5 to 2.0 Hours</td>
                  <td className="p-3 text-muted">
                    Activate personal diffuser fan, drink 500 mL water, move to Destiny Lab
                  </td>
                </tr>
                <tr className="hover:bg-surface-subtle transition-colors">
                  <td className="p-3 font-medium text-foreground flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-muted" /> Space Radiation (TEPC)
                  </td>
                  <td className="p-3 font-mono text-muted">&lt; 0.22 mGy/day</td>
                  <td className="p-3 font-mono font-semibold text-foreground">{currentMetrics.radiation} mGy/d</td>
                  <td className="p-3 text-secondary">
                    Cellular DNA repair burden, microvascular fatigue, circadian sleep fragmentation
                  </td>
                  <td className="p-3 font-mono text-secondary">6 to 12 Hours</td>
                  <td className="p-3 text-muted">
                    Rest in water-wall shielded Crew Quarters, confirm dosimeter alignment
                  </td>
                </tr>
                <tr className="hover:bg-surface-subtle transition-colors">
                  <td className="p-3 font-medium text-foreground flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-muted" /> Relative Humidity
                  </td>
                  <td className="p-3 font-mono text-muted">40% – 55%</td>
                  <td className="p-3 font-mono font-semibold text-foreground">{currentMetrics.humidity}%</td>
                  <td className="p-3 text-secondary">
                    Tear film evaporation, keratoconjunctivitis (dry eyes), foreign particle irritation
                  </td>
                  <td className="p-3 font-mono text-secondary">30 to 45 Minutes</td>
                  <td className="p-3 text-muted">
                    Apply preservative-free artificial tears, point diffuser nozzles away from eyes
                  </td>
                </tr>
                <tr className="hover:bg-surface-subtle transition-colors">
                  <td className="p-3 font-medium text-foreground flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-muted" /> Cabin Temperature
                  </td>
                  <td className="p-3 font-mono text-muted">21.0°C – 24.0°C</td>
                  <td className="p-3 font-mono font-semibold text-foreground">{currentMetrics.temp} °C</td>
                  <td className="p-3 text-secondary">
                    Absence of natural convection traps sweat layer against skin, raising heart rate
                  </td>
                  <td className="p-3 font-mono text-foreground">During &amp; Post Workout</td>
                  <td className="p-3 text-muted">
                    Pre-cool module to 21°C before T2/CEVIS workouts, wear liquid cooling vest
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
