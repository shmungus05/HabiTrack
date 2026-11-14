/**
 * Isolated Deep Module: Settings & Crew Biomedical Profile Simulation
 * Encapsulates astronaut profile tuning, threshold preferences, and unit system state.
 */

import { useState, useCallback, useEffect } from "react";

export interface AstronautBiomedicalProfile {
  name: string;
  role: string;
  mission: string;
  daysInSpace: number;
  baselineHeartRate: number;
  restingSpO2: number;
  careerRadiationDoseMsv: number;
  careerLimitMsv: number;
}

export interface PlatformSettings {
  unitSystem: "metric" | "us";
  telemetrySource: "simulation" | "nasa-eda";
  thresholds: {
    co2WarningPpm: number;
    co2CriticalPpm: number;
    tempMinC: number;
    tempMaxC: number;
    radAlertRate: number;
  };
}

const STORAGE_KEY_PROFILE = "wayfinder_biomedical_profile_v3";
const STORAGE_KEY_SETTINGS = "wayfinder_platform_settings_v3";

export function useBiomedicalSettings() {
  const [profile, setProfile] = useState<AstronautBiomedicalProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROFILE);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {
      name: "CDR M. Vance",
      role: "Commander / Flight Medical Officer",
      mission: "ISS Expedition 71/72",
      daysInSpace: 221,
      baselineHeartRate: 58,
      restingSpO2: 98,
      careerRadiationDoseMsv: 46.8,
      careerLimitMsv: 600.0,
    };
  });

  const [settings, setSettings] = useState<PlatformSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {
      unitSystem: "metric",
      telemetrySource: "nasa-eda",
      thresholds: {
        co2WarningPpm: 3100,
        co2CriticalPpm: 4500,
        tempMinC: 20.0,
        tempMaxC: 25.0,
        radAlertRate: 0.25,
      },
    };
  });

  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  const updateProfile = useCallback((updates: Partial<AstronautBiomedicalProfile>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  }, []);

  const updateSettings = useCallback((updates: Partial<PlatformSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const adjustHeartRate = useCallback((delta: number) => {
    setProfile((prev) => ({
      ...prev,
      baselineHeartRate: Math.max(35, Math.min(150, prev.baselineHeartRate + delta)),
    }));
  }, []);

  const adjustSpO2 = useCallback((delta: number) => {
    setProfile((prev) => ({
      ...prev,
      restingSpO2: Math.max(80, Math.min(100, prev.restingSpO2 + delta)),
    }));
  }, []);

  return {
    profile,
    settings,
    saveSuccess,
    updateProfile,
    updateSettings,
    adjustHeartRate,
    adjustSpO2,
  };
}
