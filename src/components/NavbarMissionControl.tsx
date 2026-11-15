/**
 * Navbar Mission Control Component
 *
 * Placed prominently in the flight deck navbar / header:
 * - Normal Mode: Uses the actual current UTC clock (Date.now()) and displays live flight ops.
 * - Simulation Mode: Replays the 180-day dataset starting from Day 1 across all modules.
 * - Includes Pause, Resume, Reset controls with exact timestamp preservation.
 * - Adjustable playback speeds: 1×, 2×, 5×, 10×, and Custom.
 * - Independent timeline persistence between modes.
 */

import React, { useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Clock,
  Sparkles,
  Sliders,
  Check,
  Radio,
  Rocket,
  X,
} from "lucide-react";
import {
  useMissionStore,
  useActiveMissionTime,
  MISSION_DAY_1_START_MS,
  MISSION_ANCHOR_END_MS,
} from "../stores/missionStore";

export const NavbarMissionControl: React.FC = () => {
  const {
    mode,
    isSimulation,
    currentTimeMs,
    utcString,
    currentMissionDay,
    progressPercent,
    isPlaying,
    playbackSpeed,
  } = useActiveMissionTime();

  const setMode = useMissionStore((state) => state.setMode);
  const play = useMissionStore((state) => state.play);
  const pause = useMissionStore((state) => state.pause);
  const resetToDay1 = useMissionStore((state) => state.resetToDay1);
  const seekToMs = useMissionStore((state) => state.seekToMs);
  const setSpeed = useMissionStore((state) => state.setSpeed);
  const setCustomSpeed = useMissionStore((state) => state.setCustomSpeed);
  const customSpeedInput = useMissionStore((state) => state.customSpeedInput);
  const setCustomSpeedInput = useMissionStore((state) => state.setCustomSpeedInput);
  const applyCustomSpeed = useMissionStore((state) => state.applyCustomSpeed);
  const isCustomSpeedActive = useMissionStore((state) => state.isCustomSpeedActive);

  const [showCustomModal, setShowCustomModal] = useState(false);

  const handleTogglePlay = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    seekToMs(val);
  };

  return (
    <div className="w-full border-t border-slate-200/90 bg-slate-50/95 backdrop-blur-xs px-3 sm:px-6 py-2 transition-all">
      <div className="mx-auto flex flex-wrap items-center justify-between gap-2.5 max-w-[1800px]">
        {/* Left Section: Mode Switcher (Normal Mode vs Simulation Mode) */}
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Mission Time Mode"
            className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs"
          >
            <button
              type="button"
              onClick={() => setMode("normal")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                !isSimulation
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title="Normal Mode: Uses actual current real-world UTC clock"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  !isSimulation ? "bg-white animate-pulse" : "bg-emerald-500"
                }`}
              />
              <span>Normal Mode</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("simulation");
                // If paused at start, user can hit play or review
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                isSimulation
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title="Simulation Mode: Starts from Day 1 and replays 180-day ISS mission dataset"
            >
              <Rocket className="h-3 w-3" />
              <span>Simulation Mode</span>
              {isSimulation && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-sky-700/80 text-[10px] text-sky-100 font-mono">
                  D{currentMissionDay}
                </span>
              )}
            </button>
          </div>

          {/* Normal Mode Readout Pill */}
          {!isSimulation && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 font-medium pl-1">
              <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live Real-World UTC
              </span>
              <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
                Synchronized to station live telemetry &amp; crew vitals
              </span>
            </div>
          )}
        </div>

        {/* Right Section: Simulation Playback Controls (Displayed whenever in Simulation Mode) */}
        {isSimulation ? (
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2.5 sm:gap-3 min-w-0">
            {/* Mission Clock Display */}
            <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50/80 px-2.5 py-1 text-xs">
              <Clock className="h-3.5 w-3.5 text-sky-700 shrink-0" />
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="font-bold text-sky-900">
                  DAY {currentMissionDay} OF 180
                </span>
                <span className="text-sky-400">·</span>
                <span className="font-semibold text-slate-700 tabular-nums">
                  {utcString}
                </span>
              </div>
            </div>

            {/* Play/Pause & Reset Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleTogglePlay}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-white shadow-2xs transition-all cursor-pointer ${
                  isPlaying
                    ? "bg-amber-600 hover:bg-amber-700 active:scale-95"
                    : "bg-emerald-600 hover:bg-emerald-700 active:scale-95"
                }`}
                title={isPlaying ? "Pause simulation (preserves exact timestamp)" : "Resume / Play simulation"}
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-3.5 w-3.5 fill-white" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-white" />
                    <span>Resume</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={resetToDay1}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                title="Reset simulation back to Day 1 (00:00:00 UTC)"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-600" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>

            {/* Speed Multipliers: 1×, 2×, 5×, 10×, Custom */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-xs shadow-2xs">
              <span className="px-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Speed
              </span>
              {([1, 2, 5, 10] as const).map((spd) => {
                const active = !isCustomSpeedActive && playbackSpeed === spd;
                return (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setSpeed(spd)}
                    className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                      active
                        ? "bg-sky-600 text-white font-bold shadow-2xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    {spd}×
                  </button>
                );
              })}

              {/* Custom Speed Button & Dropdown/Input */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCustomModal((prev) => !prev)}
                  className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
                    isCustomSpeedActive
                      ? "bg-sky-600 text-white font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                  title="Configure custom playback speed (e.g. 60×, 1440×, etc.)"
                >
                  <span>{isCustomSpeedActive ? `${playbackSpeed}×` : "Custom"}</span>
                </button>

                {showCustomModal && (
                  <div className="absolute right-0 top-8 z-50 w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-800">
                        Custom Speed
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCustomModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1"
                        aria-label="Close"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="mt-2.5 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0.1"
                          max="86400"
                          step="1"
                          value={customSpeedInput}
                          onChange={(e) => setCustomSpeedInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              applyCustomSpeed();
                              setShowCustomModal(false);
                            }
                          }}
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:border-sky-500 focus:outline-none"
                          placeholder="e.g. 60"
                        />
                        <span className="text-xs font-bold text-slate-500">×</span>
                      </div>

                      {/* Quick Presets */}
                      <div className="grid grid-cols-3 gap-1 pt-1">
                        {[
                          { val: 60, label: "1m/s" },
                          { val: 360, label: "6m/s" },
                          { val: 1440, label: "1d/s" },
                        ].map(({ val, label }) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => {
                              setCustomSpeed(val);
                              setShowCustomModal(false);
                            }}
                            className="rounded border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-sky-300 px-1 py-1 text-[10px] font-medium text-slate-700 text-center cursor-pointer transition-colors"
                          >
                            {val}× ({label})
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          applyCustomSpeed();
                          setShowCustomModal(false);
                        }}
                        className="w-full mt-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white py-1 text-xs font-bold shadow-xs cursor-pointer"
                      >
                        Apply Speed
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mission Scrubber Slider: Scrub across Day 1 to Day 180 */}
            <div className="flex items-center gap-2 w-full lg:w-48 xl:w-64 pt-1 sm:pt-0">
              <span className="text-[10px] font-mono text-slate-400 shrink-0">
                D1
              </span>
              <input
                type="range"
                min={MISSION_DAY_1_START_MS}
                max={MISSION_ANCHOR_END_MS}
                value={currentTimeMs}
                onChange={handleScrubberChange}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                title={`Mission Day ${currentMissionDay} of 180 (${progressPercent.toFixed(1)}%)`}
              />
              <span className="text-[10px] font-mono text-slate-400 shrink-0">
                D180
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
