/**
 * Isolated Deep Module: Settings & Crew Biomedical Profile Simulation
 * Encapsulates astronaut profile tuning, threshold preferences, and unit system state.
 */

import { useSyncExternalStore, useCallback, useState, useEffect } from "react";

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

const DEFAULT_PROFILE: AstronautBiomedicalProfile = {
  name: "CDR M. Vance",
  role: "Commander / Flight Medical Officer",
  mission: "ISS Expedition 71/72",
  daysInSpace: 221,
  baselineHeartRate: 58,
  restingSpO2: 98,
  careerRadiationDoseMsv: 46.8,
  careerLimitMsv: 600.0,
};

const DEFAULT_SETTINGS: PlatformSettings = {
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

function loadStoredProfile(): AstronautBiomedicalProfile {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (saved) return { ...DEFAULT_PROFILE, ...JSON.parse(saved) };
  } catch {
    // fallback
  }
  return DEFAULT_PROFILE;
}

function loadStoredSettings(): PlatformSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch {
    // fallback
  }
  return DEFAULT_SETTINGS;
}

let currentProfile: AstronautBiomedicalProfile = loadStoredProfile();
let currentSettings: PlatformSettings = loadStoredSettings();
const storeListeners = new Set<() => void>();

function notifyListeners() {
  storeListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore
    }
  });
}

function subscribe(listener: () => void) {
  storeListeners.add(listener);
  return () => {
    storeListeners.delete(listener);
  };
}

export function useBiomedicalSettings() {
  const profile = useSyncExternalStore(subscribe, () => currentProfile);
  const settings = useSyncExternalStore(subscribe, () => currentSettings);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_SETTINGS && e.newValue) {
        try {
          currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(e.newValue) };
          notifyListeners();
        } catch {
          // ignore
        }
      }
      if (e.key === STORAGE_KEY_PROFILE && e.newValue) {
        try {
          currentProfile = { ...DEFAULT_PROFILE, ...JSON.parse(e.newValue) };
          notifyListeners();
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const updateProfile = useCallback((updates: Partial<AstronautBiomedicalProfile>) => {
    currentProfile = { ...currentProfile, ...updates };
    try {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(currentProfile));
    } catch {
      // ignore
    }
    notifyListeners();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  }, []);

  const updateSettings = useCallback((updates: Partial<PlatformSettings>) => {
    currentSettings = { ...currentSettings, ...updates };
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(currentSettings));
    } catch {
      // ignore
    }
    notifyListeners();
  }, []);

  const adjustHeartRate = useCallback((delta: number) => {
    updateProfile({
      baselineHeartRate: Math.max(35, Math.min(150, currentProfile.baselineHeartRate + delta)),
    });
  }, [updateProfile]);

  const adjustSpO2 = useCallback((delta: number) => {
    updateProfile({
      restingSpO2: Math.max(80, Math.min(100, currentProfile.restingSpO2 + delta)),
    });
  }, [updateProfile]);

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
