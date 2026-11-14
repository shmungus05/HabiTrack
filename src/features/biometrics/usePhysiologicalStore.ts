/**
 * Centralized Physiological Telemetry & Circadian Envelope Store
 *
 * Synchronizes real-time crew biometrics across ALL pages:
 * - Overview View (Astronaut & Flight Surgeon)
 * - Timeline View
 * - Symptoms View
 * - Alerts Deck
 *
 * Combines:
 * 1. Active astronaut's baseline (Resting HR, RMSSD, SpO2, Core Temp)
 * 2. Real-time active simulation scenarios (CO2 spike, thermal overheat, SAA transit)
 * 3. Real-time micro-fluctuations aligned with Live UTC Flight Time
 */

import { useMemo, useState, useEffect } from "react";
import { useCohortStore } from "../../stores/cohortStore";
import { useSimulationSandbox } from "../simulation";

export interface PhysiologicalVitals {
  astronautId: string;
  callsign: string;
  hr: number;
  baselineHr: number;
  hrDelta: number;
  hrAlert: boolean;

  rmssd: number;
  baselineRmssd: number;
  rmssdDelta: number;
  rmssdAlert: boolean;

  spo2: number;
  baselineSpo2: number;
  spo2Delta: number;
  spo2Alert: boolean;

  coreTemp: number;
  baselineCoreTemp: number;
  coreTempDelta: number;
  coreTempAlert: boolean;

  autonomicFlagged: boolean;
  statusLabel: "Nominal" | "Advisory" | "Alert";
}

export function usePhysiologicalTelemetry(astronautId?: string): PhysiologicalVitals {
  const activeAstronautId = useCohortStore((state) => state.activeAstronautId);
  const astronauts = useCohortStore((state) => state.astronauts);
  const targetId = astronautId || activeAstronautId;

  const currentAstronaut = useMemo(
    () =>
      astronauts.find(
        (a) => a.astronaut_id.toLowerCase() === targetId.toLowerCase()
      ) || astronauts[0],
    [astronauts, targetId]
  );

  const [simulationState] = useSimulationSandbox();
  const { activeScenario } = simulationState;
  const activeScenarios =
    simulationState.activeScenarios || (activeScenario !== "nominal" ? [activeScenario] : []);

  const hasCo2 = activeScenarios.includes("co2_spike") || activeScenario === "co2_spike";
  const hasThermal =
    activeScenarios.includes("thermal_overheat") || activeScenario === "thermal_overheat";
  const hasSaa = activeScenarios.includes("saa_transit") || activeScenario === "saa_transit";
  const isNominal = !hasCo2 && !hasThermal && !hasSaa;

  // Live real-time micro-tick for breathing & sinus arrhythmia
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return useMemo(() => {
    const baselineHr = currentAstronaut?.resting_hr ?? 65;
    const baselineRmssd = currentAstronaut?.resting_rmssd ?? 55;
    const baselineSpo2 = currentAstronaut?.resting_spo2 ?? 98.0;
    const baselineCoreTemp = currentAstronaut?.resting_temp ?? 37.0;

    let hr = baselineHr;
    let rmssd = baselineRmssd;
    let spo2 = baselineSpo2;
    let coreTemp = baselineCoreTemp;

    if (hasCo2) {
      // Compensatory tachycardia & parasympathetic withdrawal from hypercapnia
      hr = baselineHr + 27; // e.g. 92 bpm
      rmssd = 24; // severe depression from 55 ms baseline
      spo2 = Number((baselineSpo2 - 1.2).toFixed(1)); // mild desaturation
    }
    if (hasThermal) {
      // Heat surge autonomic stress & core temperature rise
      coreTemp = Number((baselineCoreTemp + 0.6).toFixed(1)); // +0.6 °C core elevation (e.g. 37.6 °C)
      if (!hasCo2) {
        hr = baselineHr + 15; // 80 bpm compensatory cardiac response
      }
    }

    // Micro-fluctuations aligned with live clock
    const noise = Math.sin(tick * 0.7);
    if (isNominal) {
      hr = Math.round(hr + noise * 1);
      rmssd = Math.round(rmssd + noise * 1.5);
    }

    const hrDelta = hr - baselineHr;
    const rmssdDelta = rmssd - baselineRmssd;
    const spo2Delta = Number((spo2 - baselineSpo2).toFixed(1));
    const coreTempDelta = Number((coreTemp - baselineCoreTemp).toFixed(2));

    const hrAlert = Math.abs(hrDelta) > 8;
    const rmssdAlert = rmssdDelta < -10;
    const spo2Alert = spo2Delta < -1.0;
    const coreTempAlert = Math.abs(coreTempDelta) > 0.4;

    const autonomicFlagged = hrAlert || rmssdAlert || hasCo2;
    const statusLabel =
      autonomicFlagged || coreTempAlert ? "Alert" : hrAlert || rmssdAlert ? "Advisory" : "Nominal";

    return {
      astronautId: targetId,
      callsign: currentAstronaut?.callsign ?? "CDR M. Vance",
      hr,
      baselineHr,
      hrDelta,
      hrAlert,

      rmssd,
      baselineRmssd,
      rmssdDelta,
      rmssdAlert,

      spo2,
      baselineSpo2,
      spo2Delta,
      spo2Alert,

      coreTemp,
      baselineCoreTemp,
      coreTempDelta,
      coreTempAlert,

      autonomicFlagged,
      statusLabel,
    };
  }, [currentAstronaut, targetId, hasCo2, hasThermal, hasSaa, isNominal, tick]);
}
