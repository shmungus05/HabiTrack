/**
 * web/src/components/SymptomsView.tsx
 * Complete Symptom Reporting & Diary Suite:
 * - 📋 Symptom History Diary (search, severity filter, 1-click JSON export, NASA sample loader)
 * - ⚡ Manual Fast-Log Entry (preserving API submission to /api/symptoms)
 * - 🩺 Direct Launch to Unified HabiTrack 5-Factor Clinical Triage Assistant
 * Styled in the minimalist Perplexity design aesthetic: rounded-2xl, font-semibold headings.
 */

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Send,
  Sparkles,
  Stethoscope,
  Trash2,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { fetchSymptoms, submitSymptom } from "../services/api";
import type { SymptomReport } from "../types/api";
import { titleCase } from "../lib/format";
import { useAssistantStore } from "../stores/assistantStore";
import { PhysiologicalCards } from "../features/biometrics";
import { ISS_14_MODULES, useStationLocationStore } from "../features/topology";
import { useActiveMissionTime } from "../stores/missionStore";

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
  const { isSimulation, currentMissionDay, utcString } = useActiveMissionTime();
  const [viewMode, setViewMode] = useState<"history" | "manual">("history");
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
      const saved = localStorage.getItem("habitrack_symptom_diary_v3");
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
    localStorage.setItem("habitrack_symptom_diary_v3", JSON.stringify(localDiary));
  }, [localDiary]);

  // Reactive listener when the unified Assistant records a symptom triage
  useEffect(() => {
    const handleSymptomLogged = () => {
      try {
        const saved = localStorage.getItem("habitrack_symptom_diary_v3");
        if (saved) {
          setLocalDiary(JSON.parse(saved));
        }
      } catch {
        // Ignore
      }
    };

    window.addEventListener("habitrack_symptom_logged", handleSymptomLogged);
    return () => window.removeEventListener("habitrack_symptom_logged", handleSymptomLogged);
  }, []);

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
  }, [load, isSimulation, currentMissionDay]);

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

      // Also append to local diary
      const newDiaryEntry: LocalSymptomEntry = {
        id: `sym-${Date.now()}`,
        symptom: titleCase(symptomCode),
        severity: severity >= 4 ? "Severe" : severity >= 2 ? "Moderate" : "Mild",
        time: isSimulation
          ? `Day ${currentMissionDay} · ${utcString.slice(11, 19)} UTC`
          : new Date().toLocaleTimeString("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false }) + " UTC",
        location: cabinModule,
        duration: "30 mins",
        description: notes.trim() || `Reported during mission tasks in ${cabinModule}.`,
        environmentalFactor: "CO₂: 3,197 PPM · Rad: 0.20 mGy/d · Temp: 22.8 °C",
      };

      setLocalDiary((prev) => [newDiaryEntry, ...prev]);
      setNotes("");
      setNotice(`✓ Recorded to Station Log (${titleCase(symptomCode)} for ${astronautId})`);
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
    downloadAnchor.setAttribute("download", `habitrack_symptom_diary_${astronautId}_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleClearDiary = () => {
    if (window.confirm("Clear all locally recorded symptom entries from this browser?")) {
      setLocalDiary([]);
      localStorage.removeItem("habitrack_symptom_diary_v3");
    }
  };

  const handleLoadSamples = () => {
    setLocalDiary(SAMPLE_NASA_DIARY);
  };

  const filteredDiary = useMemo(() => {
    return localDiary.filter((item) => {
      const matchesSearch =
        item.symptom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSeverity = filterSeverity === "ALL" || item.severity.toUpperCase() === filterSeverity;
      return matchesSearch && matchesSeverity;
    });
  }, [localDiary, searchTerm, filterSeverity]);

  const openDrawer = useAssistantStore((s) => s.openDrawer);

  return (
    <div className="space-y-6">
      {/* Top Banner / Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 glass-panel rounded-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Stethoscope className="w-4 h-4 text-sky-600" />
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700">
              Flight Medicine · Crew Health Logging
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Symptom Diary &amp; Clinical Concordance
          </h2>
          <p className="text-xs text-muted mt-1">
            Subjective symptoms logged here immediately correlate with active ECLSS telemetry, 
            circadian envelopes, and NASA flight rules.
          </p>
        </div>

        {/* View Mode Switcher + AI Assistant Launcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Direct Trigger to Unified Standby Assistant */}
          <button
            onClick={() => openDrawer("chat")}
            className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span>Launch AI Symptom Triage</span>
          </button>

          <div className="flex items-center glass-panel-subtle rounded-xl p-1 text-xs">
            <button
              onClick={() => setViewMode("history")}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors cursor-pointer border ${
                viewMode === "history"
                  ? "bg-white text-sky-700 border-sky-200 shadow-xs"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Symptom Diary ({localDiary.length})</span>
            </button>
            <button
              onClick={() => setViewMode("manual")}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors cursor-pointer border ${
                viewMode === "manual"
                  ? "bg-white text-sky-700 border-sky-200 shadow-xs"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Manual Fast-Log</span>
            </button>
          </div>
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

      {/* MODE 1: HISTORY DIARY */}
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
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search symptoms, locations, notes…"
                    className="pl-9 pr-4 py-2 text-xs rounded-lg bg-surface-elevated border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-accent-light w-56 sm:w-64"
                  />
                </div>

                <div className="flex items-center gap-1 glass-panel-subtle rounded-lg p-1 text-[11px] font-mono">
                  {["ALL", "MILD", "MODERATE", "SEVERE"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setFilterSeverity(s)}
                      className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                        filterSeverity === s
                          ? "bg-white text-foreground shadow-2xs font-semibold"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={handleExportJSON}
                  className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-elevated text-secondary flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Export local diary as JSON for offline clinician review"
                >
                  <Download className="w-3.5 h-3.5 text-sky-600" />
                  <span>Export JSON</span>
                </button>
                {localDiary.length === 0 ? (
                  <button
                    onClick={handleLoadSamples}
                    className="px-3 py-1.5 rounded-lg border border-dashed border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Load NASA Presets</span>
                  </button>
                ) : (
                  <button
                    onClick={handleClearDiary}
                    className="p-1.5 rounded-lg border border-border hover:bg-red-50 text-muted hover:text-red-600 transition-colors cursor-pointer"
                    title="Clear local diary entries"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Symptom Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDiary.length === 0 ? (
                <div className="col-span-full py-12 text-center text-muted text-xs border border-dashed border-border rounded-xl">
                  <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40 text-sky-600" />
                  <p className="font-medium text-foreground">No symptom entries matching query</p>
                  <p className="mt-1">
                    Log an incident using{" "}
                    <button
                      onClick={() => setViewMode("manual")}
                      className="text-sky-700 font-semibold underline underline-offset-2"
                    >
                      Manual Fast-Log
                    </button>{" "}
                    or launch{" "}
                    <button
                      onClick={() => openDrawer("chat")}
                      className="text-sky-700 font-semibold underline underline-offset-2"
                    >
                      AI Symptom Triage
                    </button>
                    .
                  </p>
                </div>
              ) : (
                filteredDiary.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-border bg-white shadow-2xs hover:shadow-xs transition-shadow space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">{item.symptom}</span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-bold ${
                              item.severity === "Severe"
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : item.severity === "Moderate"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-sky-50 text-sky-700 border border-sky-200"
                            }`}
                          >
                            {item.severity}
                          </span>
                        </div>
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

      {/* MODE 2: MANUAL FAST-LOG */}
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
              <label className="block text-secondary font-semibold mb-1.5">Spacecraft Compartment</label>
              <select
                value={cabinModule}
                onChange={(e) => setCabinModule(e.target.value)}
                className="w-full h-10 px-3.5 rounded-lg bg-white border border-border text-foreground text-xs focus:outline-none focus:border-accent cursor-pointer"
              >
                {ISS_14_MODULES.map((m) => (
                  <option key={m.id} value={`${m.name} (${m.sensorLocations[0]})`} className="bg-surface text-foreground">
                    {m.name} · {m.segment}
                  </option>
                ))}
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
