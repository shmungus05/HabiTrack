import {
  AlertCircle,
  CheckCircle2,
  FileArchive,
  Loader2,
  ShieldCheck,
  Trash2,
  Upload,
  Watch,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  HUAWEI_METRIC_DEFINITIONS,
  UNAVAILABLE_HUAWEI_METRICS,
  type HuaweiImportProgress,
  type HuaweiImportSummary,
} from "../lib/huaweiHealthParser";
import {
  clearImportedHuaweiData,
  getLatestHuaweiImportSummary,
} from "../services/healthImportStorage";
import { importAppleHealthZip } from "../services/huaweiImportService";
import { Button } from "./ui";

interface HealthImportModalProps {
  isOpen: boolean;
  astronautId: string;
  onClose: () => void;
  onImportComplete: () => void;
}

export function HealthImportModal({
  isOpen,
  astronautId,
  onClose,
  onImportComplete,
}: HealthImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<HuaweiImportProgress | null>(null);
  const [summary, setSummary] = useState<HuaweiImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setError(null);
    getLatestHuaweiImportSummary(astronautId).then((existing) => {
      if (active && existing) {
        setSummary(existing);
      }
    });
    return () => {
      active = false;
    };
  }, [isOpen, astronautId]);

  if (!isOpen) return null;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setError(null);
    setProgress(null);
  };

  const handleStartImport = async () => {
    if (!selectedFile || isImporting) return;
    setIsImporting(true);
    setError(null);
    try {
      const result = await importAppleHealthZip(selectedFile, astronautId, (prog) => {
        setProgress(prog);
      });
      setSummary(result);
      onImportComplete();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to import the selected Apple Health ZIP file."
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearImported = async () => {
    if (isImporting || clearing) return;
    setClearing(true);
    setError(null);
    try {
      await clearImportedHuaweiData(astronautId);
      setSummary(null);
      setSelectedFile(null);
      setProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onImportComplete();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Failed to clear imported data."
      );
    } finally {
      setClearing(false);
    }
  };

  const totalSkipped = summary
    ? summary.duplicateSkippedCount +
      summary.nonHuaweiSkippedCount +
      summary.unsupportedHuaweiSkippedCount
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="huawei-import-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700">
              <Watch className="h-5 w-5" />
            </span>
            <div>
              <h2
                id="huawei-import-modal-title"
                className="text-base font-bold text-slate-900"
              >
                Import Health Data
              </h2>
              <p className="text-xs text-slate-500">
                Source: <span className="font-semibold text-slate-700">Health Data Export</span>{" "}
                (historical `.zip` export, processed locally)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 cursor-pointer"
            aria-label="Close import modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p>
              <strong>On-device privacy:</strong> Your Apple Health ZIP is extracted and streamed
              inside a local Web Worker. Only records with exact{" "}
              <code className="rounded bg-white/80 px-1 py-0.5 font-mono text-[11px]">
                sourceName="HUAWEI Health"
              </code>{" "}
              are saved to IndexedDB. Nothing is uploaded or logged.
            </p>
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <FileArchive className="h-5 w-5 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {selectedFile ? selectedFile.name : "Select Apple Health export (.zip)"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selectedFile
                      ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Expects apple_health_export/export.xml`
                      : "Choose your exported export.zip file"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  onChange={handleFileChange}
                  disabled={isImporting}
                  className="hidden"
                  id="apple-health-zip-input"
                />
                <label
                  htmlFor="apple-health-zip-input"
                  className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 ${
                    isImporting ? "pointer-events-none opacity-50" : "cursor-pointer"
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Choose ZIP
                </label>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleStartImport}
                  disabled={!selectedFile || isImporting}
                >
                  {isImporting ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Importing...
                    </span>
                  ) : (
                    "Start Import"
                  )}
                </Button>
              </div>
            </div>

            {progress && (
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{progress.message}</span>
                  <span className="font-mono font-semibold text-sky-700">
                    {progress.percent}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-sky-600 transition-all duration-150"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold">Import failed</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {summary && (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      {summary.newlyImportedCount > 0
                        ? "Import completed successfully"
                        : "Archive verified (all matching records already imported)"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      File: <span className="font-mono">{summary.fileName}</span> · Source:{" "}
                      {summary.sourceLabel}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearImported}
                  disabled={isImporting || clearing}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear Imported
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                  <p className="text-[11px] text-slate-500">Newly Imported</p>
                  <p className="mt-0.5 font-mono text-lg font-bold text-emerald-700">
                    {summary.newlyImportedCount.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                  <p className="text-[11px] text-slate-500">Huawei Matched</p>
                  <p className="mt-0.5 font-mono text-lg font-bold text-slate-900">
                    {summary.matchedHuaweiRecords.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                  <p className="text-[11px] text-slate-500">Duplicates Skipped</p>
                  <p className="mt-0.5 font-mono text-lg font-bold text-amber-700">
                    {summary.duplicateSkippedCount.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                  <p className="text-[11px] text-slate-500">Total Skipped</p>
                  <p className="mt-0.5 font-mono text-lg font-bold text-slate-600">
                    {totalSkipped.toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Available Huawei Health Metric Categories
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {HUAWEI_METRIC_DEFINITIONS.map((def) => {
                    const count = summary.categoryCounts[def.key] ?? 0;
                    return (
                      <div
                        key={def.key}
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs"
                      >
                        <span className="font-medium text-slate-800">{def.label}</span>
                        <span className="font-mono text-slate-600">
                          {count.toLocaleString()} ({def.unit})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Unavailable in Export (Honest Empty State)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {UNAVAILABLE_HUAWEI_METRICS.map((item) => (
                    <span
                      key={item.key}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500"
                    >
                      {item.label}: 0 records
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-3">
          <Button size="sm" variant="default" onClick={onClose} disabled={isImporting}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
