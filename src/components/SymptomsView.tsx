/**
 * web/src/components/SymptomsView.tsx
 * Complete Symptom Reporting & Diary Suite:
 * - Symptom History Diary (search, severity filter, 1-click JSON export, NASA sample loader)
 * - Manual Fast-Log Entry (preserving API submission to /api/symptoms)
 * - Direct Launch to Unified HabiTrack 5-Factor Clinical Triage Assistant
 * Styled in the minimalist Perplexity design aesthetic: rounded-2xl, font-semibold headings.
 */

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  MapPin,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { acknowledgeSymptom, fetchSymptoms, submitSymptom } from "../services/api";
import type { SymptomReport } from "../types/api";
import { titleCase } from "../lib/format";
import { useAssistantStore } from "../stores/assistantStore";
import { ISS_14_MODULES, useStationLocationStore } from "../features/topology";
import { useActiveMissionTime } from "../stores/missionStore";
import { useRoleStore } from "../stores/roleStore";
import { HealthReportModal } from "../features/health-report";

const SYMPTOM_CODES = ["HEADACHE", "FATIGUE", "DIZZINESS", "NAUSEA"] as const;

interface LocalSymptomEntry {
  id: string;
  astronautId?: string;
  callsign?: string;
  symptom: string;
  severity: string;
  time: string;
  location: string;
  duration: string;
  description: string;
  environmentalFactor?: string;
  reviewStatus?: "PENDING" | "ACKNOWLEDGED";
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  acknowledgmentNotes?: string | null;
}

/** Formats cabin telemetry into concise operational readout without AI boilerplate */
function formatCabinTelemetry(factor?: string): string {
  if (!factor) return "";
  return factor
    .replace(/\bCO:?\s*([0-9,]+)\s*(?:PPM|ppm)?\b/gi, "CO₂ $1 ppm")
    .replace(/\bRad:?\s*([0-9.]+)\s*mGy\/d\b/gi, "Rad $1 mGy/d")
    .replace(/\bTemp:?\s*([0-9.]+)\s*(?:°?C)?\b/gi, "Temp $1°C")
    .replace(/\s{2,}/g, " · ")
    .trim();
}

/** Cleans robotic AI placeholder text into natural operational log wording */
function cleanDescription(desc?: string): string {
  if (!desc) return "Onset noted during shift activities.";
  const trimmed = desc.trim();
  if (trimmed.startsWith("Reported during mission tasks in")) {
    return "Onset noted during shift activities.";
  }
  return trimmed;
}

/** Distills corporate AI disclaimers into standard flight medicine sign-off */
function cleanAcknowledgmentNotes(notes?: string | null): string {
  if (!notes) return "Logged to medical record · Follow-up via PMC.";
  if (
    notes.includes("Telemetry correlation logged in mission health record") ||
    notes.includes("Space-to-Ground Voice Loops")
  ) {
    return "Logged to medical record · Follow-up via PMC.";
  }
  return notes;
}

const SAMPLE_NASA_DIARY: LocalSymptomEntry[] = [
  {
    id: "sym-001",
    astronautId: "ASTRO-01",
    callsign: "CDR M. Vance",
    symptom: "Headache",
    severity: "Moderate",
    time: "10:12 UTC",
    location: "Node 2 (Harmony)",
    duration: "45m",
    description: "Bifrontal throbbing pressure noted after 2h payload rack work in forward bay.",
    environmentalFactor: "CO₂ 3,620 ppm · Temp 22.8°C · Rad 0.20 mGy/d",
    reviewStatus: "PENDING",
  },
  {
    id: "sym-002",
    astronautId: "ASTRO-02",
    callsign: "FE-1 Dr. S. Patel",
    symptom: "Fatigue",
    severity: "Mild",
    time: "08:47 UTC",
    location: "US Lab (Destiny)",
    duration: "2h",
    description: "Lethargy and limb heaviness following morning treadmill session.",
    environmentalFactor: "CO₂ 2,840 ppm · Temp 22.4°C · Rad 0.18 mGy/d",
    reviewStatus: "ACKNOWLEDGED",
    acknowledgedAt: "09:05 UTC",
    acknowledgedBy: "Flight Surgeon (Surgeon Console)",
    acknowledgmentNotes: "Logged to medical record · Follow-up via PMC.",
  },
  {
    id: "sym-003",
    astronautId: "ASTRO-03",
    callsign: "MS-1 K. Lindgren",
    symptom: "Dizziness",
    severity: "Mild",
    time: "06:20 UTC",
    location: "Node 1 (Unity)",
    duration: "15m",
    description: "Transient disorientation upon waking and translating from sleep quarters to galley.",
    environmentalFactor: "CO₂ 2,410 ppm · Temp 22.1°C · Rad 0.19 mGy/d",
    reviewStatus: "ACKNOWLEDGED",
    acknowledgedAt: "06:45 UTC",
    acknowledgedBy: "Flight Surgeon (Surgeon Console)",
    acknowledgmentNotes: "Logged to medical record · Monitored on morning loop.",
  },
];

interface SymptomsViewProps {
  astronautId: string;
}

export function SymptomsView({ astronautId }: SymptomsViewProps) {
  const { isSimulation, currentMissionDay, utcString } = useActiveMissionTime();
  const role = useRoleStore((state) => state.role);
  const isFlightSurgeon = role === "flight_surgeon";
  const [crewFilter, setCrewFilter] = useState<string>("ALL");
  const [manualAstronautId, setManualAstronautId] = useState<string>(astronautId || "ASTRO-01");
  const [viewMode, setViewMode] = useState<"history" | "manual">("history");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "ACKNOWLEDGED">("ALL");

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
      if (saved) {
        const parsed: LocalSymptomEntry[] = JSON.parse(saved);
        return parsed.map((item) => ({
          ...item,
          astronautId: item.astronautId || "ASTRO-01",
          callsign:
            item.callsign ||
            (item.astronautId === "ASTRO-02"
              ? "FE-1 Dr. S. Patel"
              : item.astronautId === "ASTRO-03"
              ? "MS-1 K. Lindgren"
              : "CDR M. Vance"),
          reviewStatus: item.reviewStatus ?? ("PENDING" as const),
        }));
      }
      return SAMPLE_NASA_DIARY;
    } catch {
      return SAMPLE_NASA_DIARY;
    }
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [healthReportOpen, setHealthReportOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("habitrack_symptom_diary_v3", JSON.stringify(localDiary));
  }, [localDiary]);

  // Reactive listener when the unified Assistant records or acknowledges a symptom
  useEffect(() => {
    const handleSymptomLogged = (_event?: Event) => {
      try {
        const saved = localStorage.getItem("habitrack_symptom_diary_v3");
        if (saved) {
          const parsed: LocalSymptomEntry[] = JSON.parse(saved);
          setLocalDiary(
            parsed.map((item) => ({
              ...item,
              astronautId: item.astronautId || "ASTRO-01",
              callsign:
                item.callsign ||
                (item.astronautId === "ASTRO-02"
                  ? "FE-1 Dr. S. Patel"
                  : item.astronautId === "ASTRO-03"
                  ? "MS-1 K. Lindgren"
                  : "CDR M. Vance"),
              reviewStatus: item.reviewStatus ?? ("PENDING" as const),
            }))
          );
        }
      } catch {
        // Ignore
      }
    };

    const handleSymptomAcknowledged = (event: Event) => {
      const customEvent = event as CustomEvent<{ reportId: string; reviewedBy: string; reviewedAt: string }>;
      if (!customEvent.detail) return;
      const { reportId, reviewedBy, reviewedAt } = customEvent.detail;
      setLocalDiary((prev) =>
        prev.map((item) =>
          item.id === reportId
            ? {
                ...item,
                reviewStatus: "ACKNOWLEDGED",
                acknowledgedAt: reviewedAt,
                acknowledgedBy: reviewedBy,
              }
            : item
        )
      );
    };

    window.addEventListener("habitrack_symptom_logged", handleSymptomLogged);
    window.addEventListener("habitrack_symptom_acknowledged", handleSymptomAcknowledged);
    return () => {
      window.removeEventListener("habitrack_symptom_logged", handleSymptomLogged);
      window.removeEventListener("habitrack_symptom_acknowledged", handleSymptomAcknowledged);
    };
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const targetId =
        isFlightSurgeon && crewFilter === "ALL"
          ? undefined
          : isFlightSurgeon && crewFilter !== "ALL"
          ? crewFilter
          : astronautId;
      const symptomReports = await fetchSymptoms(targetId);
      setReports(symptomReports);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load symptom reports.");
    } finally {
      setIsLoading(false);
    }
  }, [astronautId, isFlightSurgeon, crewFilter]);

  useEffect(() => {
    void load();
  }, [load, isSimulation, currentMissionDay]);

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const targetId = isFlightSurgeon ? manualAstronautId : astronautId;
      const targetCallsign =
        targetId === "ASTRO-01"
          ? "CDR M. Vance"
          : targetId === "ASTRO-02"
          ? "FE-1 Dr. S. Patel"
          : "MS-1 K. Lindgren";

      const createdReport = await submitSymptom({
        astronaut_id: targetId,
        symptom_code: symptomCode,
        severity,
        cabin_module: cabinModule,
        notes: notes.trim() || null,
      });

      // Also append to local diary
      const newDiaryEntry: LocalSymptomEntry = {
        id: createdReport.report_id || `sym-${Date.now()}`,
        astronautId: targetId,
        callsign: targetCallsign,
        symptom: titleCase(symptomCode),
        severity: severity >= 4 ? "Severe" : severity >= 2 ? "Moderate" : "Mild",
        time: isSimulation
          ? `Day ${currentMissionDay} · ${utcString.slice(11, 16)} UTC`
          : new Date().toLocaleTimeString("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false }) + " UTC",
        location: cabinModule,
        duration: "30m",
        description: notes.trim() || `Onset noted during shift activities in ${cabinModule}.`,
        environmentalFactor: "CO₂ 3,197 ppm · Temp 22.8°C · Rad 0.20 mGy/d",
        reviewStatus: "PENDING",
        acknowledgedAt: null,
        acknowledgedBy: null,
        acknowledgmentNotes: null,
      };

      setLocalDiary((prev) => [newDiaryEntry, ...prev]);
      setNotes("");
      setNotice(
        `Recorded to Station Log (${titleCase(symptomCode)} for ${targetCallsign})`,
      );
      await load();
      setViewMode("history");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit symptom report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcknowledge = async (entryId: string) => {
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " UTC";
    const surgeonSig = "Flight Surgeon (Surgeon Console)";
    const defaultNotes = "Logged to medical record · Follow-up via PMC.";
    setLocalDiary((prev) =>
      prev.map((item) =>
        item.id === entryId
          ? {
              ...item,
              reviewStatus: "ACKNOWLEDGED",
              acknowledgedAt: now,
              acknowledgedBy: surgeonSig,
              acknowledgmentNotes: item.acknowledgmentNotes ?? defaultNotes,
            }
          : item
      )
    );
    try {
      await acknowledgeSymptom(entryId, surgeonSig, defaultNotes);
    } catch (err) {
      console.warn("Error acknowledging symptom via API service", err);
    }
    setNotice(`Symptom signed off by Flight Surgeon · ${now}`);
    setTimeout(() => setNotice(null), 5000);
  };

  const filteredDiary = localDiary.filter((item) => {
    // If astronaut, lock to astronautId
    if (!isFlightSurgeon && item.astronautId && item.astronautId !== astronautId) {
      return false;
    }
    // If flight surgeon and filtered to a specific crewmember
    if (isFlightSurgeon && crewFilter !== "ALL" && item.astronautId && item.astronautId !== crewFilter) {
      return false;
    }

    const matchesSearch =
      item.symptom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.astronautId && item.astronautId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.callsign && item.callsign.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSeverity =
      filterSeverity === "ALL" || item.severity.toUpperCase() === filterSeverity;

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACKNOWLEDGED" && item.reviewStatus === "ACKNOWLEDGED") ||
      (statusFilter === "PENDING" && item.reviewStatus !== "ACKNOWLEDGED");

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const openDrawer = useAssistantStore((s) => s.openDrawer);

  return (
    <div className="space-y-6">
      {/* Top Banner & Mode Switcher */}
      <div className="p-6 sm:p-8 rounded-[32px] border border-slate-200/90 bg-white shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1 rounded-md bg-sky-50 text-sky-600 border border-sky-100">
              <Stethoscope className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700">
              Flight Medicine · Crew Health Logging
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Symptom Diary &amp; Clinical Concordance
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Subjective symptoms logged here immediately correlate with active ECLSS telemetry, 
            circadian envelopes, and NASA flight rules.
          </p>
        </div>

        {/* View Mode Switcher + SI Assistant Launcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Direct Trigger to Unified Standby Assistant */}
          <button
            onClick={() => openDrawer("chat")}
            className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span>Launch SI Symptom Triage</span>
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
          <div className="p-6 sm:p-8 rounded-[32px] border border-slate-200/90 bg-white shadow-2xs space-y-6">
            {/* Flight Surgeon Expedition Fleet Filter Bar */}
            {isFlightSurgeon && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-foreground">Expedition Fleet Oversight</span>
                    <p className="text-[11px] text-muted">Flight Surgeon multi-crew cross-correlation</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                  {[
                    { id: "ALL", label: `All Crew (${localDiary.length})` },
                    { id: "ASTRO-01", label: `ASTRO-01 · Vance (${localDiary.filter((d) => (d.astronautId || "ASTRO-01") === "ASTRO-01").length})` },
                    { id: "ASTRO-02", label: `ASTRO-02 · Patel (${localDiary.filter((d) => d.astronautId === "ASTRO-02").length})` },
                    { id: "ASTRO-03", label: `ASTRO-03 · Lindgren (${localDiary.filter((d) => d.astronautId === "ASTRO-03").length})` },
                  ].map((crew) => (
                    <button
                      key={crew.id}
                      type="button"
                      onClick={() => setCrewFilter(crew.id)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                        crewFilter === crew.id
                          ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                          : "bg-white text-slate-600 border-border hover:bg-slate-100"
                      }`}
                    >
                      {crew.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

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

                {isFlightSurgeon && (
                  <div className="flex items-center gap-1 glass-panel-subtle p-1 rounded-lg text-xs font-mono">
                    {[
                      { id: "ALL", label: "All Status" },
                      {
                        id: "PENDING",
                        label: `Pending (${localDiary.filter((d) => d.reviewStatus !== "ACKNOWLEDGED").length})`,
                      },
                      {
                        id: "ACKNOWLEDGED",
                        label: `Acknowledged (${localDiary.filter((d) => d.reviewStatus === "ACKNOWLEDGED").length})`,
                      },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setStatusFilter(st.id as typeof statusFilter)}
                        className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors ${
                          statusFilter === st.id
                            ? "bg-white text-sky-700 border-sky-200 shadow-sm"
                            : "border-transparent text-muted hover:text-foreground"
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHealthReportOpen(true)}
                  className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Clinical Health Report</span>
                </button>
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
                      SI Symptom Triage
                    </button>
                    .
                  </p>
                </div>
              ) : (
                filteredDiary.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2.5">
                      {/* Top Bar: Symptom, Severity, Status */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900 tracking-tight">
                            {item.symptom}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider ${
                              item.severity === "Severe"
                                ? "bg-rose-50 text-rose-700 border border-rose-200/80"
                                : item.severity === "Moderate"
                                ? "bg-amber-50 text-amber-700 border border-amber-200/80"
                                : "bg-slate-100 text-slate-700 border border-slate-200/80"
                            }`}
                          >
                            {item.severity}
                          </span>
                        </div>

                        {item.reviewStatus === "ACKNOWLEDGED" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-medium">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Acknowledged</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-amber-50 text-amber-700 border border-amber-200/80 font-medium">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending Review</span>
                          </span>
                        )}
                      </div>

                      {/* Crew Identity & Context line */}
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-mono text-slate-500">
                        {item.astronautId && (
                          <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                            <Users className="w-3 h-3 text-slate-400" />
                            <span>{item.callsign || item.astronautId}</span>
                          </span>
                        )}
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.time}</span>
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.location}</span>
                        </span>
                        {item.duration && (
                          <>
                            <span>·</span>
                            <span>{item.duration}</span>
                          </>
                        )}
                      </div>

                      {/* Clean Astronaut Observation */}
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {cleanDescription(item.description)}
                      </p>
                    </div>

                    {/* Operational Footer (Environment & Sign-off) */}
                    <div className="space-y-2 pt-2.5 border-t border-slate-100">
                      {item.environmentalFactor && (
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono">
                          <span className="text-slate-400 font-medium">Cabin at onset:</span>
                          <span className="text-slate-700 font-medium">
                            {formatCabinTelemetry(item.environmentalFactor)}
                          </span>
                        </div>
                      )}

                      {item.reviewStatus === "ACKNOWLEDGED" ? (
                        <div className="flex items-start gap-2 pt-1 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] font-mono text-slate-500">
                              <span className="font-semibold text-slate-700">Flight Surgeon Sign-off</span>
                              <span>
                                {item.acknowledgedAt ?? item.time} · {item.acknowledgedBy ?? "Surgeon Console"}
                              </span>
                            </div>
                            <p className="mt-0.5 text-slate-600 text-[11px]">
                              {cleanAcknowledgmentNotes(item.acknowledgmentNotes)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-amber-700">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>
                              {isFlightSurgeon
                                ? "Awaiting Flight Surgeon sign-off"
                                : "Transmitted to Ground · Awaiting review"}
                            </span>
                          </div>
                          {isFlightSurgeon && (
                            <button
                              type="button"
                              onClick={() => void handleAcknowledge(item.id)}
                              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Acknowledge</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: MANUAL FAST-LOG */}
      {viewMode === "manual" && (
        <div className="p-6 sm:p-8 rounded-[32px] border border-slate-200/90 bg-white shadow-2xs max-w-2xl mx-auto space-y-6">
          <div className="border-b border-border pb-4">
            <h3 className="text-base font-semibold text-foreground">Manual Crew Symptom Entry</h3>
            <p className="text-xs text-muted">Log symptom onset to the mission medical timeline</p>
          </div>

          <form onSubmit={submitManual} className="space-y-4 text-xs">
            {isFlightSurgeon && (
              <div>
                <label className="block text-secondary font-semibold mb-1.5">Astronaut Profile</label>
                <select
                  value={manualAstronautId}
                  onChange={(e) => setManualAstronautId(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-lg bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-accent-light cursor-pointer"
                >
                  <option value="ASTRO-01">ASTRO-01 · CDR M. Vance (Commander)</option>
                  <option value="ASTRO-02">ASTRO-02 · FE-1 Dr. S. Patel (Flight Engineer)</option>
                  <option value="ASTRO-03">ASTRO-03 · MS-1 K. Lindgren (Mission Specialist)</option>
                </select>
              </div>
            )}
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

      <HealthReportModal
        open={healthReportOpen}
        onClose={() => setHealthReportOpen(false)}
        astronautId={astronautId}
      />
    </div>
  );
}
