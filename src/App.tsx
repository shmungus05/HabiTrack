/**
 * WAYFINDER V3 application shell: calm, focused clinical intelligence console.
 * High usability, restrained color palette, and clear visual hierarchy.
 */

import {
  Activity,
  BookOpen,
  Clock3,
  FileText,
  LayoutDashboard,
  Lock,
  Radar,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldAlert,
  Stethoscope,
  Wifi,
  WifiOff,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import { AssistantDrawer } from "./components/AssistantDrawer";
import { OverviewView } from "./components/OverviewView";
import { ResearchView } from "./components/ResearchView";
import { StandbyAgentTrigger } from "./components/StandbyAgentTrigger";
import { SymptomsView } from "./components/SymptomsView";
import { AlertsDeck } from "./features/alerts";
import { SettingsView } from "./features/settings";
import { CommsStatusChip } from "./features/comms";
import { DossierModal } from "./features/dossier";
import { useSimulationSandbox } from "./features/simulation";
import { AstronautAvatar, Badge, Button } from "./components/ui";
import { IntroPage } from "./components/IntroPage";
import { fetchHealth } from "./services/api";
import { useCohortStore } from "./stores/cohortStore";
import {
  ASTRONAUT_LOCKED_COHORT_ID,
  useRoleStore,
} from "./stores/roleStore";
import type { HealthStatus } from "./types/api";

export type ViewKey =
  | "overview"
  | "timeline"
  | "symptoms"
  | "research"
  | "alerts"
  | "settings";

interface ViewDefinition {
  key: ViewKey;
  label: string;
  icon: typeof LayoutDashboard;
  path: string;
  surgeonOnly?: boolean;
}

const ALL_VIEWS: readonly ViewDefinition[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, path: "/", surgeonOnly: false },
  { key: "timeline", label: "Timeline", icon: Activity, path: "/timeline", surgeonOnly: false },
  { key: "symptoms", label: "Symptoms", icon: Stethoscope, path: "/symptoms", surgeonOnly: false },
  { key: "research", label: "Research", icon: BookOpen, path: "/research", surgeonOnly: true },
  { key: "alerts", label: "Alerts", icon: ShieldAlert, path: "/alerts", surgeonOnly: false },
  { key: "settings", label: "Settings", icon: SettingsIcon, path: "/settings", surgeonOnly: true },
];

const TimelineView = lazy(() =>
  import("./components/TimelineView").then((module) => ({
    default: module.TimelineView,
  })),
);

function viewFromPath(pathname: string): ViewKey {
  const segment = pathname.split("/").filter(Boolean)[0];
  const match = ALL_VIEWS.find((view) => view.key === segment);
  return match?.key ?? "overview";
}

const FALLBACK_COHORT = [
  {
    astronaut_id: "ASTRO-01",
    callsign: "CDR M. Vance",
    crew_role: "Commander",
    calibration_status: "CALIBRATING",
  },
  {
    astronaut_id: "ASTRO-02",
    callsign: "FE-1 Dr. S. Patel",
    crew_role: "Flight Engineer",
    calibration_status: "CALIBRATING",
  },
  {
    astronaut_id: "ASTRO-03",
    callsign: "MS-1 K. Lindgren",
    crew_role: "Mission Specialist",
    calibration_status: "CALIBRATING",
  },
] as const;

/** "CDR M. Vance" → "Vance" for compact identity chips. */
function crewShortName(callsign?: string): string {
  if (!callsign) {
    return "";
  }
  const parts = callsign.trim().split(/\s+/);
  return parts[parts.length - 1] ?? callsign;
}

function formatCockpitClock(date: Date): { mmt: string; utc: string } {
  const mmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Yangon",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
  const utc = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return { mmt, utc };
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewKey>(() =>
    viewFromPath(window.location.pathname),
  );
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());

  const astronauts = useCohortStore((state) => state.astronauts);
  const activeAstronautId = useCohortStore((state) => state.activeAstronautId);
  const isLoadingCohort = useCohortStore((state) => state.isLoading);
  const cohortError = useCohortStore((state) => state.error);
  const loadCohort = useCohortStore((state) => state.loadCohort);
  const selectAstronaut = useCohortStore((state) => state.selectAstronaut);

  const role = useRoleStore((state) => state.role);
  const setRole = useRoleStore((state) => state.setRole);
  const hasSelectedRole = useRoleStore((state) => state.hasSelectedRole);
  const openRoleSelector = useRoleStore((state) => state.openRoleSelector);
  const isAstronaut = role === "astronaut";

  const [simulationState, simulationControls] = useSimulationSandbox();
  const { activeScenario, isAnomalyActive } = simulationState;

  const availableViews = useMemo(() => {
    if (isAstronaut) {
      return ALL_VIEWS.filter((v) => !v.surgeonOnly);
    }
    return ALL_VIEWS;
  }, [isAstronaut]);

  const activeAstronaut = useMemo(
    () => astronauts.find((astronaut) => astronaut.astronaut_id === activeAstronautId),
    [astronauts, activeAstronautId],
  );

  useEffect(() => {
    void loadCohort();
    void fetchHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, [loadCohort]);

  // Astronaut perspective is locked to the logged crewmember: medical privacy
  // and accidental cross-cohort entry take precedence over the switcher.
  useEffect(() => {
    if (isAstronaut && activeAstronautId !== ASTRONAUT_LOCKED_COHORT_ID) {
      selectAstronaut(ASTRONAUT_LOCKED_COHORT_ID);
    }
  }, [isAstronaut, activeAstronautId, selectAstronaut]);

  // When in astronaut perspective, redirect if on surgeon-restricted views
  useEffect(() => {
    if (isAstronaut && (activeView === "research" || activeView === "settings")) {
      setActiveView("overview");
      if (window.location.pathname !== "/") {
        window.history.replaceState({}, "", "/");
      }
    }
  }, [isAstronaut, activeView]);

  useEffect(() => {
    const onPopState = () => setActiveView(viewFromPath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 10000);
    return () => window.clearInterval(timer);
  }, []);

  const navigate = (view: (typeof ALL_VIEWS)[number]) => {
    setActiveView(view.key);
    if (window.location.pathname !== view.path) {
      window.history.pushState({}, "", view.path);
    }
  };

  const calibration = activeAstronaut?.calibration_status ?? "CALIBRATING";
  const calibrated = calibration === "CALIBRATED";
  const cohortChoices =
    astronauts.length > 0 ? astronauts : FALLBACK_COHORT;
  const ollamaOnline = Boolean(health?.ollama_online);
  const ollamaTitle = ollamaOnline
    ? "Local Ollama generative model online"
    : "Ollama offline — deterministic extractive synthesis active";
  const chunkCount = health?.vector_store_chunks ?? 0;
  const clock = useMemo(() => formatCockpitClock(now), [now]);
  const activeViewMeta = useMemo(
    () => ALL_VIEWS.find((v) => v.key === activeView) ?? ALL_VIEWS[0],
    [activeView],
  );

  if (!hasSelectedRole) {
    return <IntroPage onSelectRole={() => setActiveView("overview")} />;
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-canvas text-slate-700 font-sans selection:bg-sky-200/60">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white overflow-hidden p-0.5">
              <img
                src="/Logo.png"
                alt="Habitat Trace Logo"
                className="h-full w-full object-contain rounded-md"
              />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-semibold tracking-tight text-slate-900">
                  Habitat Trace
                </h1>
                <span className="hidden text-xs text-slate-400 sm:inline">/</span>
                <span className="hidden truncate text-xs font-medium text-slate-500 sm:inline">
                  {activeViewMeta.label}
                </span>
              </div>
              <p className="hidden font-mono text-[11px] text-slate-500 xl:block">
                ISS Exp 72 · Wayfinder
              </p>
            </div>
          </div>

          {/* Mission Path Active Perspective Indicator & Selector */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => openRoleSelector()}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all shadow-2xs hover:shadow-xs active:scale-[0.98] ${
                isAstronaut
                  ? "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              }`}
              title="Click to open Mission Path selection"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isAstronaut ? "bg-sky-500" : "bg-emerald-500"
                } animate-pulse`}
              />
              <span className="tracking-tight font-bold">
                {isAstronaut ? "Field Mission · Astronaut" : "Medical Ops · Flight Surgeon"}
              </span>
              <span className="rounded-md bg-white border border-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 shadow-2xs">
                Switch
              </span>
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Badge
              variant={calibrated ? "success" : "warning"}
              dot
              pulse={!calibrated}
              className="hidden md:inline-flex"
            >
              {calibration}
            </Badge>
            <Badge
              variant={ollamaOnline ? "accent" : "default"}
              title={ollamaTitle}
              className="hidden 2xl:inline-flex"
            >
              {ollamaOnline ? (
                <Wifi className="h-3 w-3 text-sky-600" />
              ) : (
                <WifiOff className="h-3 w-3 text-slate-500" />
              )}
              {ollamaOnline ? "Ollama Online" : "Extractive Mode"}
            </Badge>
            <div
              className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] 2xl:flex"
              title="Synchronized Myanmar Time (MMT, UTC+06:30) and Coordinated Universal Time (UTC)"
            >
              <Clock3 className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-semibold text-slate-900 tabular-nums">
                {clock.mmt}
              </span>
              <span className="text-slate-500">MMT</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500 tabular-nums">{clock.utc} UTC</span>
            </div>

            <CommsStatusChip />
            <Button
              size="sm"
              variant="default"
              onClick={() => setIsDossierOpen(true)}
              leftIcon={<FileText className="h-3.5 w-3.5 text-slate-600" />}
              title="Generate a structured clinical investigation dossier"
            >
              <span className="hidden sm:inline">Dossier</span>
            </Button>

            <div
              role="group"
              aria-label="Crew cohort"
              className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-100 p-0.5"
            >
              {isAstronaut ? (
                <span
                  className="flex items-center px-1.5 text-slate-400"
                  title="Cohort locked to the active crewmember in Astronaut perspective"
                >
                  <Lock className="h-3 w-3" />
                </span>
              ) : null}
              {cohortChoices.map((astronaut) => {
                const selected = astronaut.astronaut_id === activeAstronautId;
                const locked =
                  isAstronaut && astronaut.astronaut_id !== ASTRONAUT_LOCKED_COHORT_ID;
                return (
                  <button
                    key={astronaut.astronaut_id}
                    type="button"
                    aria-pressed={selected}
                    disabled={locked}
                    title={
                      locked
                        ? "Locked in Astronaut perspective · medical privacy"
                        : `${astronaut.callsign} (${astronaut.astronaut_id}) · ${astronaut.crew_role} · ${astronaut.calibration_status}`
                    }
                    onClick={() => selectAstronaut(astronaut.astronaut_id)}
                    className={`group flex items-center gap-1.5 rounded-md px-2 py-1 text-left cursor-pointer transition-colors ${
                      selected
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
                    } ${locked ? "cursor-not-allowed opacity-35 hover:bg-transparent" : ""}`}
                  >
                    <AstronautAvatar
                      astronautId={astronaut.astronaut_id}
                      size="xs"
                      className={
                        selected
                          ? ""
                          : "opacity-80 saturate-[0.8] transition group-hover:opacity-100 group-hover:saturate-100"
                      }
                    />
                    <span className="hidden text-xs font-medium whitespace-nowrap md:inline">
                      {crewShortName(astronaut.callsign)}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                void loadCohort();
                void fetchHealth()
                  .then(setHealth)
                  .catch(() => setHealth(null));
              }}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 cursor-pointer transition-colors hover:border-slate-300 hover:text-slate-900"
              title="Refresh cohort and service health"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoadingCohort ? "animate-spin text-sky-600" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Navigation Strip */}
        <nav
          aria-label="Flight deck navigation"
          className="flex items-center gap-1.5 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden"
        >
          {availableViews.map((view) => {
            const Icon = view.icon;
            const selected = activeView === view.key;
            return (
              <button
                key={view.key}
                type="button"
                onClick={() => navigate(view)}
                aria-current={selected ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                  selected
                    ? "border border-slate-200/80 bg-slate-100 text-slate-900 font-semibold"
                    : "border border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {view.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Cockpit Body: Sidebar + Main Content Area */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1800px] flex-1">
        <aside
          aria-label="Cockpit sidebar"
          className="hidden lg:flex lg:w-56 shrink-0 flex-col justify-between border-r border-slate-200 bg-white p-4"
        >
          <div className="space-y-5">
            <div>
              <p className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Flight Deck Views
              </p>
              <nav className="mt-2 space-y-1">
                {availableViews.map((view) => {
                  const Icon = view.icon;
                  const selected = activeView === view.key;
                  return (
                    <button
                      key={view.key}
                      type="button"
                      onClick={() => navigate(view)}
                      aria-current={selected ? "page" : undefined}
                      className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-xs cursor-pointer transition-colors ${
                        selected
                          ? "border-slate-200/80 bg-slate-100 text-slate-900 font-semibold"
                          : "border-transparent font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          selected ? "text-slate-900" : "text-slate-400"
                        }`}
                      />
                      <span>{view.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Telemetry Spectrum
              </p>
              <ul className="space-y-1.5 text-[11px]">
                <li className="flex items-center justify-between text-slate-700">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#0284c7]" />
                    Carbon Dioxide (CO₂)
                  </span>
                  <span className="font-mono text-slate-500">PPM</span>
                </li>
                <li className="flex items-center justify-between text-slate-700">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#d97706]" />
                    Space Radiation
                  </span>
                  <span className="font-mono text-slate-500">mGy/d</span>
                </li>
                <li className="flex items-center justify-between text-slate-700">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#ea580c]" />
                    Cabin Temperature
                  </span>
                  <span className="font-mono text-slate-500">°C</span>
                </li>
                <li className="flex items-center justify-between text-slate-700">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#0891b2]" />
                    Relative Humidity
                  </span>
                  <span className="font-mono text-slate-500">%</span>
                </li>
                <li className="flex items-center justify-between text-slate-700">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
                    Pressure &amp; O₂
                  </span>
                  <span className="font-mono text-slate-500">mmHg</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 flex items-center gap-3">
              <AstronautAvatar
                astronautId={activeAstronautId}
                size="sm"
                status={calibration}
                label={activeAstronaut?.callsign ?? activeAstronautId}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs font-semibold text-slate-900">
                  {activeAstronaut?.callsign ?? activeAstronautId}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {activeAstronaut?.crew_role ?? "Crew"}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2.5 text-[11px]">
              <div className="flex items-center justify-between font-mono font-medium text-slate-700">
                <span>EXPEDITION 72</span>
                <span>ISS / RR-1</span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                MMT {clock.mmt} · UTC {clock.utc}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {ollamaOnline ? "Ollama Online" : "Extractive Mode"} · {chunkCount} chunks
              </p>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {isAnomalyActive ? (
            <div className="mt-4 w-full px-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
                <span className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
                  <span className="font-semibold uppercase tracking-wider">
                    Simulation override active
                  </span>
                  <span className="text-amber-700">
                    · {activeScenario.replace(/_/g, " ")} injected telemetry is on screen
                  </span>
                </span>
                <button
                  type="button"
                  onClick={simulationControls.resetNominal}
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-800 cursor-pointer transition-colors hover:bg-amber-100"
                >
                  <RefreshCw className="h-3 w-3" />
                  Reset to nominal
                </button>
              </div>
            </div>
          ) : null}

          {isAstronaut && (activeView === "timeline" || activeView === "research") ? (
            <div className="mt-4 w-full px-4 sm:px-6">
              <div className="rounded-xl glass-panel px-4 py-2 text-[11px] text-slate-500">
                Viewing in Astronaut Perspective · Flight Surgeon diagnostic controls
                minimized.
              </div>
            </div>
          ) : null}

          {cohortError ? (
            <div className="mt-4 w-full px-4 sm:px-6">
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                {cohortError}
              </div>
            </div>
          ) : null}

          <main className="w-full flex-1 px-4 py-6 pb-20 sm:px-6 sm:py-7 sm:pb-20">
            {activeView === "overview" ? (
              <OverviewView astronautId={activeAstronautId} />
            ) : null}
            {activeView === "timeline" ? (
              <Suspense
                fallback={
                  <div className="card h-[calc(100vh-260px)] min-h-[640px] animate-pulse" />
                }
              >
                <TimelineView astronautId={activeAstronautId} />
              </Suspense>
            ) : null}
            {activeView === "symptoms" ? (
              <SymptomsView astronautId={activeAstronautId} />
            ) : null}
            {activeView === "research" ? (
              <ResearchView astronautId={activeAstronautId} />
            ) : null}
            {activeView === "alerts" ? <AlertsDeck /> : null}
            {activeView === "settings" ? <SettingsView /> : null}
          </main>
        </div>
      </div>

      <footer className="relative z-10 border-t border-border bg-white px-6 py-4">
        <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
          <span>HABITAT TRACE · WAYFINDER · ISS Expedition 72 · Clinical Decision Support</span>
          <span>
            Non-causal temporal correlation · Flight surgeon verification required
          </span>
          <span className="w-full text-[11px] text-muted">
            Crew portraits: NASA (public domain) · illustrative stand-ins for the simulated crew
          </span>
        </div>
      </footer>

      <AssistantDrawer />
      <StandbyAgentTrigger />
      <DossierModal
        open={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        astronautId={activeAstronautId}
      />
    </div>
  );
}
