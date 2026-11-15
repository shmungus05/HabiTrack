/**
 * Spacecraft Compartment & Sensor Location Selector
 *
 * Placed directly above the "Cabin Environmental Telemetry" card.
 * Synchronizes module selection across the operational dashboard.
 */

import React from "react";
import {
  Compass,
  ChevronRight,
} from "lucide-react";
import {
  ISS_14_MODULES,
  useStationLocationStore,
} from "./SpacecraftTopologyModule";

interface SpacecraftModuleSelectorProps {
  astronautId?: string;
  isSurgeon?: boolean;
  className?: string;
}

export const SpacecraftModuleSelector: React.FC<SpacecraftModuleSelectorProps> = ({
  className = "",
}) => {
  const {
    selectedModuleId,
    setSelectedModule,
  } = useStationLocationStore();

  const activeModule =
    ISS_14_MODULES.find((m) => m.id === selectedModuleId) ?? ISS_14_MODULES[7]; // Default Harmony

  const handleModuleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModule(e.target.value);
  };

  const usosModules = ISS_14_MODULES.filter((m) => m.segment === "USOS");
  const rosModules = ISS_14_MODULES.filter((m) => m.segment === "ROS");

  return (
    <div
      className={`rounded-xl border border-slate-200/90 bg-white/90 backdrop-blur shadow-2xs p-3.5 space-y-3 ${className}`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-sky-50 text-sky-700 border border-sky-200/70 shrink-0">
            <Compass className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Station Compartment &amp; Sensor Location
          </span>
        </div>
      </div>

      {/* Orbital Module Dropdown */}
      <div className="w-full">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
          Orbital Module (14 Stations):
        </label>
        <div className="relative">
          <select
            value={activeModule.id}
            onChange={handleModuleChange}
            className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-900 shadow-2xs hover:bg-white hover:border-slate-300 focus:border-sky-500 focus:bg-white focus:outline-none transition-colors cursor-pointer truncate pr-8"
          >
            <optgroup label="USOS – U.S. Orbital Segment (8 Modules)">
              {usosModules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="ROS – Russian Orbital Segment (6 Modules)">
              {rosModules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </optgroup>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
            <ChevronRight className="h-4 w-4 rotate-90" />
          </div>
        </div>
      </div>
    </div>
  );
};
