/**
 * Global ISS Mission Clock & Simulation Mode Store
 *
 * Implements a synchronized global mission clock across all HabiTrack modules:
 * - Normal Mode: Uses the actual current UTC clock (Date.now()) and generates or receives
 *   mock environmental and astronaut health readings in real time.
 * - Simulation Mode: Starts a new simulation from Day 1 and replays the 180-day NASA EDA
 *   dataset using one synchronized mission clock across all compartments, environmental
 *   readings, astronaut health records, and symptom submissions.
 *
 * Includes adjustable playback speeds (1×, 2×, 5×, 10×, and custom), Pause, Resume, Reset,
 * and timeline scrubbing. Preserves the exact mission timestamp when paused, resumed, or
 * when switching between Normal and Simulation modes.
 */

import { create } from "zustand";

export type MissionMode = "normal" | "simulation";

export const DURATION_180_DAYS_MS = 180 * 24 * 3600 * 1000;

// Stable anchor point for the 180-day dataset (Mission End = reference epoch)
// Day 1 starts exactly 180 days prior to this anchor.
const STORED_ANCHOR_KEY = "habitrack_mission_anchor_v1";

function getOrInitMissionAnchor(): number {
  try {
    const saved = localStorage.getItem(STORED_ANCHOR_KEY);
    if (saved) {
      const parsed = Number(saved);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage errors
  }
  const anchor = Date.now();
  try {
    localStorage.setItem(STORED_ANCHOR_KEY, String(anchor));
  } catch {
    // Ignore storage errors
  }
  return anchor;
}

export const MISSION_ANCHOR_END_MS = getOrInitMissionAnchor();
export const MISSION_DAY_1_START_MS = MISSION_ANCHOR_END_MS - DURATION_180_DAYS_MS;

export interface MissionState {
  mode: MissionMode;
  // Simulation playback state (persisted independently of Normal Mode)
  simTimeMs: number;
  isPlaying: boolean;
  playbackSpeed: number;
  customSpeedInput: string;
  isCustomSpeedActive: boolean;

  // Real-world clock ticker state (updates every second in Normal Mode)
  realNowMs: number;

  // Actions
  setMode: (mode: MissionMode) => void;
  toggleMode: () => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  resetToDay1: () => void;
  seekToMs: (targetMs: number) => void;
  seekToDay: (dayNumber: number) => void;
  setSpeed: (speed: number) => void;
  setCustomSpeed: (speed: number) => void;
  setCustomSpeedInput: (input: string) => void;
  applyCustomSpeed: () => void;

  // Internal ticker step
  tickSimulation: (deltaRealMs: number) => void;
  tickRealTime: () => void;
}

export const useMissionStore = create<MissionState>((set, get) => ({
  mode: "normal",
  simTimeMs: MISSION_DAY_1_START_MS,
  isPlaying: false,
  playbackSpeed: 1,
  customSpeedInput: "60",
  isCustomSpeedActive: false,
  realNowMs: Date.now(),

  setMode: (mode: MissionMode) => {
    set((state) => {
      if (state.mode === mode) return {};
      // When entering simulation mode for the first time, if at Day 1, keep it ready
      return { mode };
    });
  },

  toggleMode: () => {
    const current = get().mode;
    get().setMode(current === "normal" ? "simulation" : "normal");
  },

  play: () => {
    set({ isPlaying: true });
  },

  pause: () => {
    set({ isPlaying: false });
  },

  togglePlay: () => {
    set((state) => ({ isPlaying: !state.isPlaying }));
  },

  resetToDay1: () => {
    set({
      simTimeMs: MISSION_DAY_1_START_MS,
      isPlaying: false,
    });
  },

  seekToMs: (targetMs: number) => {
    const clamped = Math.max(
      MISSION_DAY_1_START_MS,
      Math.min(MISSION_ANCHOR_END_MS, targetMs),
    );
    set({ simTimeMs: clamped });
  },

  seekToDay: (dayNumber: number) => {
    const clampedDay = Math.max(1, Math.min(180, dayNumber));
    const targetMs = MISSION_DAY_1_START_MS + (clampedDay - 1) * 24 * 3600 * 1000;
    get().seekToMs(targetMs);
  },

  setSpeed: (speed: number) => {
    set({ playbackSpeed: speed, isCustomSpeedActive: false });
  },

  setCustomSpeed: (speed: number) => {
    const valid = Math.max(0.1, Math.min(86400, speed));
    set({
      playbackSpeed: valid,
      isCustomSpeedActive: true,
      customSpeedInput: String(valid),
    });
  },

  setCustomSpeedInput: (input: string) => {
    set({ customSpeedInput: input });
  },

  applyCustomSpeed: () => {
    const parsed = parseFloat(get().customSpeedInput);
    if (!isNaN(parsed) && parsed > 0) {
      get().setCustomSpeed(parsed);
    }
  },

  tickSimulation: (deltaRealMs: number) => {
    const { isPlaying, simTimeMs, playbackSpeed, mode } = get();
    if (mode !== "simulation" || !isPlaying) return;

    const advanceMs = deltaRealMs * playbackSpeed;
    const nextMs = simTimeMs + advanceMs;

    if (nextMs >= MISSION_ANCHOR_END_MS) {
      set({
        simTimeMs: MISSION_ANCHOR_END_MS,
        isPlaying: false,
      });
    } else {
      set({ simTimeMs: nextMs });
    }
  },

  tickRealTime: () => {
    set({ realNowMs: Date.now() });
  },
}));

/**
 * Returns the active time in milliseconds based on current mode:
 * - If Simulation Mode: returns current simulated mission timestamp
 * - If Normal Mode: returns actual real-world time (Date.now())
 */
export function getActiveMissionTimeMs(): number {
  const { mode, simTimeMs, realNowMs } = useMissionStore.getState();
  return mode === "simulation" ? simTimeMs : realNowMs;
}

/**
 * React hook for consuming synchronized mission time anywhere in the application.
 */
export function useActiveMissionTime() {
  const mode = useMissionStore((state) => state.mode);
  const simTimeMs = useMissionStore((state) => state.simTimeMs);
  const realNowMs = useMissionStore((state) => state.realNowMs);
  const isPlaying = useMissionStore((state) => state.isPlaying);
  const playbackSpeed = useMissionStore((state) => state.playbackSpeed);

  const currentTimeMs = mode === "simulation" ? simTimeMs : realNowMs;
  const isSimulation = mode === "simulation";

  // Mission day calculation (Day 1..180 for simulation; or 180 for current normal)
  const elapsedFromStartMs = Math.max(0, currentTimeMs - MISSION_DAY_1_START_MS);
  const currentMissionDay = Math.min(
    180,
    Math.max(1, Math.floor(elapsedFromStartMs / (24 * 3600 * 1000)) + 1),
  );
  const progressPercent = Math.min(
    100,
    Math.max(0, (elapsedFromStartMs / DURATION_180_DAYS_MS) * 100),
  );

  const isoString = new Date(currentTimeMs).toISOString();
  const utcString = isoString.replace("T", " ").slice(0, 19) + " UTC";

  return {
    mode,
    isSimulation,
    currentTimeMs,
    currentDate: new Date(currentTimeMs),
    isoString,
    utcString,
    currentMissionDay,
    progressPercent,
    isPlaying,
    playbackSpeed,
    missionStartMs: MISSION_DAY_1_START_MS,
    missionEndMs: MISSION_ANCHOR_END_MS,
  };
}
