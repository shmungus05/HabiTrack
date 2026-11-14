/**
 * Spacecraft Compartment & Sensor Location Selector
 *
 * Placed exclusively directly above the "Cabin Environmental Telemetry" card.
 * Synchronizes module and essential sensor locations across all pages.
 * Supports auto-detection based on the active astronaut's station position.
 */

import React, { useEffect } from "react";
import {
  Compass,
  MapPin,
  RotateCcw,
  Radio,
  Wind,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import {
  ISS_14_MODULES,
  useStationLocationStore,
  type SpacecraftModule,
} from "./SpacecraftTopologyModule";

interface SpacecraftModuleSelectorProps {
  astronautId?: string;
  isSurgeon?: boolean;
  className?: string;
}

export const SpacecraftModuleSelector: React.FC<SpacecraftModuleSelectorProps> = ({
  astronautId,
  isSurgeon = false,
  className = "",
}) => {
  const {
    selectedModuleId,
    selectedLocation,
    isAutoDetected,
    setSelectedModule,
    setSelectedLocation,
    autoDetectForAstronaut,
  } = useStationLocationStore();

  // In astronaut perspective (or initially), auto-detect position based on active astronaut
  useEffect(() => {
    if (astronautId && (!isSurgeon || isAutoDetected)) {
      autoDetectForAstronaut(astronautId);
    }
  }, [astronautId, isSurgeon]);

  const activeModule =
    ISS_14_MODULES.find((m) => m.id === selectedModuleId) ?? ISS_14_MODULES[7]; // Default Harmony

  const handleModuleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModule(e.target.value);
  };

  const handleLocationClick = (loc: string) => {
    setSelectedLocation(loc);
  };

  const handleResetToAstronaut = () => {
    if (astronautId) {
      autoDetectForAstronaut(astronautId);
    }
  };

  const usosModules = ISS_14_MODULES.filter((m) => m.segment === "USOS");
  const rosModules = ISS_14_MODULES.filter((m) => m.segment === "ROS");

  return (
    <div
      className={`rounded-xl border border-slate-200/90 bg-white/90 backdrop-blur shadow-2xs p-3.5 space-y-3 ${className}`}
    >
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-sky-50 text-sky-700 border border-sky-200/70 shrink-0">
            <Compass className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Station Compartment &amp; Sensor Location
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono border ${
                activeModule.segment === "USOS"
                  ? "bg-sky-50 text-sky-800 border-sky-200"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
              }`}
            >
              {activeModule.segment} Segment
            </span>
          </div>
        </div>

        {/* Auto-Detection Indicator & Re-center Action */}
        <div className="flex items-center gap-2">
          {isAutoDetected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>Auto-Detected Crew Position</span>
              {astronautId && <strong className="font-mono">({astronautId})</strong>}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                <MapPin className="h-3 w-3 text-amber-600 shrink-0" />
                <span>Station Remote Sensor View</span>
              </span>
              {astronautId && (
                <button
                  type="button"
                  onClick={handleResetToAstronaut}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-medium text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors cursor-pointer"
                  title="Re-align with astronaut's detected compartment"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Auto-Detect</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Selector Controls: 14 Modules Dropdown & Essential Sensor Locations Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        {/* Module Dropdown (14 Modules in 2 Segments) */}
        <div className="sm:col-span-5 min-w-0">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Orbital Module (14 Stations):
          </label>
          <div className="relative">
            <select
              value={activeModule.id}
              onChange={handleModuleChange}
              className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-2xs hover:bg-white hover:border-slate-300 focus:border-sky-500 focus:bg-white focus:outline-none transition-colors cursor-pointer truncate pr-7"
            >
              <optgroup label="USOS – U.S. Orbital Segment (8 Modules)">
                {usosModules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.shortName})
                  </option>
                ))}
              </optgroup>
              <optgroup label="ROS – Russian Orbital Segment (6 Modules)">
                {rosModules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.shortName})
                  </option>
                ))}
              </optgroup>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
              <ChevronRight className="h-3.5 w-3.5 rotate-90" />
            </div>
          </div>
        </div>

        {/* Essential Sensor Locations for the Selected Module */}
        <div className="sm:col-span-7 min-w-0">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Essential Sensor Locations in {activeModule.shortName}:
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {activeModule.sensorLocations.map((loc, idx) => {
              const isSelected = selectedLocation === loc;
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => handleLocationClick(loc)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium cursor-pointer transition-all ${
                    isSelected
                      ? "bg-sky-600 text-white font-semibold shadow-xs"
                      : "bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/80"
                  }`}
                >
                  <span className={`text-[10px] font-mono ${isSelected ? "text-sky-200" : "text-slate-400"}`}>
                    0{idx + 1}
                  </span>
                  <span>{loc}</span>
                  {isSelected && <CheckCircle2 className="h-3 w-3 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
