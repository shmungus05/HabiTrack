/**
 * web/src/components/SymptomsView.tsx
 * Complete 3-Mode Symptom Reporting Suite:
 * - 💬 AI Diagnostic Chatbot (5-factor triage with suggestion prompts)
 * - 📋 Symptom History Diary (search, severity filter, 1-click JSON export, NASA sample loader)
 * - ⚡ Manual Fast-Log Entry (preserving API submission to /api/symptoms)
 * Styled in the minimalist Perplexity design aesthetic: rounded-lg, font-semibold headings.
 */

import {
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  Plus,
  Search,
  Download,
  Trash2,
  Sparkles,
  Stethoscope,
  Send,
  AlertTriangle,
  Clock,
  MapPin,
  RotateCcw,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { fetchEvents, fetchSymptoms, submitSymptom } from "../services/api";
import type { HealthEvent, ReviewStatus, SymptomReport } from "../types/api";
import { formatDateTime, titleCase } from "../lib/format";
import { Badge, Button } from "./ui";
import { SymptomChatbotModule } from "../features/symptoms/SymptomChatbotModule";
import { useCommsStore } from "../stores/commsStore";
import { ISS_14_MODULES, useStationLocationStore } from "../features/topology";
import { PhysiologicalCards } from "../features/biometrics";

const SYMPTOM_CODES = ["HEADACHE", "FATIGUE", "DIZZINESS", "NAUSEA"] as const;

interface LocalSymptomEntry {
  id: string;
  symptom: string;
  severity: string;
  time: string;
  location: string;
  duration: string;
  description: string;
  environmentalFactor?: string;
}

const SAMPLE_NASA_DIARY: LocalSymptomEntry[] = [
  {
    id: "sym-001",
    symptom: "Headache",
    severity: "Moderate",
    time: "10:12 UTC",
    location: "Node 2 (Harmony) - Crew Quarters",
    duration: "45 mins",
    description: "Bifrontal throbbing pressure developing after 2 hours working on payload rack in Node 2 forward bay.",
    environmentalFactor: "CO₂ elevated in Node 2 pocket (peak 3,620 PPM).",
  },
  {
    id: "sym-002",
    symptom: "Fatigue",
    severity: "Mild",
    time: "08:47 UTC",
    location: "US Lab (Destiny)",
    duration: "2 hours",
    description: "General lethargy and mild heaviness in limbs following morning treadmill workout session.",
    environmentalFactor: "Moderate CO₂ rise during exercise period + cumulative sleep deficit.",
  },
  {
    id: "sym-003",
    symptom: "Dizziness",
    severity: "Mild",
    time: "06:20 UTC",
    location: "Node 1 (Unity)",
    duration: "15 mins",
    description: "Transient postural disorientation upon waking and translating from sleep quarters to galley.",
    environmentalFactor: "Microgravity neuro-vestibular re-adaptation.",
  },
];

interface SymptomsViewProps {
  astronautId: string;
}

export function SymptomsView({ astronautId }: SymptomsViewProps) {
  const [viewMode, setViewMode] = useState<"chatbot" | "history" | "manual">("chatbot");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("ALL");

  // Manual Form States
  const [symptomCode, setSymptomCode] = useState<(typeof SYMPTOM_CODES)[number]>("HEADACHE");
  const [severity, setSeverity] = useState(2);
  const { selectedModuleId, selectedLocation } = useStationLocationStore();
  const currentStationMod = ISS_14_MODULES.find((m) => m.id === selectedModuleId);
  const defaultCabinLocation = `${currentStationMod?.name ?? selectedModuleId} (${selectedLocation})`;
  const [cabinModule, setCabinModule] = useState<string>(defaultCabinLocation);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setCabinModule(`${currentStationMod?.name ?? selectedModuleId} (${selectedLocation})`);
  }, [selectedModuleId, selectedLocation, currentStationMod]);

  const [reports, setReports] = useState<SymptomReport[]>([]);
  const [localDiary, setLocalDiary] = useState<LocalSymptomEntry[]>(() => {
    try {
      const saved = localStorage.getItem("wayfinder_symptom_diary_v3");
      return saved ? JSON.parse(saved) : SAMPLE_NASA_DIARY;
    } catch {
      return SAMPLE_NASA_DIARY;
    }
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("wayfinder_symptom_diary_v3", JSON.stringify(localDiary));
  }, [localDiary]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const symptomReports = await fetchSymptoms(astronautId);
      setReports(symptomReports);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load symptom reports.");
    } finally {
      setIsLoading(false);
    }
  }, [astronautId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const createdReport = await submitSymptom({
        astronaut_id: astronautId,
        symptom_code: symptomCode,
        severity,
        cabin_module: cabinModule,
        notes: notes.trim() || null,
      });

      // Dual confirmation: the station log write already succeeded locally.
      // The ground packet is enqueued asynchronously and may wait in LOS.
      const comms = useCommsStore.getState();
      comms.enqueuePacket("SYMPTOM_REPORT", `${titleCase(symptomCode)} · ${astronautId}`, {
        reportId: createdReport.report_id,
        symptomCode: createdReport.symptom_code,
        severity: createdReport.severity,
        cabinModule: createdReport.cabin_module,
        occurredAt: createdReport.occurred_at,
        notes: createdReport.notes,
      });
      const delayed = comms.linkState === "LOS" || comms.latencySeconds > 0;

      // Also append to local diary
      const newDiaryEntry: LocalSymptomEntry = {
        id: `sym-${Date.now()}`,
        symptom: titleCase(symptomCode),
        severity: severity >= 4 ? "Severe" : severity >= 2 ? "Moderate" : "Mild",
        time: new Date().toLocaleTimeString("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false }) + " UTC",
        location: cabinModule,
        duration: "30 mins",
        description: notes.trim() || `Reported during mission tasks in ${cabinModule}.`,
        environmentalFactor: "CO₂: 3,197 PPM · Rad: 0.20 mGy/d · Temp: 22.8 °C",
      };

      setLocalDiary((prev) => [newDiaryEntry, ...prev]);
      setNotes("");
      setNotice(
        delayed
          ? `✓ Recorded Locally to Station Log · 🛰️ Queued in Ground Outbox (${titleCase(symptomCode)} for ${astronautId})`
          : `✓ Recorded Locally to Station Log · 🛰️ Transmitting to Ground (${titleCase(symptomCode)} for ${astronautId})`,
      );
      await load();
      setViewMode("history");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit symptom report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localDiary, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `astronaut_symptom_diary_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleClearDiary = () => {
    setLocalDiary([]);
    setNotice("Symptom diary cleared.");
    setTimeout(() => setNotice(null), 2500);
  };

  const handleLoadSample = () => {
    setLocalDiary(SAMPLE_NASA_DIARY);
    setNotice("NASA Sample Case Study loaded.");
    setTimeout(() => setNotice(null), 2500);
  };

  const filteredDiary = localDiary.filter((item) => {
    const matchesSearch =
      item.symptom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSeverity =
      filterSeverity === "ALL" || item.severity.toUpperCase() === filterSeverity;

    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Mode Switcher */}
      <div className="p-5 sm:p-6 glass-panel rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Stethoscope className="w-3.5 h-3.5 text-sky-600" />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-700">
              Crew Symptom &amp; Health Log
            </span>
            <span className="text-[11px] font-mono text-muted">{astronautId}</span>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
            Astronaut Symptom Reporting &amp; Diagnostics
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Log physical discomfort, review historical diaries, or run interactive 5-factor clinical triage
          </p>
        </div>

        {/* 3-Mode View Switcher */}
        <div className="flex flex-wrap items-center glass-panel-subtle rounded-xl p-1.5 text-xs self-start md:self-auto gap-1">
          <button
            onClick={() => setViewMode("chatbot")}
            className={`px-3.5 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-colors cursor-pointer border ${
              viewMode === "chatbot"
                ? "bg-white text-sky-700 border-sky-200 shadow-sm"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>AI Diagnostic Chat</span>
          </button>
          <button
            onClick={() => setViewMode("history")}
            className={`px-3.5 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-colors cursor-pointer border ${
              viewMode === "history"
                ? "bg-white text-sky-700 border-sky-200 shadow-sm"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Symptom Diary ({localDiary.length})</span>
          </button>
          <button
            onClick={() => setViewMode("manual")}
            className={`px-3.5 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-colors cursor-pointer border ${
              viewMode === "manual"
                ? "bg-white text-sky-700 border-sky-200 shadow-sm"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manual Fast-Log</span>
          </button>
        </div>
      </div>

      {/* Synchronized Physiological Telemetry & Circadian Envelope */}
      <PhysiologicalCards astronautId={astronautId} />

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* MODE 1: CHATBOT */}
      {viewMode === "chatbot" && (
        <SymptomChatbotModule
          onLogSymptom={(symptom, loc) => {
            const newEntry: LocalSymptomEntry = {
              id: `sym-${Date.now()}`,
              symptom: symptom.slice(0, 30),
              severity: "Moderate",
              time: new Date().toLocaleTimeString("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false }) + " UTC",
              location: loc,
              duration: "30 mins",
              description: symptom,
              environmentalFactor: "CO₂: 3,197 PPM · Rad: 0.20 mGy/d",
            };
            setLocalDiary((prev) => [newEntry, ...prev]);
          }}
        />
      )}

      {/* MODE 2: HISTORY DIARY */}
      {viewMode === "history" && (
        <div className="space-y-6">
          <div className="p-5 sm:p-6 glass-panel rounded-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Search & Filter */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search symptoms or module..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 rounded-lg bg-white border border-border text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex items-center gap-1 glass-panel-subtle p-1 rounded-lg text-xs font-mono">
                  {["ALL", "MILD", "MODERATE", "SEVERE"].map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setFilterSeverity(sev)}
                      className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors ${
                        filterSeverity === sev
                          ? "bg-white text-sky-700 border-sky-200 shadow-sm"
                          : "border-transparent text-muted hover:text-foreground"
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLoadSample}
                  className="px-3.5 py-2 rounded-lg bg-white border border-border hover:border-sky-300 text-xs font-semibold text-secondary hover:text-sky-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                  <span>Load Sample Case</span>
                </button>
                <button
                  onClick={handleExportJSON}
                  className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
                <button
                  onClick={handleClearDiary}
                  className="p-2 rounded-lg bg-white border border-border hover:bg-red-50 hover:border-red-200 text-muted hover:text-red-700 transition-colors cursor-pointer"
                  title="Clear Diary"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Symptom Cards Grid */}
            <div className="space-y-3 pt-2">
              {filteredDiary.length === 0 ? (
                <div className="p-8 text-center text-muted text-xs border border-dashed border-border rounded-xl">
                  No symptom reports match your query.
                </div>
              ) : (
                filteredDiary.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-xl glass-panel-subtle glass-card-hover space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm text-foreground">{item.symptom}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold uppercase tracking-wider ${
                            item.severity === "Severe"
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : item.severity === "Moderate"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {item.severity}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono text-muted">
                        <Clock className="w-3.5 h-3.5 text-sky-600" />
                        <span>{item.time}</span>
                        <span>·</span>
                        <MapPin className="w-3.5 h-3.5 text-sky-600" />
                        <span>{item.location}</span>
                      </div>
                    </div>

                    <p className="text-xs text-secondary leading-relaxed">{item.description}</p>

                    {item.environmentalFactor && (
                      <div className="pt-2 border-t border-border text-[11px] font-mono text-muted flex items-center gap-2">
                        <span className="text-sky-700 font-medium">Telemetry Concordance:</span>
                        <span>{item.environmentalFactor}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: MANUAL FAST-LOG */}
      {viewMode === "manual" && (
        <div className="p-5 sm:p-6 glass-panel rounded-xl max-w-2xl mx-auto space-y-5">
          <div className="border-b border-border pb-4">
            <h3 className="text-base font-semibold text-foreground">Manual Crew Symptom Entry</h3>
            <p className="text-xs text-muted">Validated submission feeding clinical concordance models</p>
          </div>

          <form onSubmit={submitManual} className="space-y-4 text-xs">
            <div>
              <label className="block text-secondary font-semibold mb-1.5">Symptom Classification</label>
              <select
                value={symptomCode}
                onChange={(e) => setSymptomCode(e.target.value as (typeof SYMPTOM_CODES)[number])}
                className="w-full h-10 px-3.5 rounded-lg bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-accent-light cursor-pointer"
              >
                {SYMPTOM_CODES.map((c) => (
                  <option key={c} value={c} className="bg-surface text-foreground">
                    {titleCase(c)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between font-mono mb-1.5">
                <span className="text-secondary font-semibold">Severity Rating</span>
                <span className="text-sky-700 font-semibold">{severity} / 5</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value))}
                className="w-full accent-[#0284c7] cursor-pointer h-1.5 bg-surface-subtle rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[11px] text-muted font-mono mt-1">
                <span>1 - Mild</span>
                <span>3 - Moderate</span>
                <span>5 - Incapacitating</span>
              </div>
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1.5">Spacecraft Compartment &amp; Sensor Location</label>
              <select
                value={cabinModule}
                onChange={(e) => setCabinModule(e.target.value)}
                className="w-full h-10 px-3.5 rounded-lg bg-white border border-border text-foreground text-xs focus:outline-none focus:border-accent cursor-pointer"
              >
                <optgroup label="USOS — U.S. Orbital Segment (8 Modules)">
                  {ISS_14_MODULES.filter((m) => m.segment === "USOS").flatMap((m) =>
                    m.sensorLocations.map((loc) => (
                      <option key={`${m.id}-${loc}`} value={`${m.name} (${loc})`}>
                        {m.name} — {loc}
                      </option>
                    ))
                  )}
                </optgroup>
                <optgroup label="ROS — Russian Orbital Segment (6 Modules)">
                  {ISS_14_MODULES.filter((m) => m.segment === "ROS").flatMap((m) =>
                    m.sensorLocations.map((loc) => (
                      <option key={`${m.id}-${loc}`} value={`${m.name} (${loc})`}>
                        {m.name} — {loc}
                      </option>
                    ))
                  )}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1.5">Observations &amp; Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Frontal throbbing pressure, transient blurriness, onset following exercise…"
                className="w-full p-3 rounded-lg bg-white border border-border text-foreground text-xs focus:outline-none focus:border-accent"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Transmitting..." : "Submit to Station Health Record"}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
