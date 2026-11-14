import {
  parseAppleHealthZipBytes,
  type HuaweiImportProgress,
  type StreamingParseResult,
} from "../lib/huaweiHealthParser";

export interface AppleHealthWorkerRequest {
  type: "import_zip";
  file: File;
  astronautId: string;
}

export type AppleHealthWorkerResponse =
  | { type: "progress"; progress: HuaweiImportProgress }
  | { type: "complete"; result: StreamingParseResult }
  | { type: "error"; message: string };

self.onmessage = async (event: MessageEvent<AppleHealthWorkerRequest>) => {
  const payload = event.data;
  if (!payload || payload.type !== "import_zip") {
    return;
  }

  try {
    self.postMessage({
      type: "progress",
      progress: {
        stage: "reading",
        percent: 2,
        message: "Reading Apple Health ZIP archive...",
        bytesProcessed: 0,
        totalBytes: payload.file.size,
        scannedRecords: 0,
        matchedRecords: 0,
      },
    } satisfies AppleHealthWorkerResponse);

    const buffer = await payload.file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const result = parseAppleHealthZipBytes(bytes, payload.astronautId, (progress) => {
      self.postMessage({
        type: "progress",
        progress,
      } satisfies AppleHealthWorkerResponse);
    });

    self.postMessage({
      type: "complete",
      result,
    } satisfies AppleHealthWorkerResponse);
  } catch (err) {
    self.postMessage({
      type: "error",
      message:
        err instanceof Error
          ? err.message
          : "Failed to extract or parse Apple Health export ZIP.",
    } satisfies AppleHealthWorkerResponse);
  }
};
