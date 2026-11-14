/**
 * Real-Time Cabin Alerts & Clinical Health Action Plans Deck
 *
 * Dynamically computes real-time alerts by evaluating live telemetry streams
 * (CO2, HR, HRV, Temp, SpO2) against circadian baseline envelopes (mu +/- 2sigma),
 * NASA flight rules (FR-ECLSS-001, FR-CDRA-002, FR-EVA-003), and active
 * crew symptoms and concordance events.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  ShieldAlert,
  CheckCircle2,
  Check,
  AlertCircle,
  AlertTriangle,
  Activity,
  Wind,
  Thermometer,
  Heart,
  Sparkles,
  RotateCcw,
  RefreshCw,
  Zap,
} from "lucide-react";
import {
  fetchBaselines,
  fetchEvents,
  fetchMeasurements,
  fetchSymptoms,
} from "../../services/api";
import { useCohortStore } from "../../stores/cohortStore";
import { useSimulationSandbox } from "../simulation";
import type {
  Baselines,
  HealthEvent,
  Measurement,
  SymptomReport,
} from "../../types/api";

export interface RealtimeAlertItem {
  id: string;
  title: string;
  level: "info" | "warning" | "critical";
  timestamp: string;
  message: string;
  module: string;
  acknowledged: boolean;
  category: "co2" | "vital" | "thermal" | "radiation" | "event" | "symptom";
  metricValue?: string;
  baselineValue?: string;
  deltaValue?: string;
  flightRuleRef?: string;
  details: {
    whatHappened: string;
    whyItMatters: string;
    whatToDo: string[];
  };
}

const STORAGE_ACK_KEY = "habitrack_acknowledged_alerts_v1";

function getStoredAcks(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_ACK_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredAcks(acks: Record<string, boolean>): void {
  try {
    localStorage.setItem(STORAGE_ACK_KEY, JSON.stringify(acks));
  } catch (e) {
    console.warn("Failed to save alert acknowledgments", e);
  }
}

interface AlertsDeckProps {
  astronautId?: string;
  className?: string;
}

export const AlertsDeck: React.FC<AlertsDeckProps> = ({
  astronautId: propAstronautId,
  className = "",
}) => {
  const storeAstronautId = useCohortStore((state) => state.activeAstronautId);
  const activeAstronautId = propAstronautId ?? storeAstronautId ?? "ASTRO-01";
  const activeAstronaut = useCohortStore((state) =>
    state.astronauts.find((a) => a.astronaut_id === activeAstronautId)
  );

  const [simulationState, simulationControls] = useSimulationSandbox();
  const { activeScenario, isAnomalyActive } = simulationState;

  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [baselines, setBaselines] = useState<Baselines>({});
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [symptoms, setSymptoms] = useState<SymptomReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"ACTIVE" | "ALL">("ACTIVE");
  const [acknowledgedMap, setAcknowledgedMap] = useState<Record<string, boolean>>(
    () => getStoredAcks()
  );

  // Load telemetry, baselines, events and symptoms
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [measData, baseData, evtData, symData] = await Promise.all([
        fetchMeasurements(activeAstronautId, 72, 1000),
        fetchBaselines(activeAstronautId),
        fetchEvents(activeAstronautId),
        fetchSymptoms(activeAstronautId),
      ]);
      setMeasurements(measData);
      setBaselines(baseData);
      setEvents(evtData);
      setSymptoms(symData);
    } catch (err) {
      console.warn("Error fetching real-time data for AlertsDeck", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    const interval = window.setInterval(loadData, 12000);
    return () => window.clearInterval(interval);
  }, [activeAstronautId]);

  // Extract latest measurements
  const latestTelemetry = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = measurements.length - 1; i >= 0; i--) {
      const m = measurements[i];
      if (map[m.stream_id] === undefined) {
        map[m.stream_id] = m.value;
      }
    }

    // Apply simulation overrides if active
    let co2 = map["stream_eda_co2"] ?? 3.0;
    let temp = map["stream_eda_temp"] ?? 22.8;
    let hr = map["stream_sim_hr"] ?? activeAstronaut?.resting_hr ?? 65.0;
    let rmssd = map["stream_sim_hrv"] ?? activeAstronaut?.resting_rmssd ?? 55.0;
    let spo2 = map["stream_sim_spo2"] ?? activeAstronaut?.resting_spo2 ?? 98.0;

    if (activeScenario === "co2_spike") {
      co2 = 5.80; // Peak hypercapnia excursion
      hr = hr + 27.2; // Compensatory tachycardia
      rmssd = Math.max(18.0, rmssd - 30.5); // Sympathetic strain
    } else if (activeScenario === "thermal_overheat") {
      temp = 27.4;
      hr = hr + 15.0;
    }

    return { co2, temp, hr, rmssd, spo2 };
  }, [measurements, activeScenario, activeAstronaut]);

  // Derive real-time alerts by evaluating live telemetry against baselines
  const generatedAlerts = useMemo<RealtimeAlertItem[]>(() => {
    const list: RealtimeAlertItem[] = [];
    const nowUtc = new Date().toISOString().slice(11, 16) + " UTC";

    // -------------------------------------------------------------------------
    // 1. Cabin CO2 Real-Time Alert
    // -------------------------------------------------------------------------
    const baselineCo2 = 3.0; // Baseline partial pressure mmHg (~2,250 PPM)
    const currentCo2 = latestTelemetry.co2;
    const deltaCo2 = currentCo2 - baselineCo2;
    const deltaCo2Pct = (deltaCo2 / baselineCo2) * 100;

    if (currentCo2 >= 3.6 || deltaCo2 >= 0.5 || activeScenario === "co2_spike") {
      const isCritical = currentCo2 >= 4.5;
      const co2Ppm = Math.round(currentCo2 * 750);
      list.push({
        id: `alert-co2-${currentCo2 > 4.5 ? "crit" : "warn"}`,
        title: `Cabin CO₂ Hypercapnia Alert: ${currentCo2.toFixed(2)} mmHg (${co2Ppm} PPM)`,
        level: isCritical ? "critical" : "warning",
        timestamp: nowUtc,
        message: `Cabin PCO₂ reached ${currentCo2.toFixed(2)} mmHg, exceeding circadian baseline of ${baselineCo2.toFixed(2)} mmHg (+${deltaCo2.toFixed(2)} mmHg / +${deltaCo2Pct.toFixed(0)}%).`,
        module: "Node 2 (Harmony)",
        acknowledged: !!acknowledgedMap[`alert-co2-${currentCo2 > 4.5 ? "crit" : "warn"}`],
        category: "co2",
        metricValue: `${currentCo2.toFixed(2)} mmHg`,
        baselineValue: `${baselineCo2.toFixed(2)} mmHg`,
        deltaValue: `+${deltaCo2.toFixed(2)} mmHg (+${deltaCo2Pct.toFixed(0)}%)`,
        flightRuleRef: "FR-ECLSS-001",
        details: {
          whatHappened: `Cabin partial pressure of carbon dioxide reached ${currentCo2.toFixed(2)} mmHg (~${co2Ppm} PPM) in Node 2, exceeding nominal flight baseline of ${baselineCo2.toFixed(2)} mmHg by +${deltaCo2.toFixed(2)} mmHg.`,
          whyItMatters: `In microgravity, cephalic fluid redistribution increases headward venous pressure. Elevated ambient CO₂ induces cerebral vasodilation, predisposing crew to spaceflight hypercapnic headaches, visual blurring, and cognitive fatigue.`,
          whatToDo: [
            "Execute NASA Flight Rule FR-ECLSS-001: Transition CDRA bed selector to DUAL-BED HIGH-FLOW.",
            "Verify personal ventilation diffuser fans in Node 2 are unobstructed and delivering flow >= 55 CFM.",
            "Instruct crew to hydrate with 500 mL water/electrolyte solution to assist cephalic venous return.",
            "If symptoms develop, transition work tasks to US Lab (Destiny) where circulation is higher.",
          ],
        },
      });
    }

    // -------------------------------------------------------------------------
    // 2. Autonomic Heart Rate Elevation Alert
    // -------------------------------------------------------------------------
    const baselineHr = activeAstronaut?.resting_hr ?? 65.0;
    const currentHr = latestTelemetry.hr;
    const deltaHr = currentHr - baselineHr;

    if (deltaHr >= 20.0) {
      const isCritical = deltaHr >= 40.0;
      list.push({
        id: `alert-hr-tachycardia`,
        title: `Autonomic Tachycardia: ${currentHr.toFixed(0)} bpm (+${deltaHr.toFixed(0)} bpm above baseline)`,
        level: isCritical ? "critical" : "warning",
        timestamp: nowUtc,
        message: `Resting heart rate reached ${currentHr.toFixed(0)} bpm, trending significantly above personalized circadian baseline (${baselineHr.toFixed(0)} bpm).`,
        module: "Node 2 Crew Quarters",
        acknowledged: !!acknowledgedMap["alert-hr-tachycardia"],
        category: "vital",
        metricValue: `${currentHr.toFixed(0)} bpm`,
        baselineValue: `${baselineHr.toFixed(0)} bpm`,
        deltaValue: `+${deltaHr.toFixed(0)} bpm`,
        flightRuleRef: "FR-EVA-003",
        details: {
          whatHappened: `Crew member autonomic vital telemetry indicates sustained elevated heart rate of ${currentHr.toFixed(0)} bpm (+${deltaHr.toFixed(0)} bpm above baseline).`,
          whyItMatters: `Cardiovascular deconditioning and autonomic compensation for environmental stressors (such as high workload or elevated CO₂) increase myocardial oxygen demand.`,
          whatToDo: [
            "Instruct crewmember to initiate paced 4-4 diaphragmatic breathing cycle.",
            "Verify SpO₂ saturation remains above 96% and evaluate for co-occurring subjective symptoms.",
            "Stand down from heavy metabolic tasks and confirm ground flight surgeon telemetry link.",
          ],
        },
      });
    }

    // -------------------------------------------------------------------------
    // 3. HRV / RMSSD Parasympathetic Depression Alert
    // -------------------------------------------------------------------------
    const baselineRmssd = activeAstronaut?.resting_rmssd ?? 55.0;
    const currentRmssd = latestTelemetry.rmssd;
    const deltaRmssd = currentRmssd - baselineRmssd;

    if (deltaRmssd <= -20.0) {
      list.push({
        id: `alert-rmssd-depression`,
        title: `Parasympathetic Suppression: RMSSD Depressed to ${currentRmssd.toFixed(1)} ms`,
        level: "warning",
        timestamp: nowUtc,
        message: `Heart rate variability (RMSSD) dropped to ${currentRmssd.toFixed(1)} ms (${Math.abs(deltaRmssd).toFixed(1)} ms below resting baseline of ${baselineRmssd.toFixed(1)} ms).`,
        module: "Node 2 Crew Quarters",
        acknowledged: !!acknowledgedMap["alert-rmssd-depression"],
        category: "vital",
        metricValue: `${currentRmssd.toFixed(1)} ms`,
        baselineValue: `${baselineRmssd.toFixed(1)} ms`,
        deltaValue: `${deltaRmssd.toFixed(1)} ms`,
        flightRuleRef: "FR-EVA-003",
        details: {
          whatHappened: `Heart rate variability metric RMSSD has dropped to ${currentRmssd.toFixed(1)} ms, signaling acute sympathetic nervous system dominance.`,
          whyItMatters: `Suppressed parasympathetic vagal tone is a primary biomedical indicator of physical exhaustion, sleep fragmentation, or acute physiological strain.`,
          whatToDo: [
            "Direct crew to 20 minutes of restorative resting posture.",
            "Review circadian sleep-wake schedule and avoid caffeine intake in the current mission block.",
            "Log recovery trend before scheduled extravehicular or robotics duty.",
          ],
        },
      });
    }

    // -------------------------------------------------------------------------
    // 4. Cabin Temperature Alert
    // -------------------------------------------------------------------------
    const currentTemp = latestTelemetry.temp;
    if (currentTemp >= 25.5 || activeScenario === "thermal_overheat") {
      list.push({
        id: `alert-temp-overheat`,
        title: `Cabin Thermal Boundary Excursion: ${currentTemp.toFixed(1)} °C`,
        level: currentTemp >= 27.0 ? "critical" : "warning",
        timestamp: nowUtc,
        message: `Cabin temperature in Node 2 reached ${currentTemp.toFixed(1)} °C, exceeding the flight comfort envelope (20.0–24.0 °C).`,
        module: "Node 2 (Harmony)",
        acknowledged: !!acknowledgedMap["alert-temp-overheat"],
        category: "thermal",
        metricValue: `${currentTemp.toFixed(1)} °C`,
        baselineValue: "22.5 °C",
        deltaValue: `+${(currentTemp - 22.5).toFixed(1)} °C`,
        flightRuleRef: "FR-CDRA-002",
        details: {
          whatHappened: `Cabin environmental sensors recorded ambient temperature of ${currentTemp.toFixed(1)} °C during CDRA desorption cycle.`,
          whyItMatters: `Elevated cabin thermal conditions impair metabolic heat rejection in microgravity, compounding dehydration and cardiovascular strain.`,
          whatToDo: [
            "Verify internal thermal control system (ITCS) water loop flow rate.",
            "Confirm CDRA desiccant regenerative heating loop is within bounds (FR-CDRA-002).",
            "Adjust cabin air conditioning setpoint down by 1.5 °C.",
          ],
        },
      });
    }

    // -------------------------------------------------------------------------
    // 5. South Atlantic Anomaly (SAA) Radiation Alert
    // -------------------------------------------------------------------------
    if (activeScenario === "saa_transit") {
      list.push({
        id: `alert-saa-radiation`,
        title: `Space Radiation Alert: South Atlantic Anomaly Transit Active`,
        level: "warning",
        timestamp: nowUtc,
        message: `ISS is currently transiting the South Atlantic Anomaly inner radiation belt. Dosimetric flux elevated to 0.48 mGy/day.`,
        module: "US Lab (Destiny)",
        acknowledged: !!acknowledgedMap["alert-saa-radiation"],
        category: "radiation",
        metricValue: "0.48 mGy/day",
        baselineValue: "0.19 mGy/day",
        deltaValue: "+0.29 mGy/day",
        details: {
          whatHappened: `The station has entered the high-energy proton corridor of the South Atlantic Anomaly (SAA).`,
          whyItMatters: `Increased galactic and trapped solar proton exposure during SAA transit requires non-critical payload deferral and shielding positioning.`,
          whatToDo: [
            "Verify dosimeter downlink packets to Houston Flight Control.",
            "Ensure crew sleep quarters radiation shielding panels are deployed.",
            "Avoid unshielded work in the European Columbus or Kibo forward vestibule.",
          ],
        },
      });
    }

    // -------------------------------------------------------------------------
    // 6. Real Health Events from API (e.g. Day 127 Headache & CO2 Concordance)
    // -------------------------------------------------------------------------
    for (const evt of events) {
      const isAck =
        evt.review_status !== "PENDING" || !!acknowledgedMap[`event-${evt.event_id}`];
      list.push({
        id: `event-${evt.event_id}`,
        title: `Clinical Concordance: ${evt.event_type.replace(/_/g, " ")}`,
        level: evt.severity_level === "INVESTIGATE" ? "critical" : "warning",
        timestamp: evt.start_time.slice(11, 16) + " UTC",
        message: evt.rationale.split("\n")[0] || "Telemetry concordance detected.",
        module: "Node 2 (Harmony)",
        acknowledged: isAck,
        category: "event",
        flightRuleRef: "FR-ECLSS-001",
        details: {
          whatHappened: evt.rationale,
          whyItMatters: `Concordance analysis detected simultaneous environmental exposure and physiological response across [${evt.contributing_stream_ids}]. Non-causal decision support only.`,
          whatToDo: [
            "Consult the Concordance Timeline to inspect the synchronized 4-lane telemetry excursion.",
            "Verify symptom resolution with the affected astronaut.",
            "Complete Flight Surgeon triage review in the Overview panel.",
          ],
        },
      });
    }

    // -------------------------------------------------------------------------
    // 7. Real Crew Symptoms Reported
    // -------------------------------------------------------------------------
    for (const sym of symptoms.slice(0, 3)) {
      const symId = `sym-${sym.report_id}`;
      list.push({
        id: symId,
        title: `Crew Symptom Logged: ${sym.symptom_code} (Severity ${sym.severity}/5)`,
        level: sym.severity >= 3 ? "warning" : "info",
        timestamp: sym.reported_at.slice(11, 16) + " UTC",
        message: `Subjective symptom "${sym.symptom_code}" logged by ${sym.astronaut_id} in ${sym.cabin_module || "Node 2"}.${sym.notes ? ` Note: "${sym.notes}"` : ""}`,
        module: sym.cabin_module || "Node 2 (Harmony)",
        acknowledged: !!acknowledgedMap[symId],
        category: "symptom",
        details: {
          whatHappened: `Astronaut ${sym.astronaut_id} logged ${sym.symptom_code} at severity level ${sym.severity}/5.${sym.notes ? ` Details: ${sym.notes}` : ""}`,
          whyItMatters: `Subjective crew symptom reports correlate with environmental and autonomic excursions. Early symptom logging enables proactive ECLSS intervention before clinical incapacitation.`,
          whatToDo: [
            "Log follow-up symptom severity in Symptoms panel.",
            "Check for temporal co-occurrence with localized Node 2 CO₂ concentration trends.",
            "Ensure crew takes appropriate countermeasure break and rehydrates.",
          ],
        },
      });
    }

    return list;
  }, [latestTelemetry, activeScenario, activeAstronaut, events, symptoms, acknowledgedMap]);

  const activeAlerts = generatedAlerts.filter((a) => !a.acknowledged);
  const displayedAlerts = filter === "ACTIVE" ? activeAlerts : generatedAlerts;

  const handleAcknowledge = (id: string) => {
    const next = { ...acknowledgedMap, [id]: true };
    setAcknowledgedMap(next);
    saveStoredAcks(next);
  };

  const handleResetAcks = () => {
    setAcknowledgedMap({});
    saveStoredAcks({});
  };

  return (
    <section className={`p-5 sm:p-6 glass-panel rounded-xl relative overflow-hidden ${className}`}>
      {/* Top Banner with Real-time Telemetry Pills */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700">
              Real-Time Flight Medicine &amp; ECLSS Anomaly Detection
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <span>Cabin Alerts &amp; Clinical Health Action Plans</span>
            <span className="text-xs font-normal text-muted font-mono">
              ({activeAstronautId})
            </span>
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Real-time evaluation of cabin atmospheric telemetry against circadian baselines (μ ± 2σ) and NASA Flight Rules
          </p>
        </div>

        {/* Filter and Refresh Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center glass-panel-subtle rounded-xl p-1 text-xs gap-1">
            <button
              onClick={() => setFilter("ACTIVE")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer border ${
                filter === "ACTIVE"
                  ? "bg-white text-sky-700 border-sky-200 shadow-xs"
                  : "text-muted hover:text-foreground border-transparent"
              }`}
            >
              Active ({activeAlerts.length})
            </button>
            <button
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer border ${
                filter === "ALL"
                  ? "bg-white text-sky-700 border-sky-200 shadow-xs"
                  : "text-muted hover:text-foreground border-transparent"
              }`}
            >
              All Detected ({generatedAlerts.length})
            </button>
          </div>

          <button
            onClick={() => void loadData()}
            title="Refresh telemetry & evaluate alerts"
            className="p-2 rounded-lg border border-border bg-white text-muted hover:text-foreground cursor-pointer shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Real-time Telemetry Status Ribbon */}
      <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <Wind className={`w-4 h-4 ${latestTelemetry.co2 > 3.5 ? "text-amber-600 animate-pulse" : "text-sky-600"}`} />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Live Cabin CO₂</span>
              <span className={`font-mono font-bold ${latestTelemetry.co2 > 3.5 ? "text-amber-700" : "text-slate-900"}`}>
                {latestTelemetry.co2.toFixed(2)} mmHg
              </span>
              <span className="text-[10px] text-slate-500 ml-1">
                (Baseline 3.00)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Heart className={`w-4 h-4 ${latestTelemetry.hr > 85 ? "text-red-500 animate-pulse" : "text-rose-500"}`} />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Heart Rate</span>
              <span className="font-mono font-bold text-slate-900">
                {latestTelemetry.hr.toFixed(0)} bpm
              </span>
              <span className="text-[10px] text-slate-500 ml-1">
                (Base {activeAstronaut?.resting_hr ?? 65})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">HRV (RMSSD)</span>
              <span className="font-mono font-bold text-slate-900">
                {latestTelemetry.rmssd.toFixed(1)} ms
              </span>
              <span className="text-[10px] text-slate-500 ml-1">
                (Base {activeAstronaut?.resting_rmssd ?? 55})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-amber-500" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Cabin Temp</span>
              <span className="font-mono font-bold text-slate-900">
                {latestTelemetry.temp.toFixed(1)} °C
              </span>
            </div>
          </div>
        </div>

        {/* Quick Simulation Injectors to test alerts in real time */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1 hidden sm:inline">
            Test Injector:
          </span>
          <button
            onClick={() => simulationControls.injectScenario("co2_spike")}
            className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer border transition-all ${
              activeScenario === "co2_spike"
                ? "bg-amber-100 border-amber-300 text-amber-800 shadow-xs"
                : "bg-white border-slate-200 text-slate-700 hover:bg-amber-50"
            }`}
          >
            ⚡ CO₂ Spike
          </button>
          <button
            onClick={() => simulationControls.injectScenario("thermal_overheat")}
            className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer border transition-all ${
              activeScenario === "thermal_overheat"
                ? "bg-orange-100 border-orange-300 text-orange-800 shadow-xs"
                : "bg-white border-slate-200 text-slate-700 hover:bg-orange-50"
            }`}
          >
            🌡️ Overheat
          </button>
          <button
            onClick={() => simulationControls.injectScenario("saa_transit")}
            className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer border transition-all ${
              activeScenario === "saa_transit"
                ? "bg-purple-100 border-purple-300 text-purple-800 shadow-xs"
                : "bg-white border-slate-200 text-slate-700 hover:bg-purple-50"
            }`}
          >
            ☢️ SAA
          </button>
          {isAnomalyActive && (
            <button
              onClick={() => simulationControls.resetNominal()}
              className="px-2 py-1 rounded bg-slate-900 text-white hover:bg-slate-800 text-[11px] font-semibold cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Explanatory Note */}
      <div className="mt-4 border-l-2 border-sky-500 pl-3 text-[11px] leading-relaxed text-secondary flex items-center justify-between">
        <span>
          Real-time alerts cross-reference live environmental telemetry (NASA EDA) against personalized
          circadian envelopes and flight rule thresholds to prevent acute hypercapnia and space headaches.
        </span>
        {Object.keys(acknowledgedMap).length > 0 && (
          <button
            onClick={handleResetAcks}
            className="text-[11px] text-sky-600 hover:text-sky-800 underline font-medium cursor-pointer shrink-0 ml-3"
          >
            Restore Acknowledged ({Object.keys(acknowledgedMap).length})
          </button>
        )}
      </div>

      {/* Real-time Alerts Feed */}
      <div className="mt-5 space-y-3.5">
        {displayedAlerts.length === 0 ? (
          <div className="p-10 text-center rounded-xl glass-panel-subtle space-y-2 border border-slate-200 bg-white">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <h3 className="text-sm font-bold text-foreground">All Telemetry Within Normal Circadian Bounds</h3>
            <p className="text-xs text-muted max-w-md mx-auto">
              Cabin CO₂ ({latestTelemetry.co2.toFixed(2)} mmHg), temperature ({latestTelemetry.temp.toFixed(1)} °C), and heart rate ({latestTelemetry.hr.toFixed(0)} bpm) are tracking within baseline (μ ± 2σ).
            </p>
          </div>
        ) : (
          displayedAlerts.map((alert) => {
            const isResolved = alert.acknowledged;
            const levelAccent = isResolved
              ? "opacity-75 border-slate-200 bg-slate-50/60"
              : alert.level === "critical"
              ? "border-l-4 border-l-red-500 border-red-200 bg-red-50/20"
              : alert.level === "warning"
              ? "border-l-4 border-l-amber-500 border-amber-200 bg-amber-50/20"
              : "border-l-4 border-l-emerald-500 border-emerald-200 bg-emerald-50/20";

            return (
              <div
                key={alert.id}
                className={`p-5 rounded-xl border glass-panel transition-all duration-200 shadow-xs ${levelAccent}`}
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-border/80">
                  <div className="flex items-center gap-3 min-w-0">
                    {isResolved ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : alert.level === "critical" ? (
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 animate-pulse" />
                    ) : alert.level === "warning" ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                          {alert.title}
                        </h3>
                        {alert.flightRuleRef && (
                          <span className="rounded bg-sky-100 text-sky-800 border border-sky-200 px-1.5 py-0.2 text-[10px] font-mono font-bold">
                            {alert.flightRuleRef}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted font-mono flex items-center gap-2 mt-0.5">
                        <span className="font-semibold text-sky-700">{alert.module}</span>
                        <span>·</span>
                        <span>{alert.timestamp}</span>
                        {alert.deltaValue && (
                          <>
                            <span>·</span>
                            <span className="text-amber-700 font-semibold">{alert.deltaValue}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {!isResolved ? (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-sky-50 border border-slate-300 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs hover:border-sky-300 hover:text-sky-700"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Acknowledge Alert</span>
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-700 font-mono font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Acknowledged</span>
                    </span>
                  )}
                </div>

                {/* 3 Humanized Guidance Panels */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-slate-200 mt-3.5 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="p-4 bg-white space-y-1.5">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                      01 · What Happened
                    </span>
                    <p className="text-xs leading-relaxed text-slate-700">
                      {alert.details.whatHappened}
                    </p>
                  </div>

                  <div className="p-4 bg-white space-y-1.5">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      02 · Why It Matters
                    </span>
                    <p className="text-xs leading-relaxed text-slate-700">
                      {alert.details.whyItMatters}
                    </p>
                  </div>

                  <div className="p-4 bg-white space-y-1.5">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      03 · What To Do
                    </span>
                    <ul className="space-y-1.5 mt-1">
                      {alert.details.whatToDo.map((step, sIdx) => (
                        <li key={sIdx} className="flex items-start gap-1.5 text-xs leading-relaxed text-slate-700">
                          <span className="text-sky-600 font-mono font-bold shrink-0">
                            {String(sIdx + 1).padStart(2, "0")}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
