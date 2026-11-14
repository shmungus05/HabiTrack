import { unzipSync, Unzip, UnzipInflate } from "fflate";
import type { Measurement } from "../types/api";

export const HUAWEI_SOURCE_NAME = "HUAWEI Health";

export type HuaweiMetricKey =
  | "heart_rate"
  | "resting_heart_rate"
  | "steps"
  | "walking_running_distance"
  | "active_energy"
  | "flights_climbed";

export type HuaweiStreamId =
  | "stream_huawei_hr"
  | "stream_huawei_resting_hr"
  | "stream_huawei_steps"
  | "stream_huawei_distance"
  | "stream_huawei_active_energy"
  | "stream_huawei_flights";

export interface HuaweiMetricDefinition {
  key: HuaweiMetricKey;
  hkType: string;
  streamId: HuaweiStreamId;
  label: string;
  unit: string;
  digits: number;
  aggregation: "latest" | "sum";
}

export const HUAWEI_METRIC_DEFINITIONS: HuaweiMetricDefinition[] = [
  {
    key: "heart_rate",
    hkType: "HKQuantityTypeIdentifierHeartRate",
    streamId: "stream_huawei_hr",
    label: "Heart Rate",
    unit: "bpm",
    digits: 0,
    aggregation: "latest",
  },
  {
    key: "resting_heart_rate",
    hkType: "HKQuantityTypeIdentifierRestingHeartRate",
    streamId: "stream_huawei_resting_hr",
    label: "Resting Heart Rate",
    unit: "bpm",
    digits: 0,
    aggregation: "latest",
  },
  {
    key: "steps",
    hkType: "HKQuantityTypeIdentifierStepCount",
    streamId: "stream_huawei_steps",
    label: "Steps",
    unit: "count",
    digits: 0,
    aggregation: "sum",
  },
  {
    key: "walking_running_distance",
    hkType: "HKQuantityTypeIdentifierDistanceWalkingRunning",
    streamId: "stream_huawei_distance",
    label: "Walking / Running Distance",
    unit: "km",
    digits: 2,
    aggregation: "sum",
  },
  {
    key: "active_energy",
    hkType: "HKQuantityTypeIdentifierActiveEnergyBurned",
    streamId: "stream_huawei_active_energy",
    label: "Active Energy Burned",
    unit: "kcal",
    digits: 1,
    aggregation: "sum",
  },
  {
    key: "flights_climbed",
    hkType: "HKQuantityTypeIdentifierFlightsClimbed",
    streamId: "stream_huawei_flights",
    label: "Flights Climbed",
    unit: "count",
    digits: 0,
    aggregation: "sum",
  },
];

export const UNAVAILABLE_HUAWEI_METRICS = [
  { key: "sleep", label: "Sleep" },
  { key: "spo2", label: "SpO₂ (Blood Oxygen)" },
  { key: "hrv", label: "HRV (Heart Rate Variability)" },
  { key: "workouts", label: "Workouts" },
] as const;

const HK_TYPE_TO_DEF = new Map<string, HuaweiMetricDefinition>(
  HUAWEI_METRIC_DEFINITIONS.map((def) => [def.hkType, def])
);

export interface ParsedHuaweiRecord {
  dedupKey: string;
  metricKey: HuaweiMetricKey;
  measurement: Measurement;
  endTimestamp: string | null;
}

export interface HuaweiImportSummary {
  id: string;
  fileName: string;
  importedAt: string;
  sourceLabel: "Health Data Export";
  totalXmlRecordsScanned: number;
  matchedHuaweiRecords: number;
  newlyImportedCount: number;
  duplicateSkippedCount: number;
  nonHuaweiSkippedCount: number;
  unsupportedHuaweiSkippedCount: number;
  categoryCounts: Record<HuaweiMetricKey, number>;
  dateRange: {
    start: string | null;
    end: string | null;
  };
}

export interface HuaweiImportProgress {
  stage: "reading" | "extracting" | "parsing" | "saving" | "complete";
  percent: number;
  message: string;
  bytesProcessed: number;
  totalBytes: number;
  scannedRecords: number;
  matchedRecords: number;
}

export function createEmptyCategoryCounts(): Record<HuaweiMetricKey, number> {
  return {
    heart_rate: 0,
    resting_heart_rate: 0,
    steps: 0,
    walking_running_distance: 0,
    active_energy: 0,
    flights_climbed: 0,
  };
}

function decodeXmlEntities(value: string): string {
  if (!value.includes("&")) return value;
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Converts Apple Health timestamp strings (e.g. "2026-10-15 08:30:00 +0630")
 * into ISO-8601 strings preserving the original timezone offset ("2026-10-15T08:30:00+06:30").
 */
export function parseAppleHealthDateToIso(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const appleMatch = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?\s*([+-]\d{2}):?(\d{2})|Z$/i.exec(
    trimmed
  );
  if (appleMatch) {
    const datePart = appleMatch[1];
    const timePart = appleMatch[2];
    const fracPart = appleMatch[3] ? `.${appleMatch[3]}` : "";
    const tzHours = appleMatch[4];
    const tzMinutes = appleMatch[5];
    if (datePart && timePart && tzHours && tzMinutes) {
      return `${datePart}T${timePart}${fracPart}${tzHours}:${tzMinutes}`;
    }
  }

  // Fallback for standard ISO timestamps
  const isoMatch = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}:\d{2})$/i.exec(
    trimmed
  );
  if (isoMatch) {
    return `${isoMatch[1]}T${isoMatch[2]}${isoMatch[3].toUpperCase()}`;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeValueForMetric(
  def: HuaweiMetricDefinition,
  rawValue: number,
  rawUnit: string
): number {
  const unit = rawUnit.trim().toLowerCase();
  if (def.key === "walking_running_distance") {
    if (unit === "m" || unit === "meter" || unit === "meters") {
      return Number((rawValue / 1000).toFixed(4));
    }
    if (unit === "mi" || unit === "mile" || unit === "miles") {
      return Number((rawValue * 1.609344).toFixed(4));
    }
  }
  if (def.key === "active_energy") {
    if (unit === "kj") {
      return Number((rawValue * 0.239006).toFixed(3));
    }
    if (unit === "cal") {
      return Number((rawValue / 1000).toFixed(3));
    }
  }
  return rawValue;
}

function extractXmlAttributes(tagBody: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([A-Za-z0-9_:-]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(tagBody)) !== null) {
    attrs[match[1]] = decodeXmlEntities(match[2]);
  }
  return attrs;
}

export interface StreamingParseResult {
  records: ParsedHuaweiRecord[];
  totalXmlRecordsScanned: number;
  matchedHuaweiRecords: number;
  nonHuaweiSkippedCount: number;
  unsupportedHuaweiSkippedCount: number;
  categoryCounts: Record<HuaweiMetricKey, number>;
  dateRange: { start: string | null; end: string | null };
}

/**
 * Incremental streaming scanner for Apple Health `<Record ... />` elements.
 * Avoids building a DOM tree so ~40 MB XML files parse with minimal memory.
 */
export function createStreamingRecordScanner(astronautId: string) {
  let carry = "";
  const records: ParsedHuaweiRecord[] = [];
  const categoryCounts = createEmptyCategoryCounts();
  let totalXmlRecordsScanned = 0;
  let matchedHuaweiRecords = 0;
  let nonHuaweiSkippedCount = 0;
  let unsupportedHuaweiSkippedCount = 0;
  let minStart: string | null = null;
  let maxStart: string | null = null;

  const processRecordTag = (tagBody: string) => {
    totalXmlRecordsScanned += 1;

    // Fast path reject before full attribute parsing when sourceName="HUAWEI Health" is absent
    if (!tagBody.includes(HUAWEI_SOURCE_NAME)) {
      nonHuaweiSkippedCount += 1;
      return;
    }

    const attrs = extractXmlAttributes(tagBody);
    if (attrs.sourceName !== HUAWEI_SOURCE_NAME) {
      nonHuaweiSkippedCount += 1;
      return;
    }

    const def = attrs.type ? HK_TYPE_TO_DEF.get(attrs.type) : undefined;
    if (!def) {
      unsupportedHuaweiSkippedCount += 1;
      return;
    }

    const numericValue = Number(attrs.value);
    if (!Number.isFinite(numericValue)) {
      unsupportedHuaweiSkippedCount += 1;
      return;
    }

    const startIso = attrs.startDate ? parseAppleHealthDateToIso(attrs.startDate) : null;
    if (!startIso) {
      unsupportedHuaweiSkippedCount += 1;
      return;
    }

    const endIso = attrs.endDate ? parseAppleHealthDateToIso(attrs.endDate) : null;
    const normalizedValue = normalizeValueForMetric(def, numericValue, attrs.unit ?? "");

    // Deterministic key prevents duplicate imports of the same export ZIP
    const dedupKey = `${astronautId}|${def.streamId}|${startIso}|${endIso ?? ""}|${normalizedValue}`;

    if (!minStart || startIso < minStart) minStart = startIso;
    if (!maxStart || startIso > maxStart) maxStart = startIso;

    matchedHuaweiRecords += 1;
    categoryCounts[def.key] += 1;

    records.push({
      dedupKey,
      metricKey: def.key,
      endTimestamp: endIso,
      measurement: {
        id: null,
        stream_id: def.streamId,
        astronaut_id: astronautId,
        timestamp: startIso,
        value: normalizedValue,
        quality_status: "VALID",
        is_synthetic: false,
        provenance_category: "HUAWEI_HEALTH",
      },
    });
  };

  const pushChunk = (chunk: string) => {
    const text = carry + chunk;
    let cursor = 0;

    while (cursor < text.length) {
      const startIdx = text.indexOf("<Record", cursor);
      if (startIdx === -1) {
        // Keep a small tail in case "<Record" is split across chunk boundaries
        const tailLen = Math.min(8, text.length - cursor);
        carry = text.slice(text.length - tailLen);
        return;
      }

      // Ensure "<Record" is followed by whitespace or '/' or '>'
      const nextChar = text[startIdx + 7];
      if (nextChar !== undefined && !/[\s/>]/.test(nextChar)) {
        cursor = startIdx + 7;
        continue;
      }

      const endIdx = text.indexOf(">", startIdx + 7);
      if (endIdx === -1) {
        carry = text.slice(startIdx);
        return;
      }

      const tagBody = text.slice(startIdx + 7, endIdx);
      processRecordTag(tagBody);
      cursor = endIdx + 1;
    }

    carry = "";
  };

  const finish = (): StreamingParseResult => {
    carry = "";
    return {
      records,
      totalXmlRecordsScanned,
      matchedHuaweiRecords,
      nonHuaweiSkippedCount,
      unsupportedHuaweiSkippedCount,
      categoryCounts,
      dateRange: { start: minStart, end: maxStart },
    };
  };

  return {
    pushChunk,
    finish,
    getStats: () => ({
      scannedRecords: totalXmlRecordsScanned,
      matchedRecords: matchedHuaweiRecords,
    }),
  };
}

/**
 * Streams `apple_health_export/export.xml` out of an Apple Health ZIP buffer
 * using `fflate` incremental unzipping and chunked XML scanning.
 */
export function parseAppleHealthZipBytes(
  zipBytes: Uint8Array,
  astronautId: string,
  onProgress?: (progress: HuaweiImportProgress) => void
): StreamingParseResult {
  const scanner = createStreamingRecordScanner(astronautId);
  const decoder = new TextDecoder("utf-8");
  let foundExportXml = false;
  let exportXmlError: Error | null = null;
  let lastProgressEmit = 0;

  const unzip = new Unzip((file) => {
    const normalizedName = file.name.replace(/\\/g, "/");
    const isTarget =
      normalizedName === "apple_health_export/export.xml" ||
      (!foundExportXml && normalizedName.endsWith("/export.xml"));

    if (!isTarget) {
      return;
    }

    foundExportXml = true;
    file.ondata = (err, data, final) => {
      if (err) {
        exportXmlError = err;
        return;
      }
      if (data.length > 0) {
        scanner.pushChunk(decoder.decode(data, { stream: !final }));
      } else if (final) {
        const tail = decoder.decode();
        if (tail) scanner.pushChunk(tail);
      }
    };
    file.start();
  });

  unzip.register(UnzipInflate);

  const CHUNK_SIZE = 256 * 1024;
  const totalBytes = zipBytes.byteLength;
  for (let offset = 0; offset < totalBytes; offset += CHUNK_SIZE) {
    const end = Math.min(offset + CHUNK_SIZE, totalBytes);
    const isFinal = end >= totalBytes;
    unzip.push(zipBytes.subarray(offset, end), isFinal);

    if (exportXmlError) {
      throw exportXmlError;
    }

    const now = Date.now();
    if (onProgress && (isFinal || now - lastProgressEmit > 80)) {
      lastProgressEmit = now;
      const stats = scanner.getStats();
      const pct = totalBytes > 0 ? Math.min(92, Math.round((end / totalBytes) * 90) + 2) : 50;
      onProgress({
        stage: foundExportXml ? "parsing" : "extracting",
        percent: pct,
        message: foundExportXml
          ? `Scanning Apple Health XML (${stats.scannedRecords.toLocaleString()} records, ${stats.matchedRecords.toLocaleString()} Huawei matches)...`
          : "Locating apple_health_export/export.xml in archive...",
        bytesProcessed: end,
        totalBytes,
        scannedRecords: stats.scannedRecords,
        matchedRecords: stats.matchedRecords,
      });
    }
  }

  if (!foundExportXml) {
    // Fallback check via unzipSync directory listing if streaming skipped due to unexpected structure
    const entries = unzipSync(zipBytes, {
      filter: (f) => f.name.replace(/\\/g, "/") === "apple_health_export/export.xml",
    });
    const fallbackBytes = entries["apple_health_export/export.xml"];
    if (!fallbackBytes) {
      throw new Error(
        "Could not find apple_health_export/export.xml inside the selected ZIP archive."
      );
    }
    const text = new TextDecoder("utf-8").decode(fallbackBytes);
    scanner.pushChunk(text);
  }

  return scanner.finish();
}

export function deduplicateParsedRecords(
  existingKeys: Set<string>,
  records: ParsedHuaweiRecord[]
): {
  uniqueNewRecords: ParsedHuaweiRecord[];
  newlyImportedCount: number;
  duplicateSkippedCount: number;
} {
  const uniqueNewRecords: ParsedHuaweiRecord[] = [];
  let duplicateSkippedCount = 0;

  for (const rec of records) {
    if (existingKeys.has(rec.dedupKey)) {
      duplicateSkippedCount += 1;
      continue;
    }
    existingKeys.add(rec.dedupKey);
    uniqueNewRecords.push(rec);
  }

  return {
    uniqueNewRecords,
    newlyImportedCount: uniqueNewRecords.length,
    duplicateSkippedCount,
  };
}
