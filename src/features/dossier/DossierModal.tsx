/**
 * Clinical investigation dossier dialog.
 *
 * Compiles a dossier from either preloaded overview data (zero network) or a
 * self-contained fetch bundle, then offers clipboard copy, `.md` download,
 * native print-to-PDF, and ground downlink through the comms outbox.
 */

import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  Download,
  FileText,
  Printer,
  Satellite,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "../../components/ui";
import {
  fetchAstronaut,
  fetchBaselines,
  fetchEvents,
  fetchFlightRules,
  fetchMeasurements,
  fetchSymptoms,
} from "../../services/api";
import { useCommsStore } from "../../stores/commsStore";
import { compileDossier } from "./dossierCompiler";
import { generateHtmlDossier, generateMarkdownDossier } from "./dossierTemplates";
import type { DossierReport, DossierSourceData } from "./types";

export interface DossierModalProps {
  open: boolean;
  onClose: () => void;
  astronautId: string;
  preloadedData?: DossierSourceData | null;
}

type DossierTab = "rendered" | "markdown";

const PRINT_ROOT_ID = "printable-dossier-root";

function downloadTextFile(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function DossierModal({
  open,
  onClose,
  astronautId,
  preloadedData,
}: DossierModalProps) {
  const [report, setReport] = useState<DossierReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DossierTab>("rendered");
  const [copied, setCopied] = useState(false);
  const [downlinkNotice, setDownlinkNotice] = useState<string | null>(null);

  const enqueuePacket = useCommsStore((state) => state.enqueuePacket);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let source: DossierSourceData | null = preloadedData ?? null;

      if (!source) {
        const [astronaut, baselines, measurements, symptoms, events, rules] =
          await Promise.all([
            fetchAstronaut(astronautId),
            fetchBaselines(astronautId),
            fetchMeasurements(astronautId, 336, 1000),
            fetchSymptoms(astronautId),
            fetchEvents(astronautId),
            fetchFlightRules().catch(() => []),
          ]);
        source = {
          astronaut,
          baselines,
          measurements,
          symptoms,
          events,
          activeFlightRules: rules,
        };
      }

      setReport(compileDossier(source));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to compile the investigation dossier.",
      );
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [astronautId, preloadedData]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setCopied(false);
    setDownlinkNotice(null);
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const markdown = useMemo(
    () => (report ? generateMarkdownDossier(report) : ""),
    [report],
  );
  const html = useMemo(
    () => (report ? generateHtmlDossier(report) : ""),
    [report],
  );

  if (!open) {
    return null;
  }

  const handleCopy = async () => {
    if (!markdown) {
      return;
    }
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Clipboard access was denied. Use Download .md instead.");
    }
  };

  const handleDownload = () => {
    if (!report) {
      return;
    }
    downloadTextFile(`WAYFINDER_Dossier_${report.metadata.reportId}.md`, markdown);
  };

  const handlePrint = () => {
    if (!html) {
      return;
    }
    let root = document.getElementById(PRINT_ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = PRINT_ROOT_ID;
      document.body.appendChild(root);
    }
    root.innerHTML = html;

    const cleanup = () => {
      root?.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  };

  const handleDownlink = () => {
    if (!report) {
      return;
    }
    const { linkState, latencySeconds } = useCommsStore.getState();
    enqueuePacket("DOSSIER_TRANSMIT", `Dossier ${report.metadata.reportId}`, {
      reportId: report.metadata.reportId,
      astronautId: report.metadata.astronautId,
      missionId: report.metadata.missionId,
      generatedAt: report.metadata.generatedAt,
      symptomCount: report.symptomHistory.length,
      concordanceEventCount: report.concordanceEvents.length,
      epistemicDisclaimer: report.epistemicDisclaimer,
    });
    setDownlinkNotice(
      linkState === "LOS"
        ? "LOS in effect · dossier buffered in ground outbox"
        : latencySeconds === 0
          ? "Dossier queued · real-time relay transmitting"
          : `Dossier queued · transmitting over ${Math.round(latencySeconds)} s simulated delay`,
    );
    window.setTimeout(() => setDownlinkNotice(null), 4000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/30 p-4 backdrop-blur-[2px] sm:p-8"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Clinical investigation dossier"
        onClick={(event) => event.stopPropagation()}
        className="my-auto flex w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white border border-border-strong shadow-elevated"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-sky-700">
              <FileText className="h-3.5 w-3.5 text-sky-600" />
              Structured Clinical Investigation · FR-12
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              Investigation Dossier
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {report
                ? `${report.metadata.reportId} · ${report.metadata.callsign} · ${report.metadata.missionId}`
                : `${astronautId} · compiling export bundle`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dossier"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-subtle border border-border text-muted transition-colors hover:border-border-strong hover:text-foreground cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="flex rounded-xl glass-panel-subtle p-1 gap-1">
            {(
              [
                { id: "rendered" as const, label: "Rendered Dossier" },
                { id: "markdown" as const, label: "Markdown Source" },
              ]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={tab === item.id}
                onClick={() => setTab(item.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  tab === item.id
                    ? "border border-sky-200 bg-white text-sky-700 shadow-sm"
                    : "border border-transparent text-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={() => void handleCopy()}
              disabled={!report}
              leftIcon={
                copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <ClipboardCopy className="h-3.5 w-3.5" />
                )
              }
            >
              {copied ? "Copied" : "Copy Markdown"}
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={handleDownload}
              disabled={!report}
              leftIcon={<Download className="h-3.5 w-3.5" />}
            >
              Download .md
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={handlePrint}
              disabled={!report}
              leftIcon={<Printer className="h-3.5 w-3.5" />}
            >
              Print / Save PDF
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleDownlink}
              disabled={!report}
              leftIcon={<Satellite className="h-3.5 w-3.5" />}
            >
              Downlink via Comms
            </Button>
          </div>
        </div>

        {downlinkNotice ? (
          <div className="border-b border-border bg-sky-50 px-5 py-2 text-[11px] text-sky-700">
            🛰️ {downlinkNotice}
          </div>
        ) : null}

        {error ? (
          <div className="flex items-center gap-2 border-b border-border bg-red-50 px-5 py-3 text-xs text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="max-h-[calc(100vh-16rem)] overflow-y-auto bg-canvas p-4 sm:p-5">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse rounded-xl glass-panel-subtle"
                />
              ))}
            </div>
          ) : null}

          {!isLoading && report && tab === "rendered" ? (
            <div
              className="rounded-xl bg-white border border-border p-4 text-black shadow-card sm:p-6"
              // Report HTML is generated by our own pure formatter with all
              // interpolated fields escaped in `dossierTemplates.ts`.
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : null}

          {!isLoading && report && tab === "markdown" ? (
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl glass-panel-subtle p-4 font-mono text-[11px] leading-relaxed text-secondary">
              {markdown}
            </pre>
          ) : null}

          {!isLoading && !report && !error ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
              No dossier data available for this cohort.
            </p>
          ) : null}
        </div>

        <footer className="border-t border-border bg-surface-subtle px-5 py-3">
          <p className="text-[11px] leading-relaxed text-muted">
            Non-causal decision support. Temporal alignment indicates
            co-occurrence only; clinical actions require flight surgeon
            verification.
          </p>
        </footer>
      </div>
    </div>
  );
}
