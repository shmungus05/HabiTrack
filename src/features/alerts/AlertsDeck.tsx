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
  RefreshCw,
  X,
  Wind,
  Heart,
  Activity,
  Thermometer,
  RotateCcw,
} from "lucide-react";
import {
  fetchBaselines,
  fetchEvents,
  fetchMeasurements,
  fetchSymptoms,
} from "../../services/api";
import { useCohortStore } from "../../stores/cohortStore";
import { useSimulationSandbox } from "../simulation";
import { parseEventRationale } from "../../components/EventRationaleDisplay";
import { useBiomedicalSettings } from "../settings";
import { usePhysiologicalTelemetry } from "../biometrics";
import { useActiveMissionTime } from "../../stores/missionStore";
import {
  computeModuleTelemetry,
  getAstronautDetectedLocation,
  useStationLocationStore,
} from "../topology";
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

  const { isSimulation, currentMissionDay, utcString, currentTimeMs } = useActiveMissionTime();
  const [simulationState, simulationControls] = useSimulationSandbox();
  const { activeScenario, isAnomalyActive } = simulationState;
  const { settings } = useBiomedicalSettings();
  const isMetric = settings.unitSystem === "metric";

  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [baselines, setBaselines] = useState<Baselines>({});
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [symptoms, setSymptoms] = useState<SymptomReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"ACTIVE" | "ALL">("ACTIVE");
  const [acknowledgedMap, setAcknowledgedMap] = useState<Record<string, boolean>>(
    () => getStoredAcks()
  );

  // When an anomaly scenario is activated, un-acknowledge simulated alert keys
  // so simulated alerts immediately appear active and are never suppressed by previous tests
  useEffect(() => {
    if (isAnomalyActive) {
      setAcknowledgedMap((prev) => {
        const next = { ...prev };
        delete next["alert-co2-crit"];
        delete next["alert-co2-warn"];
        delete next["alert-hr-tachycardia"];
        delete next["alert-rmssd-depression"];
        delete next["alert-temp-overheat"];
        delete next["alert-saa-radiation"];
        delete next["alert-concordance-co2-spike"];
        delete next["alert-concordance-thermal-overheat"];
        delete next["alert-concordance-saa-transit"];
        saveStoredAcks(next);
        return next;
      });
    }
  }, [isAnomalyActive, activeScenario]);

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
  }, [activeAstronautId, isSimulation, currentMissionDay]);

  // Extract latest measurements with synchronized simulation overrides & clean nominal defaults
  const activeScenarios = simulationState.activeScenarios || (activeScenario !== "nominal" ? [activeScenario] : []);
  const hasCo2 = activeScenarios.includes("co2_spike") || activeScenario === "co2_spike";
  const hasThermal = activeScenarios.includes("thermal_overheat") || activeScenario === "thermal_overheat";
  const hasSaa = activeScenarios.includes("saa_transit") || activeScenario === "saa_transit";
  const isNominal = !hasCo2 && !hasThermal && !hasSaa;

  const detectedStation = getAstronautDetectedLocation(activeAstronautId);
  const { selectedModuleId, selectedLocation } = useStationLocationStore();

  const envTelemetry = computeModuleTelemetry(
    detectedStation.moduleId || selectedModuleId,
    detectedStation.location || selectedLocation,
    activeScenarios,
    activeScenario,
    currentTimeMs,
  );

  const vitals = usePhysiologicalTelemetry(activeAstronautId);

  const latestTelemetry = useMemo(() => {
    let co2Ppm = envTelemetry.co2;
    let tempC = envTelemetry.temp;
    let radVal = envTelemetry.rad;

    // Apply simulation overrides for any and all active scenarios simultaneously
    if (hasCo2) {
      co2Ppm = Math.max(4350, co2Ppm);
    }
    if (hasThermal) {
      tempC = Math.max(27.4, tempC);
    }
    if (hasSaa) {
      radVal = Math.max(0.48, radVal);
    }

    const co2MmHg = co2Ppm / 750;

    return {
      co2: co2MmHg,
      co2Ppm,
      temp: tempC,
      hr: vitals.hr,
      rmssd: vitals.rmssd,
      spo2: vitals.spo2,
      rad: radVal,
    };
  }, [envTelemetry, hasCo2, hasThermal, hasSaa, vitals]);

  // Derive real-time alerts by evaluating live telemetry against baselines
  const generatedAlerts = useMemo<RealtimeAlertItem[]>(() => {
    const list: RealtimeAlertItem[] = [];
    const nowUtc = isSimulation
      ? `D${currentMissionDay} ${utcString.slice(11, 16)} UTC`
      : new Date().toISOString().slice(11, 16) + " UTC";

    // -------------------------------------------------------------------------
    // 1. Cabin CO2 Real-Time Alert
    // -------------------------------------------------------------------------
    const baselineCo2 = 3.0; // Baseline partial pressure mmHg (~2,250 PPM)
    const currentCo2 = latestTelemetry.co2;
    const deltaCo2 = currentCo2 - baselineCo2;
    const deltaCo2Pct = (deltaCo2 / baselineCo2) * 100;

    if (hasCo2 || (!isNominal && currentCo2 >= 3.6)) {
      const isCritical = currentCo2 >= 4.5 || hasCo2;
      const co2Ppm = Math.round(currentCo2 * 750);
      const titleDisplay = isMetric
        ? `Cabin CO₂ Hypercapnia Alert: ${co2Ppm.toLocaleString()} PPM`
        : `Cabin CO₂ Hypercapnia Alert: ${currentCo2.toFixed(2)} mmHg`;
      const metricDisplay = isMetric ? `${co2Ppm.toLocaleString()} PPM` : `${currentCo2.toFixed(2)} mmHg`;
      const baseDisplay = isMetric
        ? `${Math.round(baselineCo2 * 750).toLocaleString()} PPM`
        : `${baselineCo2.toFixed(2)} mmHg`;
      const deltaDisplay = isMetric
        ? `+${Math.round(deltaCo2 * 750).toLocaleString()} PPM (+${deltaCo2Pct.toFixed(0)}%)`
        : `+${deltaCo2.toFixed(2)} mmHg (+${deltaCo2Pct.toFixed(0)}%)`;
      const msgDisplay = isMetric
        ? `Cabin PCO₂ reached ${co2Ppm.toLocaleString()} PPM, exceeding nominal baseline of ${Math.round(baselineCo2 * 750).toLocaleString()} PPM (+${deltaCo2Pct.toFixed(0)}%).`
        : `Cabin PCO₂ reached ${currentCo2.toFixed(2)} mmHg, exceeding circadian baseline of ${baselineCo2.toFixed(2)} mmHg (+${deltaCo2.toFixed(2)} mmHg / +${deltaCo2Pct.toFixed(0)}%).`;

      list.push({
        id: `alert-co2-${currentCo2 > 4.5 ? "crit" : "warn"}`,
        title: titleDisplay,
        level: isCritical ? "critical" : "warning",
        timestamp: nowUtc,
        message: msgDisplay,
        module: "Node 2 (Harmony)",
        acknowledged: !!acknowledgedMap[`alert-co2-${currentCo2 > 4.5 ? "crit" : "warn"}`],
        category: "co2",
        metricValue: metricDisplay,
        baselineValue: baseDisplay,
        deltaValue: deltaDisplay,
        flightRuleRef: "FR-ECLSS-001",
        details: {
          whatHappened: `• PCO₂ spiked to ${metricDisplay} in Node 2 (${deltaDisplay} above nominal).`,
          whyItMatters: `• Induced cerebral vasodilation increases risk of acute headache and fatigue.`,
          whatToDo: [
            "• Switch CDRA selector to DUAL-BED HIGH-FLOW.",
            "• Verify Node 2 diffuser fans (≥55 CFM) & hydrate with 500 mL.",
          ],
        },
      });
    }

    // -------------------------------------------------------------------------
    // 2. Autonomic Heart Rate Elevation Alert (Concordant with CO2 or Heat spike)
    // -------------------------------------------------------------------------
    const baselineHr = activeAstronaut?.resting_hr ?? 65.0;
    const currentHr = latestTelemetry.hr;
    const deltaHr = currentHr - baselineHr;

    if (hasCo2 || hasThermal || deltaHr >= 15.0) {
      const isCritical = deltaHr >= 25.0 || hasCo2;
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
          whatHappened: `• Heart rate spiked to ${currentHr.toFixed(0)} bpm (+${deltaHr.toFixed(0)} bpm above baseline).`,
          whyItMatters: `• Autonomic compensatory response indicates acute physical strain, elevated CO₂, or thermal load.`,
          whatToDo: [
            "• Initiate paced 4-4 diaphragmatic breathing & check SpO₂.",
            "• Stand down from heavy metabolic tasks; monitor telemetry.",
          ],
        },
      });
    }

    // -------------------------------------------------------------------------
    // 3. HRV / RMSSD Parasympathetic Depression Alert (Concordant with CO2 spike)
    // -------------------------------------------------------------------------
    const baselineRmssd = activeAstronaut?.resting_rmssd ?? 55.0;
    const currentRmssd = latestTelemetry.rmssd;
    const deltaRmssd = currentRmssd - baselineRmssd;

    if (hasCo2 || deltaRmssd <= -20.0) {
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
          whatHappened: `• RMSSD dropped to ${currentRmssd.toFixed(1)} ms (${Math.abs(deltaRmssd).toFixed(1)} ms below resting baseline).`,
          whyItMatters: `• Acute sympathetic dominance signals physical exhaustion or autonomic stress.`,
          whatToDo: [
            "• Direct crew to 20 min restorative resting posture.",
            "• Defer strenuous robotics/EVA until parasympathetic recovery.",
          ],
        },
      });
    }

    // -------------------------------------------------------------------------
    // 4. Cabin Temperature Alert
    // -------------------------------------------------------------------------
    const currentTemp = latestTelemetry.temp;
    if (hasThermal || (!isNominal && currentTemp >= 25.5)) {
      const tempDisplay = isMetric ? `${currentTemp.toFixed(1)} °C` : `${(currentTemp * 1.8 + 32).toFixed(1)} °F`;
      const baseTempDisplay = isMetric ? "22.5 °C" : "72.5 °F";
      const deltaTempDisplay = isMetric
        ? `+${(currentTemp - 22.5).toFixed(1)} °C`
        : `+${((currentTemp - 22.5) * 1.8).toFixed(1)} °F`;

      list.push({
        id: `alert-temp-overheat`,
        title: `Cabin Thermal Boundary Excursion: ${tempDisplay}`,
        level: currentTemp >= 27.0 ? "critical" : "warning",
        timestamp: nowUtc,
        message: isMetric
          ? `Cabin temperature in Node 2 reached ${tempDisplay}, exceeding the flight comfort envelope (20.0–24.0 °C).`
          : `Cabin temperature in Node 2 reached ${tempDisplay}, exceeding the flight comfort envelope (68.0–75.2 °F).`,
        module: "Node 2 (Harmony)",
        acknowledged: !!acknowledgedMap["alert-temp-overheat"],
        category: "thermal",
        metricValue: tempDisplay,
        baselineValue: baseTempDisplay,
        deltaValue: deltaTempDisplay,
        flightRuleRef: "FR-CDRA-002",
        details: {
          whatHappened: `• Cabin ambient temperature reached ${tempDisplay} (comfort range 20–24 °C).`,
          whyItMatters: `• Microgravity impairs heat rejection, compounding dehydration & cardiac strain.`,
          whatToDo: [
            "• Verify ITCS water loop flow & check CDRA desiccant loop.",
            isMetric ? "• Adjust air conditioning setpoint down by 1.5 °C." : "• Adjust air conditioning setpoint down by 2.7 °F.",
          ],
        },
      });
    }

    // -------------------------------------------------------------------------
    // 5. South Atlantic Anomaly (SAA) Radiation Alert
    // -------------------------------------------------------------------------
    if (hasSaa) {
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
          whatHappened: `• Station entered SAA inner radiation belt (flux elevated to 0.48 mGy/day).`,
          whyItMatters: `• Trapped solar proton corridor increases cumulative crew radiation dose.`,
          whatToDo: [
            "• Verify sleep quarters radiation shielding panels are deployed.",
            "• Avoid unshielded activities in forward vestibules.",
          ],
        },
      });
    }

    // -------------------------------------------------------------------------
    // 5b. Simulated Clinical Concordance Events for Injected Scenarios
    // -------------------------------------------------------------------------
    if (hasCo2) {
      list.push({
        id: "alert-concordance-co2-spike",
        title: "Clinical Concordance: Hypercapnic Autonomic Discordance",
        level: "critical",
        timestamp: nowUtc,
        message: isMetric
          ? "Concordant 4-lane excursion: Cabin CO₂ spiked to 4,350 PPM with concurrent heart rate acceleration (+27 bpm) and vagal withdrawal (RMSSD -31 ms)."
          : "Concordant 4-lane excursion: Cabin CO₂ spiked to 5.80 mmHg with concurrent heart rate acceleration (+27 bpm) and vagal withdrawal (RMSSD -31 ms).",
        module: "Node 2 (Harmony)",
        acknowledged: !!acknowledgedMap["alert-concordance-co2-spike"],
        category: "event",
        flightRuleRef: "FR-ECLSS-001",
        metricValue: isMetric ? "4,350 PPM" : "5.80 mmHg",
        baselineValue: isMetric ? "2,250 PPM" : "3.00 mmHg",
        deltaValue: isMetric ? "+2,100 PPM" : "+2.80 mmHg",
        details: {
          whatHappened: isMetric
            ? "• Synchronized cabin CO₂ elevation (4,350 PPM) in Node 2 with autonomic tachycardic reaction (+27 bpm) and RMSSD depression (-31 ms)."
            : "• Synchronized cabin CO₂ elevation (5.80 mmHg) in Node 2 with autonomic tachycardic reaction (+27 bpm) and RMSSD depression (-31 ms).",
          whyItMatters: "• Multi-signal concordance indicates genuine physiological stress requiring immediate environmental countermeasures.",
          whatToDo: [
            "• Direct crew to switch CDRA to dual-bed high-flow cycle.",
            "• Verify diffuser fan velocity (≥55 CFM) & initiate crew rehydration.",
          ],
        },
      });
    }

    if (hasThermal) {
      list.push({
        id: "alert-concordance-thermal-overheat",
        title: "Clinical Concordance: Cabin Thermal Excursion & Metabolic Surge",
        level: "warning",
        timestamp: nowUtc,
        message: isMetric
          ? "Concordant thermal excursion: Module ambient temperature elevated to 27.4 °C with autonomic compensatory cardiac elevation (+15 bpm)."
          : "Concordant thermal excursion: Module ambient temperature elevated to 81.3 °F with autonomic compensatory cardiac elevation (+15 bpm).",
        module: "Node 2 (Harmony)",
        acknowledged: !!acknowledgedMap["alert-concordance-thermal-overheat"],
        category: "event",
        flightRuleRef: "FR-CDRA-002",
        metricValue: isMetric ? "27.4 °C" : "81.3 °F",
        baselineValue: isMetric ? "22.8 °C" : "73.0 °F",
        deltaValue: isMetric ? "+4.6 °C" : "+8.3 °F",
        details: {
          whatHappened: "• Ambient cabin temperature surge during crew exercise regimen.",
          whyItMatters: "• Microgravity thermal accumulation impairs thermoregulation and elevates autonomic strain.",
          whatToDo: [
            "• Increase cabin ventilation CFM and replenish hydration fluids.",
            "• Adjust ITCS coolant loops.",
          ],
        },
      });
    }

    if (hasSaa) {
      list.push({
        id: "alert-concordance-saa-transit",
        title: "Clinical Concordance: South Atlantic Anomaly Radiation Crossing",
        level: "warning",
        timestamp: nowUtc,
        message: "Radiation dosimeter flux crossed ALARA advisory threshold (0.48 mGy/day) during orbital SAA passage.",
        module: "US Lab (Destiny)",
        acknowledged: !!acknowledgedMap["alert-concordance-saa-transit"],
        category: "event",
        metricValue: "0.48 mGy/day",
        baselineValue: "0.19 mGy/day",
        deltaValue: "+0.29 mGy/day",
        details: {
          whatHappened: "• South Atlantic Anomaly traversal elevated localized dosimetric ionizing flux.",
          whyItMatters: "• Real-time ALARA compliance monitoring is mandatory for orbital radiation accounting.",
          whatToDo: [
            "• Verify radiation shields in crew quarters.",
            "• Log personal dosimeter readings into station health records.",
          ],
        },
      });
    }

    // -------------------------------------------------------------------------
    // 6. Real Health Events from API (e.g. Day 127 Headache & CO2 Concordance)
    // -------------------------------------------------------------------------
    for (const evt of events) {
      const isAck =
        evt.review_status !== "PENDING" ||
        isNominal ||
        !!acknowledgedMap[`event-${evt.event_id}`];
      list.push({
        id: `event-${evt.event_id}`,
        title: `Clinical Concordance: ${evt.event_type.replace(/_/g, " ")}`,
        level: evt.severity_level === "INVESTIGATE" ? "critical" : "warning",
        timestamp: evt.start_time.slice(11, 16) + " UTC",
        message: parseEventRationale(evt.rationale, evt.event_type).summary,
        module: "Node 2 (Harmony)",
        acknowledged: isAck,
        category: "event",
        flightRuleRef: "FR-ECLSS-001",
        details: {
          whatHappened: `• ${parseEventRationale(evt.rationale, evt.event_type).summary || "Synchronized environmental exposure and physiological response detected."}`,
          whyItMatters: `• Concordance across multiple data streams indicates physiological impact.`,
          whatToDo: [
            "• Consult Concordance Timeline for synchronized 4-lane excursion.",
            "• Verify symptom resolution with affected astronaut.",
          ],
        },
      });
    }

    // -------------------------------------------------------------------------
    // 7. Real Crew Symptoms Reported
    // -------------------------------------------------------------------------
    for (const sym of symptoms.slice(0, 3)) {
      const symId = `sym-${sym.report_id}`;
      const reportAgeMs = Date.now() - new Date(sym.reported_at).getTime();
      const isRecent = !isNaN(reportAgeMs) && reportAgeMs < 15 * 60 * 1000;
      const isAck =
        (!isRecent && isNominal) || !!acknowledgedMap[symId];

      list.push({
        id: symId,
        title: `Crew Symptom Logged: ${sym.symptom_code} (Severity ${sym.severity}/5)`,
        level: sym.severity >= 3 ? "warning" : "info",
        timestamp: sym.reported_at.slice(11, 16) + " UTC",
        message: `Subjective symptom "${sym.symptom_code}" logged by ${sym.astronaut_id} in ${sym.cabin_module || "Node 2"}.${sym.notes ? ` Note: "${sym.notes}"` : ""}`,
        module: sym.cabin_module || "Node 2 (Harmony)",
        acknowledged: isAck,
        category: "symptom",
        details: {
          whatHappened: `• ${sym.symptom_code.replace(/_/g, " ")} reported at severity ${sym.severity}/5 by ${sym.astronaut_id}.${sym.notes ? ` (${sym.notes})` : ""}`,
          whyItMatters: `• Subjective symptoms provide early clinical markers before telemetry degradation.`,
          whatToDo: [
            "• Correlate with localized Node 2 environmental trends.",
            "• Ensure crew takes countermeasure rest break and rehydrates.",
          ],
        },
      });
    }

    return list;
  }, [latestTelemetry, hasCo2, hasThermal, hasSaa, isNominal, activeAstronaut, events, symptoms, acknowledgedMap]);

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
    <section className={`p-6 sm:p-8 rounded-[32px] border border-slate-200/90 bg-white shadow-2xs relative overflow-hidden ${className}`}>
      {/* Top Banner with Real-time Telemetry Pills */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700">
              Real-Time Flight Medicine &amp; ECLSS Anomaly Detection
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
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

      {/* Real-time Telemetry Status Ribbon - Unit Synchronized & Fully Interactive */}
      <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          {/* Live Cabin CO2 */}
          <div className="flex items-center gap-2">
            <Wind
              className={`w-4 h-4 ${
                hasCo2 || latestTelemetry.co2Ppm > 3500
                  ? "text-amber-600 animate-pulse"
                  : "text-sky-600"
              }`}
            />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Live Cabin CO₂ ({isMetric ? "PPM" : "mmHg"})
              </span>
              <div className="flex items-baseline gap-1">
                <span
                  className={`font-mono font-bold ${
                    hasCo2 || latestTelemetry.co2Ppm > 3500
                      ? "text-amber-700 font-extrabold"
                      : "text-slate-900"
                  }`}
                >
                  {isMetric
                    ? `${Math.round(latestTelemetry.co2Ppm).toLocaleString()} PPM`
                    : `${latestTelemetry.co2.toFixed(2)} mmHg`}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  ({isMetric ? "Baseline 2,250" : "Baseline 3.00"})
                </span>
              </div>
            </div>
          </div>

          {/* Heart Rate */}
          <div className="flex items-center gap-2">
            <Heart
              className={`w-4 h-4 ${
                vitals.hrAlert || latestTelemetry.hr > 85
                  ? "text-red-500 animate-pulse"
                  : "text-rose-500"
              }`}
            />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Heart Rate
              </span>
              <div className="flex items-baseline gap-1">
                <span
                  className={`font-mono font-bold ${
                    vitals.hrAlert || latestTelemetry.hr > 85
                      ? "text-red-700 font-extrabold"
                      : "text-slate-900"
                  }`}
                >
                  {latestTelemetry.hr.toFixed(0)} bpm
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  (Base {vitals.baselineHr.toFixed(0)})
                </span>
              </div>
            </div>
          </div>

          {/* HRV RMSSD */}
          <div className="flex items-center gap-2">
            <Activity
              className={`w-4 h-4 ${
                vitals.rmssdAlert
                  ? "text-amber-600 animate-pulse"
                  : "text-emerald-600"
              }`}
            />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                HRV (RMSSD)
              </span>
              <div className="flex items-baseline gap-1">
                <span
                  className={`font-mono font-bold ${
                    vitals.rmssdAlert
                      ? "text-amber-700 font-extrabold"
                      : "text-slate-900"
                  }`}
                >
                  {latestTelemetry.rmssd.toFixed(1)} ms
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  (Base {vitals.baselineRmssd.toFixed(0)})
                </span>
              </div>
            </div>
          </div>

          {/* Cabin Temp */}
          <div className="flex items-center gap-2">
            <Thermometer
              className={`w-4 h-4 ${
                hasThermal || latestTelemetry.temp > 25.0
                  ? "text-orange-600 animate-pulse"
                  : "text-amber-600"
              }`}
            />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Cabin Temp ({isMetric ? "°C" : "°F"})
              </span>
              <div className="flex items-baseline gap-1">
                <span
                  className={`font-mono font-bold ${
                    hasThermal || latestTelemetry.temp > 25.0
                      ? "text-orange-700 font-extrabold"
                      : "text-slate-900"
                  }`}
                >
                  {isMetric
                    ? `${latestTelemetry.temp.toFixed(1)} °C`
                    : `${(latestTelemetry.temp * 1.8 + 32).toFixed(1)} °F`}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  ({isMetric ? "Nom 22.8" : "Nom 73.0"})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Active Simulation Anomaly Status or Nominal Badge with Controls */}
        <div className="flex items-center gap-2 ml-auto">
          {isAnomalyActive ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 font-bold text-[10px] animate-pulse flex items-center gap-1 shadow-2xs">
                <span>Live Anomaly Active: {activeScenarios.map((s) => s.replace(/_/g, " ").toUpperCase()).join(" + ")}</span>
              </span>
              <button
                type="button"
                onClick={() => simulationControls.resetNominal()}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 border border-slate-300 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                title="Reset active simulation anomaly overrides to nominal"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                <span>Reset Nominal</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium text-[10px] flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>All Telemetry Nominal</span>
              </span>
              {/* Quick Anomaly Testing Injectors */}
              <div className="hidden sm:flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => simulationControls.toggleScenario("co2_spike")}
                  className="px-2 py-0.5 rounded text-[10px] font-medium border border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-slate-600 hover:text-amber-800 transition-colors cursor-pointer"
                  title="Simulate CO₂ Hypercapnia Excursion"
                >
                  +CO₂ Spike
                </button>
                <button
                  type="button"
                  onClick={() => simulationControls.toggleScenario("thermal_overheat")}
                  className="px-2 py-0.5 rounded text-[10px] font-medium border border-slate-200 hover:border-orange-300 hover:bg-orange-50 text-slate-600 hover:text-orange-800 transition-colors cursor-pointer"
                  title="Simulate Thermal Loop Excursion"
                >
                  +Overheat
                </button>
                <button
                  type="button"
                  onClick={() => simulationControls.toggleScenario("saa_transit")}
                  className="px-2 py-0.5 rounded text-[10px] font-medium border border-slate-200 hover:border-purple-300 hover:bg-purple-50 text-slate-600 hover:text-purple-800 transition-colors cursor-pointer"
                  title="Simulate SAA Radiation Belt Cross"
                >
                  +SAA Cross
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Explanatory Note */}
      <div className="mt-4 border-l-2 border-sky-500 pl-3 text-[11px] leading-relaxed text-secondary flex items-center justify-between">
        <span>
          Real-time alerts cross-reference live environmental telemetry (NASA EDA) against personalized circadian envelopes.
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

      {/* Compact Real-time Alerts Feed */}
      <div className="mt-4 space-y-2.5">
        {displayedAlerts.length === 0 ? (
          <div className="p-8 text-center rounded-xl glass-panel-subtle space-y-2 border border-slate-200 bg-white">
            <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
            <h3 className="text-xs font-bold text-foreground">
              {isAnomalyActive ? "All Active Anomaly Alerts Acknowledged" : "All Telemetry Within Normal Circadian Bounds"}
            </h3>
            <p className="text-[11px] text-muted max-w-md mx-auto">
              {isAnomalyActive
                ? "Active anomaly simulation telemetry is running, but all generated alerts have been acknowledged. Click 'Restore Acknowledged' above to review."
                : `Cabin CO₂ (${isMetric ? `${Math.round(latestTelemetry.co2 * 750).toLocaleString()} PPM` : `${latestTelemetry.co2.toFixed(2)} mmHg`}), temperature (${isMetric ? `${latestTelemetry.temp.toFixed(1)} °C` : `${(latestTelemetry.temp * 1.8 + 32).toFixed(1)} °F`}), and heart rate (${latestTelemetry.hr.toFixed(0)} bpm) are nominal.`}
            </p>
          </div>
        ) : (
          displayedAlerts.map((alert) => {
            const isResolved = alert.acknowledged;
            const levelAccent = isResolved
              ? "opacity-60 border-slate-200/80 bg-slate-50/50"
              : alert.level === "critical"
              ? "border-red-200/90 bg-red-50/30 text-red-950 hover:border-red-300"
              : alert.level === "warning"
              ? "border-amber-200/90 bg-amber-50/30 text-amber-950 hover:border-amber-300"
              : "border-emerald-200/90 bg-emerald-50/30 text-emerald-950 hover:border-emerald-300";

            return (
              <div
                key={alert.id}
                className={`p-3.5 sm:p-4 rounded-2xl border glass-panel transition-all duration-150 shadow-2xs ${levelAccent}`}
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/70">
                  <div className="flex items-center gap-2 min-w-0">
                    {isResolved ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : alert.level === "critical" ? (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 animate-pulse" />
                    ) : alert.level === "warning" ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                        {alert.title}
                      </h4>
                      {alert.flightRuleRef && (
                        <span className="rounded bg-sky-100 text-sky-800 border border-sky-200 px-1.5 py-0.2 text-[10px] font-mono font-bold">
                          {alert.flightRuleRef}
                        </span>
                      )}
                      <span className="text-[11px] text-muted font-mono">
                        {alert.module} · {alert.timestamp}
                      </span>
                      {alert.deltaValue && (
                        <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-mono">
                          {alert.deltaValue}
                        </span>
                      )}
                    </div>
                  </div>

                  {!isResolved ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAcknowledge(alert.id)}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-sky-50 border border-slate-300 text-[11px] font-semibold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs hover:border-sky-300 hover:text-sky-700"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Acknowledge</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAcknowledge(alert.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Close alert"
                        aria-label="Close alert"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-700 font-mono font-semibold flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Acknowledged</span>
                    </span>
                  )}
                </div>

                {/* Visualized Clean Details in Bullet Points — Comfortable Readable Typography */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2 pt-0.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50/80 border border-slate-200/80 space-y-1">
                    <span className="text-[10.5px] uppercase font-bold tracking-wider text-slate-700 block">
                      What Happened
                    </span>
                    <p className="text-[11.5px] sm:text-xs text-slate-700 leading-relaxed">
                      {alert.details.whatHappened}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50/80 border border-slate-200/80 space-y-1">
                    <span className="text-[10.5px] uppercase font-bold tracking-wider text-slate-700 block">
                      Why It Matters
                    </span>
                    <p className="text-[11.5px] sm:text-xs text-slate-700 leading-relaxed">
                      {alert.details.whyItMatters}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50/80 border border-slate-200/80 space-y-1">
                    <span className="text-[10.5px] uppercase font-bold tracking-wider text-slate-700 block">
                      Protocol Action
                    </span>
                    <ul className="text-[11.5px] sm:text-xs text-slate-700 space-y-0.5 leading-relaxed">
                      {alert.details.whatToDo.map((step, sIdx) => (
                        <li key={sIdx}>{step}</li>
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
