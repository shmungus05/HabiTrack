/**
 * Isolated Component: NASA Open Science Data Repository Catalog & Downloader
 * Perplexity minimalist styling:
 * - font-semibold uppercase headers
 * - rounded-lg containers
 * - generous whitespace & micro-animations
 * - 100% preservation of DOIs, variable schemas, and JSON exports
 */

import React, { useState } from "react";
import {
  Database,
  Download,
  ExternalLink,
  ShieldCheck,
  FileCode,
  BookOpen,
  CheckCircle2,
} from "lucide-react";
import {
  NASA_DATASETS_CATALOG,
  exportDatasetToJson,
  type NasaDatasetEntry,
} from "./NasaDatasetsModule";

export const NasaDatasetsCatalog: React.FC<{ className?: string }> = ({ className = "" }) => {
  const [selectedDataset, setSelectedDataset] = useState<NasaDatasetEntry>(
    NASA_DATASETS_CATALOG[0],
  );
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleExport = () => {
    exportDatasetToJson(selectedDataset.id);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  return (
    <section
      className={`p-4 sm:p-6 bg-surface rounded-lg border border-border relative overflow-hidden ${className}`}
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-3.5 h-3.5 text-muted" />
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">NASA Open Science Data Repository</span>
            <span className="text-[11px] font-mono text-muted">
              Verifiable Flight Provenance & DOIs
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
            Scientific Datasets &amp; Telemetry Catalog
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Authentic public repositories from NASA EDA, OSDR, RadLab, and LSDA
          </p>
        </div>

        {/* 1-Click JSON Export Button */}
        <div className="flex items-center gap-2">
          {downloadSuccess && (
            <span className="text-xs font-mono font-medium text-foreground flex items-center gap-1 animate-fadeIn">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Exported!
            </span>
          )}
          <button
            onClick={handleExport}
            className="px-4 py-2 rounded-lg bg-accent-secondary hover:bg-accent-hover text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export JSON Archive</span>
          </button>
        </div>
      </div>

      {/* Dataset Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-6">
        {NASA_DATASETS_CATALOG.map((ds) => {
          const isSelected = ds.id === selectedDataset.id;
          return (
            <button
              key={ds.id}
              onClick={() => setSelectedDataset(ds)}
              className={`p-4 rounded-lg border text-left transition-colors cursor-pointer ${
                isSelected
                  ? "bg-surface-subtle border-border-strong border-l-2 border-l-accent-secondary text-foreground"
                  : "bg-surface-elevated border-border text-muted hover:text-foreground hover:border-border-strong"
              }`}
            >
              <span className="block text-xs font-semibold truncate">{ds.name.split("—")[0].trim()}</span>
              <span className="block text-[10px] text-muted truncate mt-0.5">{ds.category}</span>
              <span className="block text-[10px] font-mono text-foreground truncate mt-2">{ds.doi}</span>
            </button>
          );
        })}
      </div>

      {/* Active Dataset Inspection Card */}
      <div className="mt-5 p-5 rounded-lg bg-surface-elevated border border-border space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{selectedDataset.name}</h3>
            <p className="text-xs font-mono text-muted mt-0.5">
              Mission: <span className="text-foreground">{selectedDataset.mission}</span> · Sampling:{" "}
              <span className="text-foreground">{selectedDataset.samplingRate}</span>
            </p>
          </div>
          <a
            href={selectedDataset.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-secondary bg-surface-subtle border border-border hover:text-foreground hover:border-border-strong transition-colors cursor-pointer self-start sm:self-auto"
          >
            <span>Visit NASA Portal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <p className="text-xs text-secondary leading-relaxed">{selectedDataset.description}</p>

        {/* Variables Table */}
        <div>
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
            Sensor Telemetry &amp; Variable Specifications:
          </span>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted font-mono uppercase tracking-wider text-[10px]">
                  <th className="p-2.5">Variable</th>
                  <th className="p-2.5">Sensor Unit</th>
                  <th className="p-2.5">Nominal Flight Band</th>
                  <th className="p-2.5">Hardware Sensor Suite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle font-mono text-[11px]">
                {selectedDataset.variables.map((v) => (
                  <tr key={v.name} className="hover:bg-surface-subtle transition-colors">
                    <td className="p-2.5 font-medium text-foreground">{v.label}</td>
                    <td className="p-2.5 text-foreground">{v.unit}</td>
                    <td className="p-2.5 text-secondary">{v.nominalRange}</td>
                    <td className="p-2.5 text-muted">{v.sensor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pt-2 border-t border-border text-[11px] text-faint font-mono">
          Attribution: {selectedDataset.attribution}
        </div>
      </div>
    </section>
  );
};
