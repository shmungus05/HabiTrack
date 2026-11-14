/**
 * Isolated Deep Module: Simulation Sandbox & Telemetry Anomaly Injector
 * Manages transient test scenarios (CO2 pocket spikes, SAA radiation belt
 * crosses) and threshold configuration without modifying permanent databases.
 *
 * State lives in a module-level store rather than component state so the
 * app-shell override banner and the sandbox panel always observe the same
 * injection, including after switching perspectives or views.
 */

import { useSyncExternalStore } from "react";

export type AnomalyScenarioType = "nominal" | "co2_spike" | "saa_transit" | "thermal_overheat";

export interface SimulationThresholds {
  co2WarningPpm: number;
  co2CriticalPpm: number;
  tempMinC: number;
  tempMaxC: number;
  radAlertRate: number;
}

export interface SimulationState {
  activeScenario: AnomalyScenarioType;
  thresholds: SimulationThresholds;
  profileOverrides: {
    callsign: string;
    role: string;
    baselineHr: number;
    restingSpo2: number;
  };
  isAnomalyActive: boolean;
}

export interface SimulationControls {
  injectScenario: (scenario: AnomalyScenarioType) => void;
  resetNominal: () => void;
  updateThresholds: (thresholds: Partial<SimulationThresholds>) => void;
  updateProfileOverrides: (profile: Partial<SimulationState["profileOverrides"]>) => void;
}

const INITIAL_STATE: SimulationState = {
  activeScenario: "nominal",
  thresholds: {
    co2WarningPpm: 3100,
    co2CriticalPpm: 4500,
    tempMinC: 20.0,
    tempMaxC: 25.0,
    radAlertRate: 0.25,
  },
  profileOverrides: {
    callsign: "CDR M. Vance",
    role: "Commander / Medical Officer",
    baselineHr: 58,
    restingSpo2: 98,
  },
  isAnomalyActive: false,
};

let currentState: SimulationState = INITIAL_STATE;
const listeners = new Set<() => void>();

function publish(next: SimulationState): void {
  currentState = next;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SimulationState {
  return currentState;
}

const controls: SimulationControls = {
  injectScenario: (scenario: AnomalyScenarioType) => {
    publish({
      ...currentState,
      activeScenario: scenario,
      isAnomalyActive: scenario !== "nominal",
    });
  },
  resetNominal: () => {
    publish({ ...currentState, activeScenario: "nominal", isAnomalyActive: false });
  },
  updateThresholds: (updates: Partial<SimulationThresholds>) => {
    publish({
      ...currentState,
      thresholds: { ...currentState.thresholds, ...updates },
    });
  },
  updateProfileOverrides: (profile: Partial<SimulationState["profileOverrides"]>) => {
    publish({
      ...currentState,
      profileOverrides: { ...currentState.profileOverrides, ...profile },
    });
  },
};

export function useSimulationSandbox(): [SimulationState, SimulationControls] {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return [state, controls];
}

/** Imperative reset for shell-level banners outside the hook's tuple. */
export function resetSimulationSandbox(): void {
  controls.resetNominal();
}
