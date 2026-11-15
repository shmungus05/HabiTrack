/**
 * src/workers/webllm.worker.ts
 *
 * Dedicated Web Worker for @mlc-ai/web-llm execution.
 * Offloads WebGPU computation and model inference from the main UI thread
 * to maintain 60fps animations, smooth timelines, and audio responsiveness.
 */

import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
