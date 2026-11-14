import type { Measurement } from "../types/api";
import type { HuaweiMetricDefinition } from "./huaweiHealthParser.ts";

export type DateRangePreset = "all" | "today" | "last7" | "custom";

export interface DateRangeFilter {
  preset: DateRangePreset;
  customStart: string; // YYYY-MM-DD
  customEnd: string;   // YYYY-MM-DD
}

export interface ResolvedDateRange {
  startMs: number | null;
  endMs: number | null;
  label: string;
}

export function formatRecordCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "record" : "records"}`;
}

export function toLocalDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDayStart(yyyyMmDd: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function parseLocalDayEnd(yyyyMmDd: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59, 999);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function resolveDateRangeBounds(
  filter: DateRangeFilter,
  now: Date = new Date()
): ResolvedDateRange {
  if (filter.preset === "all") {
    return {
      startMs: null,
      endMs: null,
      label: "All imported data",
    };
  }

  if (filter.preset === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    return {
      startMs: start,
      endMs: end,
      label: `Today (${formatShortDate(start)})`,
    };
  }

  if (filter.preset === "last7") {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    const start = startDate.getTime();
    return {
      startMs: start,
      endMs: end,
      label: `Last 7 days (${formatShortDate(start)} – ${formatShortDate(end)})`,
    };
  }

  // Custom date range
  let startMs = filter.customStart ? parseLocalDayStart(filter.customStart) : null;
  let endMs = filter.customEnd ? parseLocalDayEnd(filter.customEnd) : null;

  if (startMs !== null && endMs !== null && startMs > endMs) {
    const swappedStart = parseLocalDayStart(filter.customEnd);
    const swappedEnd = parseLocalDayEnd(filter.customStart);
    startMs = swappedStart;
    endMs = swappedEnd;
  }

  let label = "Custom date range";
  if (startMs !== null && endMs !== null) {
    label =
      formatShortDate(startMs) === formatShortDate(endMs)
        ? `Custom (${formatShortDate(startMs)})`
        : `Custom (${formatShortDate(startMs)} – ${formatShortDate(endMs)})`;
  } else if (startMs !== null) {
    label = `From ${formatShortDate(startMs)}`;
  } else if (endMs !== null) {
    label = `Through ${formatShortDate(endMs)}`;
  }

  return { startMs, endMs, label };
}

export function filterMeasurementsByDateRange(
  measurements: Measurement[],
  filter: DateRangeFilter,
  now: Date = new Date()
): Measurement[] {
  const { startMs, endMs } = resolveDateRangeBounds(filter, now);
  if (startMs === null && endMs === null) {
    return measurements;
  }

  return measurements.filter((m) => {
    const ts = new Date(m.timestamp).getTime();
    if (Number.isNaN(ts)) return false;
    if (startMs !== null && ts < startMs) return false;
    if (endMs !== null && ts > endMs) return false;
    return true;
  });
}

export interface MetricCardSummary {
  displayValue: string;
  aggregationLabel: string;
  recordCountLabel: string;
  latestTimestamp: string | null;
}

export function computeMetricCardSummary(
  def: HuaweiMetricDefinition,
  points: Measurement[]
): MetricCardSummary {
  const latest = points.length > 0 ? points[points.length - 1] : null;
  const total = points.reduce((acc, item) => acc + item.value, 0);

  const displayValue =
    points.length === 0
      ? "—"
      : def.aggregation === "sum"
      ? total.toFixed(def.digits)
      : latest!.value.toFixed(def.digits);

  const aggregationLabel =
    def.aggregation === "sum" ? "Total for selected range" : "Latest reading";

  return {
    displayValue,
    aggregationLabel,
    recordCountLabel: formatRecordCount(points.length),
    latestTimestamp: latest?.timestamp ?? null,
  };
}
