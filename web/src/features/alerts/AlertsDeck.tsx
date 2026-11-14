/**
 * Isolated Component: Cabin Alerts & Clinical Health Action Plans Deck
 * Perplexity minimalist styling:
 * - font-semibold uppercase headers
 * - rounded-lg containers
 * - generous whitespace & micro-animations
 * - 100% preservation of friend's exact 3-part guidance (What Happened, Why It Matters, What To Do)
 */

import React, { useState } from "react";
import { ShieldAlert, CheckCircle2, Check } from "lucide-react";

export interface CabinAlertItem {
  id: string;
  title: string;
  level: "info" | "warning" | "critical";
  timestamp: string;
  message: string;
  module: string;
  acknowledged: boolean;
}

const DEFAULT_ALERTS: CabinAlertItem[] = [
  {
    id: "alt-001",
    title: "CO₂ Elevation in Node 2 (Harmony)",
    level: "warning",
    timestamp: "10:14 UTC",
    message: "Node 2 ppCO₂ exceeded 3,100 PPM threshold. Circulation recommended.",
    module: "Node 2 (Harmony)",
    acknowledged: false,
  },
  {
    id: "alt-002",
    title: "South Atlantic Anomaly Exit",
    level: "info",
    timestamp: "06:22 UTC",
    message: "Radiation flux returned to background (0.19 mGy/day). TEPC nominal.",
    module: "US Lab (Destiny)",
    acknowledged: true,
  },
  {
    id: "alt-003",
    title: "Crew Symptom Logged: Headache",
    level: "warning",
    timestamp: "10:12 UTC",
    message: "Moderate headache reported. AI correlation engine flagged 47-min lag with CO2 spike.",
    module: "Node 2 (Harmony)",
    acknowledged: false,
  },
];

export const AlertsDeck: React.FC<{ className?: string }> = ({ className = "" }) => {
  const [alerts, setAlerts] = useState<CabinAlertItem[]>(DEFAULT_ALERTS);
  const [filter, setFilter] = useState<"ACTIVE" | "ALL">("ACTIVE");

  const acknowledgeAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    );
  };

  const alertDetails: Record<
    string,
    { whatHappened: string; whyItMatters: string; whatToDo: string[] }
  > = {
    "alt-001": {
      whatHappened:
        "Cabin carbon dioxide in Node 2 (Harmony) reached 3,197 PPM, exceeding the normal flight limit of 3,000 PPM.",
      whyItMatters:
        "In zero gravity, cephalic fluid shift redistributes blood headward. Elevated CO2 dilates cerebral blood vessels, causing frontal throbbing headaches and cognitive fatigue.",
      whatToDo: [
        "Turn on personal ventilation diffuser fans in Node 2 to eliminate stagnant air pockets.",
        "Hydrate with 500 mL water or electrolyte drink to support cephalic venous return.",
        "Take a restorative rest break in the US Lab where circulation is higher (2,450 PPM).",
      ],
    },
    "alt-002": {
      whatHappened:
        "The International Space Station has safely exited the South Atlantic Anomaly (SAA) high-radiation corridor.",
      whyItMatters:
        "Cosmic radiation dose rate has returned to quiet baseline (0.19 mGy/day). Total accumulated crew dose remains safely within ALARA limits.",
      whatToDo: [
        "Normal maintenance and science payload operations can proceed without extra radiation precautions.",
        "Dosimeter badges will automatically downlink telemetry during the next ground tracking pass.",
      ],
    },
    "alt-003": {
      whatHappened:
        "A moderate headache symptom report was logged in Node 2 following a 2-hour payload work session.",
      whyItMatters:
        "The AI concordance engine detected that this symptom occurred 47 minutes after a localized CO2 concentration spike, matching NASA LSDA latency curves.",
      whatToDo: [
        "Rest for 20 minutes in a high-ventilation compartment.",
        "Confirm that the overhead cabin air vent is unblocked and directing airflow forward.",
        "If discomfort persists beyond 45 minutes, initiate ground communication with the Houston Flight Surgeon.",
      ],
    },
  };

  const activeAlerts = alerts.filter((a) => !a.acknowledged);
  const displayedAlerts = filter === "ACTIVE" ? activeAlerts : alerts;

  return (
    <section
      className={`p-4 sm:p-6 bg-surface rounded-lg border border-border relative overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-critical" />
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
              Flight Medicine · Action Plans
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
            Cabin Alerts &amp; Clinical Health Action Plans
          </h2>
          <p className="text-xs text-muted mt-1">
            Clear, actionable guidance when cabin air quality or health indicators require attention
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center bg-surface-elevated rounded-lg p-1 border border-border text-xs">
          <button
            onClick={() => setFilter("ACTIVE")}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              filter === "ACTIVE"
                ? "bg-surface-subtle text-foreground border border-border-strong"
                : "text-muted hover:text-foreground border border-transparent"
            }`}
          >
            Active ({activeAlerts.length})
          </button>
          <button
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              filter === "ALL"
                ? "bg-surface-subtle text-foreground border border-border-strong"
                : "text-muted hover:text-foreground border border-transparent"
            }`}
          >
            All Alerts ({alerts.length})
          </button>
        </div>
      </div>

      {/* Explanatory Note */}
      <div className="mt-5 border-l border-border pl-3 text-[11px] leading-relaxed text-muted">
        Alerts cross-reference live environmental telemetry against NASA flight medicine rules
        to protect crew health and prevent hypercapnic space headaches.
      </div>

      {/* Alerts Feed */}
      <div className="mt-5 space-y-3">
        {displayedAlerts.length === 0 ? (
          <div className="p-10 text-center rounded-lg bg-surface-elevated border border-border space-y-2">
            <CheckCircle2 className="w-8 h-8 text-secondary mx-auto" />
            <h3 className="text-sm font-semibold text-foreground">No active alerts</h3>
            <p className="text-xs text-muted max-w-md mx-auto">
              Atmospheric CO₂, ambient temperature, and dosimetric flux are within verified
              flight safety bounds.
            </p>
          </div>
        ) : (
          displayedAlerts.map((alert) => {
            const isResolved = alert.acknowledged;
            const details = alertDetails[alert.id] ?? {
              whatHappened: alert.message,
              whyItMatters: "Environmental telemetry deviated from nominal orbital baseline.",
              whatToDo: ["Inspect localized compartment air diffuser.", "Check vitals if symptoms arise."],
            };

            return (
              <div
                key={alert.id}
                className={`p-5 rounded-lg border transition-colors ${
                  isResolved
                    ? "bg-surface-elevated/50 border-border opacity-70"
                    : alert.level === "critical"
                    ? "bg-surface-elevated border-border border-l-2 border-l-critical"
                    : "bg-surface-elevated border-border hover:border-border-strong"
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isResolved
                          ? "bg-faint"
                          : alert.level === "critical"
                          ? "bg-critical animate-pulse"
                          : "bg-foreground"
                      }`}
                    />
                    <div>
                      <h3 className="text-sm font-semibold text-foreground tracking-tight">{alert.title}</h3>
                      <div className="text-[11px] text-muted font-mono flex items-center gap-2 mt-0.5">
                        <span className="text-secondary">{alert.module}</span>
                        <span>·</span>
                        <span>{alert.timestamp}</span>
                      </div>
                    </div>
                  </div>

                  {!isResolved ? (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="px-3 py-1.5 rounded-md bg-transparent hover:bg-surface-subtle border border-border-strong text-[11px] font-medium text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Acknowledge</span>
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 rounded-md border border-border text-[11px] text-muted font-mono flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Acknowledged</span>
                    </span>
                  )}
                </div>

                {/* 3 Humanized Plain-Language Sections */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border mt-4 border border-border rounded-lg overflow-hidden">
                  <div className="p-4 bg-surface-subtle space-y-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                      01 · What happened
                    </span>
                    <p className="text-xs leading-relaxed text-secondary">{details.whatHappened}</p>
                  </div>

                  <div className="p-4 bg-surface-subtle space-y-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                      02 · Why it matters
                    </span>
                    <p className="text-xs leading-relaxed text-secondary">{details.whyItMatters}</p>
                  </div>

                  <div className="p-4 bg-surface-subtle space-y-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                      03 · What to do
                    </span>
                    <ul className="space-y-1.5 mt-1">
                      {details.whatToDo.map((step, sIdx) => (
                        <li key={sIdx} className="flex items-start gap-1.5 text-xs leading-relaxed text-secondary">
                          <span className="text-muted shrink-0">{String(sIdx + 1).padStart(2, "0")}</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
