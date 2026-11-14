/**
 * Clinical health report dialog.
 *
 * Compiles a health report from either preloaded overview data (zero network)
 * or a self-contained fetch bundle, then offers PDF download, native
 * print-to-PDF.
 */

import {
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  Printer,
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
import { compileHealthReport } from "./healthReportCompiler";
import { downloadHealthReportPdf } from "./healthReportPdf";
import { generateHealthReportHtml } from "./healthReportTemplates";
import type { HealthReport, HealthReportSourceData } from "./types";

export interface HealthReportModalProps {
  open: boolean;
  onClose: () => void;
  astronautId: string;
  preloadedData?: HealthReportSourceData | null;
}

const PRINT_ROOT_ID = "printable-health-report-root";

export function HealthReportModal({
  open,
  onClose,
  astronautId,
  preloadedData,
}: HealthReportModalProps) {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let source: HealthReportSourceData | null = preloadedData ?? null;

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

      setReport(compileHealthReport(source));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to compile the health report.",
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

  const html = useMemo(
    () => (report ? generateHealthReportHtml(report) : ""),
    [report],
  );

  if (!open) {
    return null;
  }

  const handleDownloadPdf = async () => {
    if (!report) {
      return;
    }
    setIsExportingPdf(true);
    setError(null);
    try {
      await downloadHealthReportPdf(report);
    } catch {
      setError("PDF export failed. Use Print / Save PDF instead.");
    } finally {
      setIsExportingPdf(false);
    }
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/30 p-4 backdrop-blur-[2px] sm:p-8"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Clinical health report"
        onClick={(event) => event.stopPropagation()}
        className="my-auto flex w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white border border-border-strong shadow-elevated"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-sky-700">
              <FileText className="h-3.5 w-3.5 text-sky-600" />
              Structured Clinical Health Report · FR-12
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              Clinical Health Report
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
            aria-label="Close health report"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-subtle border border-border text-muted transition-colors hover:border-border-strong hover:text-foreground cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border px-5 py-3">
          <Button
            size="sm"
            variant="primary"
            onClick={() => void handleDownloadPdf()}
            disabled={!report || isExportingPdf}
            leftIcon={
              isExportingPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )
            }
          >
            {isExportingPdf ? "Exporting…" : "Download PDF"}
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
        </div>

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

          {!isLoading && report ? (
            <div
              className="rounded-xl bg-white border border-border p-4 text-black shadow-card sm:p-6"
              // Report HTML is generated by our own pure formatter with all
              // interpolated fields escaped in `healthReportTemplates.ts`.
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : null}

          {!isLoading && !report && !error ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
              No health report data available for this cohort.
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