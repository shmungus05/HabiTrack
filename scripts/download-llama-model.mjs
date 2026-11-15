/**
 * scripts/download-llama-model.mjs
 *
 * Standalone, zero-conflict model downloader for HabiTrack.
 * Downloads the complete Llama-3.2-1B-Instruct-q4f16_1-MLC model weights and WASM binary
 * from Hugging Face into `public/models/Llama-3.2-1B-Instruct-q4f16_1-MLC/`.
 *
 * Features:
 * - Resumes / skips already downloaded files if size matches.
 * - Streams large chunks with live byte-count progress.
 * - Zero dependencies outside native Node.js (fetch, fs, path).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_DIR = path.resolve(
  __dirname,
  "../public/models/Llama-3.2-1B-Instruct-q4f16_1-MLC"
);

const HF_BASE =
  "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main";

const WASM_URL =
  "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_87/base/Llama-3.2-1B-Instruct-q4f16_1_cs1k-webgpu.wasm";

// Complete list of files required by WebLLM for Llama-3.2-1B-Instruct-q4f16_1
const FILES_TO_DOWNLOAD = [
  { name: "mlc-chat-config.json", url: `${HF_BASE}/mlc-chat-config.json` },
  { name: "ndarray-cache.json", url: `${HF_BASE}/ndarray-cache.json` },
  { name: "tensor-cache.json", url: `${HF_BASE}/tensor-cache.json` },
  { name: "tokenizer.json", url: `${HF_BASE}/tokenizer.json` },
  { name: "tokenizer_config.json", url: `${HF_BASE}/tokenizer_config.json` },
  // 22 parameter shards
  ...Array.from({ length: 22 }, (_, i) => ({
    name: `params_shard_${i}.bin`,
    url: `${HF_BASE}/params_shard_${i}.bin`,
  })),
  // Model WebAssembly library binary
  {
    name: "Llama-3.2-1B-Instruct-q4f16_1_cs1k-webgpu.wasm",
    url: WASM_URL,
  },
];

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function downloadFile(fileInfo, index, total) {
  const destPath = path.join(TARGET_DIR, fileInfo.name);

  // Check if file already exists with non-zero size
  if (fs.existsSync(destPath)) {
    const stats = fs.statSync(destPath);
    if (stats.size > 0) {
      // Check head for Content-Length to see if already complete
      try {
        const headRes = await fetch(fileInfo.url, { method: "HEAD" });
        const remoteSize = Number(headRes.headers.get("content-length"));
        if (remoteSize && stats.size === remoteSize) {
          console.log(
            `[${index + 1}/${total}] ✔ ${fileInfo.name} already exists (${formatBytes(stats.size)}), skipping.`
          );
          return;
        }
      } catch {
        // If HEAD fails, proceed to re-download
      }
    }
  }

  console.log(`[${index + 1}/${total}] ⬇ Downloading ${fileInfo.name}...`);
  const response = await fetch(fileInfo.url);
  if (!response.ok) {
    throw new Error(
      `Failed to download ${fileInfo.name}: HTTP ${response.status} ${response.statusText}`
    );
  }

  const totalLength = Number(response.headers.get("content-length")) || 0;
  const tempPath = `${destPath}.tmp`;
  const fileStream = fs.createWriteStream(tempPath);

  let downloaded = 0;
  let lastReport = Date.now();

  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    downloaded += value.length;
    fileStream.write(Buffer.from(value));

    const now = Date.now();
    if (now - lastReport > 800 || downloaded === totalLength) {
      lastReport = now;
      const pct = totalLength ? ` (${((downloaded / totalLength) * 100).toFixed(0)}%)` : "";
      process.stdout.write(
        `\r   ↳ ${formatBytes(downloaded)}${totalLength ? ` / ${formatBytes(totalLength)}` : ""}${pct}`
      );
    }
  }

  await new Promise((resolve, reject) => {
    fileStream.end((err) => (err ? reject(err) : resolve()));
  });

  fs.renameSync(tempPath, destPath);
  console.log(`\n   ✔ Done: ${fileInfo.name} (${formatBytes(downloaded)})`);
}

async function main() {
  console.log("==========================================================");
  console.log(" HabiTrack Local Model Asset Downloader");
  console.log(" Target: Llama-3.2-1B-Instruct-q4f16_1-MLC (WebGPU)");
  console.log(` Destination: ${TARGET_DIR}`);
  console.log("==========================================================\n");

  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }

  const total = FILES_TO_DOWNLOAD.length;
  let successCount = 0;

  for (let i = 0; i < total; i++) {
    const file = FILES_TO_DOWNLOAD[i];
    try {
      await downloadFile(file, i, total);
      successCount++;
    } catch (err) {
      console.error(`\n✖ Failed downloading ${file.name}:`, err.message);
      process.exit(1);
    }
  }

  console.log("\n==========================================================");
  console.log(`✔ All ${successCount}/${total} model assets downloaded successfully!`);
  console.log("Local model is ready for 100% offline in-browser execution.");
  console.log("==========================================================");
}

main();
