import {
  computeMetricCardSummary,
  filterMeasurementsByDateRange,
  formatRecordCount,
  resolveDateRangeBounds,
} from "./huaweiHealthMetrics.ts";
import {
  HUAWEI_METRIC_DEFINITIONS,
  createStreamingRecordScanner,
  deduplicateParsedRecords,
  parseAppleHealthDateToIso,
  parseAppleHealthZipBytes,
} from "./huaweiHealthParser.ts";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertTrue(condition: boolean, label: string): void {
  if (!condition) {
    throw new Error(`Expected true for: ${label}`);
  }
}

// 1. Timezone preservation test
assertEqual(
  parseAppleHealthDateToIso("2026-10-15 08:30:00 +0630"),
  "2026-10-15T08:30:00+06:30",
  "timezone +0630"
);
assertEqual(
  parseAppleHealthDateToIso("2026-10-15 23:45:12 -0400"),
  "2026-10-15T23:45:12-04:00",
  "timezone -0400"
);

// 2. Grammar helper test
assertEqual(formatRecordCount(0), "0 records", "0 records");
assertEqual(formatRecordCount(1), "1 record", "1 record");
assertEqual(formatRecordCount(2), "2 records", "2 records");

// 3. Exact sourceName="HUAWEI Health" filtering & chunk-boundary streaming test
const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="en_US">
  <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="HUAWEI Health" unit="count/min" startDate="2026-11-13 09:00:00 +0630" endDate="2026-11-13 09:00:00 +0630" value="72"/>
  <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="HUAWEI Health" unit="count/min" startDate="2026-11-14 09:00:00 +0630" endDate="2026-11-14 09:00:00 +0630" value="78"/>
  <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-11-14 09:01:00 +0630" endDate="2026-11-14 09:01:00 +0630" value="88"/>
  <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Huawei Health" unit="count/min" startDate="2026-11-14 09:02:00 +0630" endDate="2026-11-14 09:02:00 +0630" value="95"/>
  <Record type="HKQuantityTypeIdentifierStepCount" sourceName="HUAWEI Health" unit="count" startDate="2026-11-13 09:05:00 +0630" endDate="2026-11-13 09:10:00 +0630" value="140"/>
  <Record type="HKQuantityTypeIdentifierStepCount" sourceName="HUAWEI Health" unit="count" startDate="2026-11-14 09:05:00 +0630" endDate="2026-11-14 09:10:00 +0630" value="260"/>
  <Record type="HKQuantityTypeIdentifierDistanceWalkingRunning" sourceName="HUAWEI Health" unit="km" startDate="2026-11-14 09:05:00 +0630" endDate="2026-11-14 09:10:00 +0630" value="0.21"/>
  <Record type="HKQuantityTypeIdentifierActiveEnergyBurned" sourceName="HUAWEI Health" unit="kcal" startDate="2026-11-14 09:05:00 +0630" endDate="2026-11-14 09:10:00 +0630" value="12.5"/>
  <Record type="HKQuantityTypeIdentifierFlightsClimbed" sourceName="HUAWEI Health" unit="count" startDate="2026-11-14 09:12:00 +0630" endDate="2026-11-14 09:12:00 +0630" value="1"/>
  <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="HUAWEI Health" unit="count/min" startDate="2026-11-14 07:00:00 +0630" endDate="2026-11-14 07:00:00 +0630" value="58"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="HUAWEI Health" startDate="2026-11-14 01:00:00 +0630" endDate="2026-11-14 06:00:00 +0630" value="HKCategoryValueSleepAnalysisAsleepCore"/>
</HealthData>`;

const scanner = createStreamingRecordScanner("ASTRO-01");
for (let i = 0; i < sampleXml.length; i += 19) {
  scanner.pushChunk(sampleXml.slice(i, i + 19));
}
const parsed = scanner.finish();

assertEqual(parsed.totalXmlRecordsScanned, 11, "totalXmlRecordsScanned");
assertEqual(parsed.matchedHuaweiRecords, 8, "matchedHuaweiRecords");
assertEqual(parsed.nonHuaweiSkippedCount, 2, "nonHuaweiSkippedCount");
assertEqual(parsed.unsupportedHuaweiSkippedCount, 1, "unsupportedHuaweiSkippedCount");

// 4. Date-range filtering & instantaneous vs cumulative metric calculation test
const sampleMeasurements = parsed.records.map((r) => r.measurement);
const nov14Now = new Date(2026, 10, 14, 15, 0, 0); // Nov 14, 2026 local

const allFiltered = filterMeasurementsByDateRange(
  sampleMeasurements,
  { preset: "all", customStart: "", customEnd: "" },
  nov14Now
);
assertEqual(allFiltered.length, 8, "allFiltered.length");

const todayFiltered = filterMeasurementsByDateRange(
  sampleMeasurements,
  { preset: "today", customStart: "", customEnd: "" },
  nov14Now
);
assertEqual(todayFiltered.length, 6, "todayFiltered.length (Nov 14 only)");

const last7Filtered = filterMeasurementsByDateRange(
  sampleMeasurements,
  { preset: "last7", customStart: "", customEnd: "" },
  nov14Now
);
assertEqual(last7Filtered.length, 8, "last7Filtered.length");

const customNov13 = filterMeasurementsByDateRange(
  sampleMeasurements,
  { preset: "custom", customStart: "2026-11-13", customEnd: "2026-11-13" },
  nov14Now
);
assertEqual(customNov13.length, 2, "customNov13.length");

const hrDef = HUAWEI_METRIC_DEFINITIONS.find((d) => d.key === "heart_rate")!;
const stepsDef = HUAWEI_METRIC_DEFINITIONS.find((d) => d.key === "steps")!;

const hrAllSummary = computeMetricCardSummary(
  hrDef,
  allFiltered.filter((m) => m.stream_id === hrDef.streamId)
);
assertEqual(hrAllSummary.displayValue, "78", "HR latest reading");
assertEqual(hrAllSummary.aggregationLabel, "Latest reading", "HR aggregation label");
assertEqual(hrAllSummary.recordCountLabel, "2 records", "HR 2 records");

const stepsAllSummary = computeMetricCardSummary(
  stepsDef,
  allFiltered.filter((m) => m.stream_id === stepsDef.streamId)
);
assertEqual(stepsAllSummary.displayValue, "400", "Steps total all (140+260)");
assertEqual(stepsAllSummary.aggregationLabel, "Total for selected range", "Steps label");

const stepsTodaySummary = computeMetricCardSummary(
  stepsDef,
  todayFiltered.filter((m) => m.stream_id === stepsDef.streamId)
);
assertEqual(stepsTodaySummary.displayValue, "260", "Steps total today (Nov 14 only)");
assertEqual(stepsTodaySummary.recordCountLabel, "1 record", "Steps 1 record today");

// Reversed custom dates should still resolve cleanly
const reversedRange = resolveDateRangeBounds({
  preset: "custom",
  customStart: "2026-11-14",
  customEnd: "2026-11-13",
});
assertTrue(
  reversedRange.startMs !== null &&
    reversedRange.endMs !== null &&
    reversedRange.startMs < reversedRange.endMs,
  "reversed custom range normalized"
);

// 5. Duplicate-import prevention test
const existingKeys = new Set<string>();
const firstPass = deduplicateParsedRecords(existingKeys, parsed.records);
assertEqual(firstPass.newlyImportedCount, 8, "firstPass.newlyImportedCount");
assertEqual(firstPass.duplicateSkippedCount, 0, "firstPass.duplicateSkippedCount");

const secondPass = deduplicateParsedRecords(existingKeys, parsed.records);
assertEqual(secondPass.newlyImportedCount, 0, "secondPass.newlyImportedCount");
assertEqual(secondPass.duplicateSkippedCount, 8, "secondPass.duplicateSkippedCount");

// 6. Real Apple Health export ZIP integration & date-range calculation verification
const nodeProcess = (
  globalThis as unknown as {
    process?: { getBuiltinModule?: (id: string) => unknown };
  }
).process;
const fs = nodeProcess?.getBuiltinModule?.("node:fs") as
  | { existsSync: (p: string) => boolean; readFileSync: (p: string) => Uint8Array }
  | undefined;

const sampleZipPath =
  "C:/Users/Dell Latitude 5420/.gemini/antigravity/brain/ead2b09c-bf81-4252-b3cb-c03e4b50bf9f/.user_uploaded/media_1794669408459_d1cbe75f.zip";

let realZipTested = false;
if (fs && fs.existsSync(sampleZipPath)) {
  const zipBytes = new Uint8Array(fs.readFileSync(sampleZipPath));
  const realResult = parseAppleHealthZipBytes(zipBytes, "ASTRO-01");
  assertEqual(realResult.matchedHuaweiRecords, 1325, "real matchedHuaweiRecords");

  const realMeasurements = realResult.records
    .map((r) => r.measurement)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const realAllSteps = computeMetricCardSummary(
    stepsDef,
    realMeasurements.filter((m) => m.stream_id === stepsDef.streamId)
  );
  const realNov13 = filterMeasurementsByDateRange(realMeasurements, {
    preset: "custom",
    customStart: "2026-11-13",
    customEnd: "2026-11-13",
  });
  const realNov14 = filterMeasurementsByDateRange(realMeasurements, {
    preset: "custom",
    customStart: "2026-11-14",
    customEnd: "2026-11-14",
  });

  const realNov13Steps = computeMetricCardSummary(
    stepsDef,
    realNov13.filter((m) => m.stream_id === stepsDef.streamId)
  );
  const realNov14Steps = computeMetricCardSummary(
    stepsDef,
    realNov14.filter((m) => m.stream_id === stepsDef.streamId)
  );

  // Verify Nov 13 + Nov 14 step totals sum to the full total (since export spans Nov 13 & Nov 14)
  assertTrue(realNov13.length > 0 && realNov14.length > 0, "both Nov 13 and Nov 14 have records");
  assertEqual(
    realNov13.length + realNov14.length,
    realMeasurements.length,
    "Nov 13 + Nov 14 equals total real records"
  );
  assertEqual(
    Number(realNov13Steps.displayValue) + Number(realNov14Steps.displayValue),
    Number(realAllSteps.displayValue),
    "Nov 13 + Nov 14 steps equal all-data steps"
  );

  const restingHrDef = HUAWEI_METRIC_DEFINITIONS.find((d) => d.key === "resting_heart_rate")!;
  const realRestingHr = computeMetricCardSummary(
    restingHrDef,
    realMeasurements.filter((m) => m.stream_id === restingHrDef.streamId)
  );
  assertEqual(realRestingHr.recordCountLabel, "1 record", "resting HR singular grammar");

  realZipTested = true;
}

console.log(
  `PASS · Huawei Health parser, date-range metrics, grammar, and deduplication (real ZIP verified: ${realZipTested})`
);
