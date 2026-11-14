import {
  createEmptyCategoryCounts,
  type HuaweiImportSummary,
  type ParsedHuaweiRecord,
  type StreamingParseResult,
} from "../lib/huaweiHealthParser";
import type { Measurement } from "../types/api";

const DB_NAME = "habitrack_health_imports_v1";
const DB_VERSION = 1;
const STORE_MEASUREMENTS = "measurements";
const STORE_IMPORTS = "imports";

interface StoredMeasurementRow {
  dedupKey: string;
  astronautId: string;
  streamId: string;
  timestamp: string;
  measurement: Measurement;
}

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openHealthDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error("IndexedDB is not available in this browser environment."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_MEASUREMENTS)) {
        const store = db.createObjectStore(STORE_MEASUREMENTS, { keyPath: "dedupKey" });
        store.createIndex("by_astronaut", "astronautId", { unique: false });
        store.createIndex("by_stream", "streamId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_IMPORTS)) {
        const importStore = db.createObjectStore(STORE_IMPORTS, { keyPath: "id" });
        importStore.createIndex("by_imported_at", "importedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open IndexedDB for health imports."));
  });
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed."));
  });
}

/**
 * Saves parsed Huawei Health records into IndexedDB, skipping any records
 * whose deterministic `dedupKey` already exists so re-importing the same ZIP
 * never duplicates measurements.
 */
export async function saveHuaweiImportToIndexedDb(
  astronautId: string,
  fileName: string,
  parsed: StreamingParseResult
): Promise<HuaweiImportSummary> {
  const db = await openHealthDb();

  try {
    const tx = db.transaction([STORE_MEASUREMENTS, STORE_IMPORTS], "readwrite");
    const measStore = tx.objectStore(STORE_MEASUREMENTS);
    const importStore = tx.objectStore(STORE_IMPORTS);
    const astronautIndex = measStore.index("by_astronaut");

    const existingRows = (await requestToPromise(
      astronautIndex.getAll(astronautId)
    )) as StoredMeasurementRow[];
    const existingKeys = new Set(existingRows.map((row) => row.dedupKey));

    let newlyImportedCount = 0;
    let duplicateSkippedCount = 0;

    for (const item of parsed.records) {
      if (existingKeys.has(item.dedupKey)) {
        duplicateSkippedCount += 1;
        continue;
      }
      existingKeys.add(item.dedupKey);
      newlyImportedCount += 1;
      const row: StoredMeasurementRow = {
        dedupKey: item.dedupKey,
        astronautId,
        streamId: item.measurement.stream_id,
        timestamp: item.measurement.timestamp,
        measurement: item.measurement,
      };
      measStore.put(row);
    }

    const summary: HuaweiImportSummary = {
      id: `${astronautId}:${Date.now()}`,
      fileName,
      importedAt: new Date().toISOString(),
      sourceLabel: "Health Data Export",
      totalXmlRecordsScanned: parsed.totalXmlRecordsScanned,
      matchedHuaweiRecords: parsed.matchedHuaweiRecords,
      newlyImportedCount,
      duplicateSkippedCount,
      nonHuaweiSkippedCount: parsed.nonHuaweiSkippedCount,
      unsupportedHuaweiSkippedCount: parsed.unsupportedHuaweiSkippedCount,
      categoryCounts: parsed.categoryCounts ?? createEmptyCategoryCounts(),
      dateRange: parsed.dateRange,
    };

    importStore.put({ ...summary, astronautId });

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted."));
    });

    return summary;
  } finally {
    db.close();
  }
}

export async function getImportedHuaweiMeasurements(
  astronautId: string
): Promise<Measurement[]> {
  if (!isIndexedDbAvailable()) return [];

  try {
    const db = await openHealthDb();
    try {
      const tx = db.transaction(STORE_MEASUREMENTS, "readonly");
      const index = tx.objectStore(STORE_MEASUREMENTS).index("by_astronaut");
      const rows = (await requestToPromise(
        index.getAll(astronautId)
      )) as StoredMeasurementRow[];

      return rows
        .map((row) => row.measurement)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}

export async function getLatestHuaweiImportSummary(
  astronautId: string
): Promise<HuaweiImportSummary | null> {
  if (!isIndexedDbAvailable()) return null;

  try {
    const db = await openHealthDb();
    try {
      const tx = db.transaction(STORE_IMPORTS, "readonly");
      const rows = (await requestToPromise(
        tx.objectStore(STORE_IMPORTS).getAll()
      )) as Array<HuaweiImportSummary & { astronautId?: string }>;

      const matching = rows
        .filter((row) => !row.astronautId || row.astronautId === astronautId)
        .sort((a, b) => b.importedAt.localeCompare(a.importedAt));

      return matching[0] ?? null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function clearImportedHuaweiData(astronautId: string): Promise<void> {
  if (!isIndexedDbAvailable()) return;

  const db = await openHealthDb();
  try {
    const tx = db.transaction([STORE_MEASUREMENTS, STORE_IMPORTS], "readwrite");
    const measStore = tx.objectStore(STORE_MEASUREMENTS);
    const importStore = tx.objectStore(STORE_IMPORTS);

    const measRows = (await requestToPromise(
      measStore.index("by_astronaut").getAllKeys(astronautId)
    )) as IDBValidKey[];
    for (const key of measRows) {
      measStore.delete(key);
    }

    const importRows = (await requestToPromise(
      importStore.getAll()
    )) as Array<HuaweiImportSummary & { astronautId?: string }>;
    for (const row of importRows) {
      if (!row.astronautId || row.astronautId === astronautId) {
        importStore.delete(row.id);
      }
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Failed to clear imported data."));
    });
  } finally {
    db.close();
  }
}

/**
 * Pure helper for unit testing deduplication logic without IndexedDB.
 */
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
