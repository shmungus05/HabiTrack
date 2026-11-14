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
      className={`p-4 sm:p-6 bg-surface rounded-lg border border-border relative overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Compass className="w-3.5 h-3.5 text-muted" />
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">Station Environmental Architecture</span>
            <span className="text-[11px] font-mono text-muted">
              ISS Orbital Complex
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
          <p className="text-sm font-semibold text-foreground font-mono">{activeModule.name}</p>
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
              className={`p-3 rounded-lg border text-left transition-colors cursor-pointer relative ${
                isSelected
                  ? "bg-surface-subtle border-border-strong border-l-2 border-l-accent-secondary text-foreground"
                  : "bg-surface-elevated border-border text-muted hover:text-foreground hover:border-border-strong"
              }`}
            >
              <span className="block text-xs font-semibold truncate">{mod.name}</span>
              <span className="block text-[10px] text-muted truncate mt-0.5">
                {mod.function.split("&")[0].trim()}
              </span>
              <div className="mt-2 flex items-center justify-between text-[10px] font-mono">
                <span className={isSelected ? "text-foreground" : "text-faint"}>
                  {mod.nominalCO2} PPM
                </span>
                {isSelected && <CheckCircle2 className="w-3 h-3 text-foreground shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Compartment Detail Card */}
      <div className="mt-6 p-5 rounded-lg bg-surface-elevated border border-border grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <span className="text-[10px] font-mono uppercase text-muted tracking-wider">
            Operational Purpose
          </span>
          <p className="text-xs font-semibold text-foreground mt-1">{activeModule.function}</p>
        </div>

        <div>
          <span className="text-[10px] font-mono uppercase text-muted tracking-wider">
            ECLSS Sensor Array
          </span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {activeModule.primarySensors.map((sensor) => (
              <span
                key={sensor}
                className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-surface-subtle text-secondary border border-border"
              >
                {sensor}
              </span>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[10px] font-mono uppercase text-muted tracking-wider">
            Nominal Atmospheric Target
          </span>
          <div className="flex items-center gap-3 mt-1 text-xs font-mono text-secondary">
            <span>CO₂: {activeModule.nominalCO2} PPM</span>
            <span>·</span>
            <span>Temp: {activeModule.nominalTemp} °C</span>
            <span>·</span>
            <span>RH: {activeModule.nominalHumidity}%</span>
          </div>
        </div>
      </div>
    </section>
  );
};
