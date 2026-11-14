/**
 * Isolated Component: Cabin Alerts & Clinical Health Action Plans Deck
 * Perplexity minimalist styling:
 * - font-semibold uppercase headers
 * - rounded-lg containers
 * - generous whitespace & micro-animations
 * - 100% preservation of friend's exact 3-part guidance (What Happened, Why It Matters, What To Do)
 */

import React, { useState } from "react";
import { ShieldAlert, CheckCircle2, Check, AlertCircle, AlertTriangle } from "lucide-react";

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
      className={`p-5 sm:p-6 glass-panel rounded-xl relative overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-700">
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
        <div className="flex items-center glass-panel-subtle rounded-xl p-1 text-xs gap-1">
          <button
            onClick={() => setFilter("ACTIVE")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer border ${
              filter === "ACTIVE"
                ? "bg-white text-sky-700 border-sky-200 shadow-sm"
                : "text-muted hover:text-foreground border-transparent"
            }`}
          >
            Active ({activeAlerts.length})
          </button>
          <button
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer border ${
              filter === "ALL"
                ? "bg-white text-sky-700 border-sky-200 shadow-sm"
                : "text-muted hover:text-foreground border-transparent"
            }`}
          >
            All Alerts ({alerts.length})
          </button>
        </div>
      </div>

      {/* Explanatory Note */}
      <div className="mt-5 border-l-2 border-sky-500 pl-3 text-[11px] leading-relaxed text-secondary">
        Alerts cross-reference live environmental telemetry against NASA flight medicine rules
        to protect crew health and prevent hypercapnic space headaches.
      </div>

      {/* Alerts Feed */}
      <div className="mt-5 space-y-3.5">
        {displayedAlerts.length === 0 ? (
          <div className="p-10 text-center rounded-xl glass-panel-subtle space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
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

            const levelAccent = isResolved
              ? "opacity-75 border-border"
              : alert.level === "critical"
              ? "border-l-2 border-l-red-500 border-red-200"
              : alert.level === "warning"
              ? "border-l-2 border-l-amber-500 border-amber-200"
              : "border-l-2 border-l-emerald-500 border-emerald-200";

            return (
              <div
                key={alert.id}
                className={`p-5 rounded-xl glass-panel-subtle glass-card-hover transition-all ${levelAccent}`}
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    {isResolved ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : alert.level === "critical" ? (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 animate-pulse" />
                    ) : alert.level === "warning" ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <div>
                      <h3 className="text-sm font-semibold text-foreground tracking-tight">{alert.title}</h3>
                      <div className="text-[11px] text-muted font-mono flex items-center gap-2 mt-0.5">
                        <span className="text-sky-700">{alert.module}</span>
                        <span>·</span>
                        <span>{alert.timestamp}</span>
                      </div>
                    </div>
                  </div>

                  {!isResolved ? (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-[11px] font-medium text-sky-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Acknowledge</span>
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-700 font-mono flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Acknowledged</span>
                    </span>
                  )}
                </div>

                {/* 3 Humanized Plain-Language Sections */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border mt-4 border border-border rounded-xl overflow-hidden">
                  <div className="p-4 bg-white space-y-1.5">
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-sky-700">
                      01 · What happened
                    </span>
                    <p className="text-xs leading-relaxed text-secondary">{details.whatHappened}</p>
                  </div>

                  <div className="p-4 bg-white space-y-1.5">
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber-700">
                      02 · Why it matters
                    </span>
                    <p className="text-xs leading-relaxed text-secondary">{details.whyItMatters}</p>
                  </div>

                  <div className="p-4 bg-white space-y-1.5">
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-emerald-700">
                      03 · What to do
                    </span>
                    <ul className="space-y-1.5 mt-1">
                      {details.whatToDo.map((step, sIdx) => (
                        <li key={sIdx} className="flex items-start gap-1.5 text-xs leading-relaxed text-secondary">
                          <span className="text-sky-600 font-mono shrink-0">{String(sIdx + 1).padStart(2, "0")}</span>
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
