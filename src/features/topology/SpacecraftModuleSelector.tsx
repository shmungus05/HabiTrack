/**
 * Isolated Component: Spacecraft Compartment Topology Selector
 * Perplexity minimalist styling:
 * - font-semibold uppercase headers
 * - rounded-lg containers
 * - generous whitespace & micro-animations
 */

import React, { useState } from "react";
import { Compass, Cpu, Radio, Shield, Wind, CheckCircle2 } from "lucide-react";
import { ISS_COMPARTMENTS, type SpacecraftModule } from "./SpacecraftTopologyModule";

interface SpacecraftModuleSelectorProps {
  selectedModuleId?: string;
  onSelectModule?: (module: SpacecraftModule) => void;
  className?: string;
}

export const SpacecraftModuleSelector: React.FC<SpacecraftModuleSelectorProps> = ({
  selectedModuleId = "node2",
  onSelectModule,
  className = "",
}) => {
  const [activeId, setActiveId] = useState<string>(selectedModuleId);

  const activeModule =
    ISS_COMPARTMENTS.find((m) => m.id === activeId) ?? ISS_COMPARTMENTS[0];

  const handleSelect = (mod: SpacecraftModule) => {
    setActiveId(mod.id);
    onSelectModule?.(mod);
  };

  return (
    <section
      className={`p-5 sm:p-6 glass-panel rounded-xl relative overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Compass className="w-3.5 h-3.5 text-sky-600" />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-700">
              Station Environmental Architecture
            </span>
            <span className="text-[11px] font-mono text-muted">
              · ISS Orbital Complex
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
            Spacecraft Compartment Topology
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Atmospheric recirculation loops, ventilation nodes, and localized sensor suites
          </p>
        </div>

        <div className="text-right hidden sm:block">
          <span className="text-xs font-mono text-muted">Active Node:</span>
          <p className="text-sm font-semibold text-sky-700 font-mono">{activeModule.name}</p>
        </div>
      </div>

      {/* Module Selector Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-6">
        {ISS_COMPARTMENTS.map((mod) => {
          const isSelected = mod.id === activeModule.id;
          return (
            <button
              key={mod.id}
              onClick={() => handleSelect(mod)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative glass-card-hover ${
                isSelected
                  ? "bg-sky-50 border-sky-300 border-l-2 border-l-sky-600 text-foreground"
                  : "glass-panel-subtle text-secondary hover:text-foreground"
              }`}
            >
              <span className="block text-xs font-semibold truncate">{mod.name}</span>
              <span className="block text-[11px] text-muted truncate mt-0.5">
                {mod.function.split("&")[0].trim()}
              </span>
              <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                <span className={isSelected ? "text-[#0284c7] font-semibold" : "text-muted"}>
                  {mod.nominalCO2} PPM
                </span>
                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Compartment Detail Card */}
      <div className="mt-6 p-5 rounded-xl glass-panel-subtle grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <span className="text-[11px] font-mono uppercase text-sky-700 tracking-wider">
            Operational Purpose
          </span>
          <p className="text-xs font-semibold text-foreground mt-1">{activeModule.function}</p>
        </div>

        <div>
          <span className="text-[11px] font-mono uppercase text-sky-700 tracking-wider">
            ECLSS Sensor Array
          </span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {activeModule.primarySensors.map((sensor) => (
              <span
                key={sensor}
                className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-white text-secondary border border-border"
              >
                {sensor}
              </span>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[11px] font-mono uppercase text-sky-700 tracking-wider">
            Nominal Atmospheric Target
          </span>
          <div className="flex flex-wrap items-center gap-2.5 mt-1 text-xs font-mono">
            <span className="text-[#0284c7]">CO₂: {activeModule.nominalCO2} PPM</span>
            <span className="text-muted">·</span>
            <span className="text-[#ea580c]">Temp: {activeModule.nominalTemp} °C</span>
            <span className="text-muted">·</span>
            <span className="text-[#0891b2]">RH: {activeModule.nominalHumidity}%</span>
          </div>
        </div>
      </div>
    </section>
  );
};
