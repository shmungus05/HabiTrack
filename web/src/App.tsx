/**
 * WAYFINDER V3 application shell: calm, focused clinical intelligence console.
 * High usability, restrained color palette, and clear visual hierarchy.
 */

import {
  Activity,
  BookOpen,
  Database,
  FileText,
  LayoutDashboard,
  Lock,
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
import { fetchHealth } from "./services/api";
import { useCohortStore } from "./stores/cohortStore";
import {
  ASTRONAUT_LOCKED_COHORT_ID,
  useRoleStore,
} from "./stores/roleStore";
import type { HealthStatus } from "./types/api";

const VIEWS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, path: "/" },
  { key: "timeline", label: "Timeline", icon: Activity, path: "/timeline" },
  { key: "symptoms", label: "Symptoms", icon: Stethoscope, path: "/symptoms" },
  { key: "research", label: "Research", icon: BookOpen, path: "/research" },
  { key: "alerts", label: "Alerts", icon: ShieldAlert, path: "/alerts" },
  { key: "settings", label: "Settings", icon: SettingsIcon, path: "/settings" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

const TimelineView = lazy(() =>
  import("./components/TimelineView").then((module) => ({
    default: module.TimelineView,
  })),
);

function viewFromPath(pathname: string): ViewKey {
  const segment = pathname.split("/").filter(Boolean)[0];
  const match = VIEWS.find((view) => view.key === segment);
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

export default function App() {
  const [activeView, setActiveView] = useState<ViewKey>(() =>
    viewFromPath(window.location.pathname),
  );
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  const astronauts = useCohortStore((state) => state.astronauts);
  const activeAstronautId = useCohortStore((state) => state.activeAstronautId);
  const isLoadingCohort = useCohortStore((state) => state.isLoading);
  const cohortError = useCohortStore((state) => state.error);
  const loadCohort = useCohortStore((state) => state.loadCohort);
  const selectAstronaut = useCohortStore((state) => state.selectAstronaut);

  const role = useRoleStore((state) => state.role);
  const setRole = useRoleStore((state) => state.setRole);
  const isAstronaut = role === "astronaut";

  const [simulationState, simulationControls] = useSimulationSandbox();
  const { activeScenario, isAnomalyActive } = simulationState;

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

  useEffect(() => {
    const onPopState = () => setActiveView(viewFromPath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (view: (typeof VIEWS)[number]) => {
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

  return (
    <div className="relative flex min-h-screen flex-col bg-canvas text-secondary font-sans selection:bg-accent-secondary/30">
      <header className="sticky top-0 z-30 border-b border-border bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface-elevated overflow-hidden p-0.5">
              <img
                src="/Logo.png"
                alt="WAYFINDER Logo"
                className="h-full w-full object-contain rounded-md"
              />
            </span>
            <div>
              <h1 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                WAYFINDER{" "}
                <span className="rounded bg-surface-subtle border border-border px-1.5 py-0.5 text-[10px] text-secondary font-mono">
                  V5
                </span>
              </h1>
            </div>
          </div>

          <div
            role="group"
            aria-label="Active perspective"
            className="flex items-center gap-1 rounded-lg border border-border bg-canvas p-1"
          >
            <button
              type="button"
              aria-pressed={isAstronaut}
              onClick={() => setRole("astronaut")}
              title="Astronaut perspective: glanceable status and quick symptom entry"
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                isAstronaut
                  ? "border border-border-strong bg-surface-subtle text-foreground"
                  : "border border-transparent text-muted hover:text-foreground"
              }`}
            >
              <span aria-hidden="true">🧑‍🚀</span>
              Astronaut
            </button>
            <button
              type="button"
              aria-pressed={!isAstronaut}
              onClick={() => setRole("flight_surgeon")}
              title="Flight Surgeon perspective: full diagnostic depth"
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                !isAstronaut
                  ? "border border-border-strong bg-surface-subtle text-foreground"
                  : "border border-transparent text-muted hover:text-foreground"
              }`}
            >
              <span aria-hidden="true">🩺</span>
              Flight Surgeon
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Badge
              variant={calibrated ? "success" : "warning"}
              dot
              pulse={!calibrated}
            >
              {calibration}
            </Badge>
            <Badge
              variant="default"
              title={ollamaTitle}
              className="hidden lg:inline-flex"
            >
              {ollamaOnline ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              {ollamaOnline ? "Ollama Online" : "Extractive Mode"}
            </Badge>
            <Badge
              variant="default"
              title={ollamaTitle}
              aria-label={ollamaOnline ? "Ollama online" : "Extractive mode"}
              className="px-1.5 lg:hidden"
            >
              {ollamaOnline ? (
                <Wifi className="h-3.5 w-3.5" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
            </Badge>
            <span className="hidden items-center gap-1 font-mono text-xs text-secondary xl:inline-flex">
              {chunkCount} chunks
            </span>
            <span
              className="hidden items-center gap-1 font-mono text-[11px] text-secondary md:inline-flex xl:hidden"
              title={`${chunkCount} vector store chunks`}
            >
              <Database className="h-3 w-3" />
              {chunkCount}
            </span>
          </div>

          <div className="ml-auto flex flex-1 items-center justify-end gap-3 lg:flex-none">
            <CommsStatusChip />
            <Button
              size="sm"
              variant="default"
              onClick={() => setIsDossierOpen(true)}
              leftIcon={<FileText className="h-3.5 w-3.5" />}
              title="Generate a structured clinical investigation dossier"
            >
              <span className="hidden sm:inline">Dossier</span>
            </Button>
            <div
              role="group"
              aria-label="Crew cohort"
              className="flex items-center gap-1 rounded-lg border border-border bg-canvas p-1"
            >
              {isAstronaut ? (
                <span
                  className="flex items-center gap-1 px-1.5 text-muted"
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
                        : `${astronaut.callsign} · ${astronaut.crew_role} · ${astronaut.calibration_status}`
                    }
                    onClick={() => selectAstronaut(astronaut.astronaut_id)}
                    className={`group flex items-center gap-2 rounded-lg border px-1.5 py-1 text-left transition-colors ${
                      selected
                        ? "border-border-strong bg-surface-subtle text-foreground"
                        : "border-transparent text-secondary hover:border-border hover:bg-surface-elevated hover:text-foreground"
                    } ${locked ? "cursor-not-allowed opacity-35 hover:border-transparent hover:bg-transparent" : ""}`}
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
                    <span className="flex flex-col leading-tight">
                      <span className="font-mono text-[11px] font-medium">
                        {astronaut.astronaut_id}
                      </span>
                      <span className="hidden text-[10px] text-muted sm:block">
                        {crewShortName(astronaut.callsign)}
                      </span>
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
              className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface text-muted transition-colors hover:border-border-strong hover:text-foreground"
              title="Refresh cohort and service health"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoadingCohort ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        <nav className="mx-auto flex w-full max-w-[1800px] items-center gap-1.5 overflow-x-auto px-6 pb-2.5">
          {VIEWS.map((view) => {
            const Icon = view.icon;
            const selected = activeView === view.key;
            return (
              <button
                key={view.key}
                type="button"
                onClick={() => navigate(view)}
                aria-current={selected ? "page" : undefined}
                className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  selected
                    ? "bg-surface-subtle text-foreground border border-border-strong"
                    : "text-muted hover:bg-surface-elevated hover:text-foreground border border-transparent"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {view.label}
              </button>
            );
          })}
          <span className="ml-auto hidden items-center gap-2.5 sm:inline-flex">
            <AstronautAvatar
              astronautId={activeAstronautId}
              size="sm"
              status={calibration}
              label={activeAstronaut?.callsign ?? activeAstronautId}
            />
            <span className="flex flex-col leading-tight">
              <span className="font-mono text-[11px] text-secondary">
                {activeAstronaut?.callsign ?? activeAstronautId}
              </span>
              <span className="text-[10px] text-muted">
                {activeAstronaut?.crew_role ?? "Crew"}
              </span>
            </span>
          </span>
        </nav>
      </header>

      {isAnomalyActive ? (
        <div className="mx-auto mt-3 w-full max-w-[1800px] px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
            <span className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span className="font-semibold uppercase tracking-wider">
                Simulation override active
              </span>
              <span className="text-amber-200/80">
                · {activeScenario.replace(/_/g, " ")} injected telemetry is on screen
              </span>
            </span>
            <button
              type="button"
              onClick={simulationControls.resetNominal}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 px-2.5 py-1 text-[11px] font-semibold text-amber-100 transition-colors hover:bg-amber-500/20"
            >
              <RefreshCw className="h-3 w-3" />
              Reset to nominal
            </button>
          </div>
        </div>
      ) : null}

      {isAstronaut && (activeView === "timeline" || activeView === "research") ? (
        <div className="mx-auto mt-3 w-full max-w-[1800px] px-6">
          <div className="rounded-lg border border-border bg-surface px-4 py-2 text-[11px] text-muted">
            Viewing in Astronaut Perspective · Flight Surgeon diagnostic controls
            minimized.
          </div>
        </div>
      ) : null}

      {cohortError ? (
        <div className="mx-auto mt-4 w-full max-w-[1800px] px-6">
          <div className="rounded-lg border border-critical/25 bg-critical/10 px-4 py-3 text-xs text-critical">
            {cohortError}
          </div>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-[1800px] flex-1 px-6 py-6 sm:py-8">
        {activeView === "overview" ? (
          <OverviewView astronautId={activeAstronautId} />
        ) : null}
        {activeView === "timeline" ? (
          <Suspense
            fallback={
              <div className="card h-[calc(100vh-260px)] min-h-[640px] animate-pulse bg-surface" />
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

      <footer className="border-t border-border bg-canvas px-6 py-4">
        <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
          <span>WAYFINDER V5 · ISS Expedition 71 · Clinical Decision Support</span>
          <span>
            Non-causal temporal correlation · Flight surgeon verification required
          </span>
          <span className="w-full text-[10px] text-muted">
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
