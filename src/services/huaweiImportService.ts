import {
  parseAppleHealthZipBytes,
  type HuaweiImportProgress,
  type HuaweiImportSummary,
  type StreamingParseResult,
} from "../lib/huaweiHealthParser";
import type {
  AppleHealthWorkerRequest,
  AppleHealthWorkerResponse,
} from "../workers/appleHealthImport.worker";
import { saveHuaweiImportToIndexedDb } from "./healthImportStorage";

function parseZipInWorker(
  file: File,
  astronautId: string,
  onProgress?: (progress: HuaweiImportProgress) => void
): Promise<StreamingParseResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/appleHealthImport.worker.ts", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (event: MessageEvent<AppleHealthWorkerResponse>) => {
      const msg = event.data;
      if (msg.type === "progress") {
        onProgress?.(msg.progress);
      } else if (msg.type === "complete") {
        worker.terminate();
        resolve(msg.result);
      } else if (msg.type === "error") {
        worker.terminate();
        reject(new Error(msg.message));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(err.message || "Web Worker failed during Apple Health import."));
    };

    const request: AppleHealthWorkerRequest = {
      type: "import_zip",
      file,
      astronautId,
    };
    worker.postMessage(request);
  });
}

export async function importAppleHealthZip(
  file: File,
  astronautId: string,
  onProgress?: (progress: HuaweiImportProgress) => void
): Promise<HuaweiImportSummary> {
  let parsed: StreamingParseResult;

  if (typeof Worker !== "undefined") {
    parsed = await parseZipInWorker(file, astronautId, onProgress);
  } else {
    onProgress?.({
      stage: "reading",
      percent: 5,
      message: "Reading Apple Health ZIP archive...",
      bytesProcessed: 0,
      totalBytes: file.size,
      scannedRecords: 0,
      matchedRecords: 0,
    });
    const buffer = await file.arrayBuffer();
    parsed = parseAppleHealthZipBytes(new Uint8Array(buffer), astronautId, onProgress);
  }

  onProgress?.({
    stage: "saving",
    percent: 95,
    message: "Saving deduplicated Huawei Health records to local IndexedDB...",
    bytesProcessed: file.size,
    totalBytes: file.size,
    scannedRecords: parsed.totalXmlRecordsScanned,
    matchedRecords: parsed.matchedHuaweiRecords,
  });

  const summary = await saveHuaweiImportToIndexedDb(astronautId, file.name, parsed);

  onProgress?.({
    stage: "complete",
    percent: 100,
    message: "Import complete.",
    bytesProcessed: file.size,
    totalBytes: file.size,
    scannedRecords: summary.totalXmlRecordsScanned,
    matchedRecords: summary.matchedHuaweiRecords,
  });

  return summary;
}
