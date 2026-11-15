/**
 * web/src/components/ProviderStatusBadge.tsx: Displays active decision support
 * engine status and live SI model telemetry with Perplexity minimalist aesthetics.
 */

import React, { useEffect } from "react";
import { useAssistantStore } from "../stores/assistantStore";

export const ProviderStatusBadge: React.FC = () => {
  const { providerStatus, refreshProviderStatus, aiModelMode, localModelStatus } = useAssistantStore();

  useEffect(() => {
    refreshProviderStatus();
  }, [refreshProviderStatus]);

  const isLocal = aiModelMode === "local";
  const label = isLocal
    ? localModelStatus === "ready"
      ? "Llama-3.2-1B (WebGPU)"
      : "Llama-3.2-1B (Init)"
    : "Gemini 2.5 Flash";

  const dotColor = isLocal
    ? localModelStatus === "ready"
      ? "bg-emerald-500"
      : "bg-amber-500"
    : "bg-sky-500";

  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg glass-panel-subtle text-[11px] font-mono tracking-tight">
      <span className={`w-2 h-2 rounded-full ${dotColor} animate-pulse`} />
      <span className="text-secondary truncate max-w-[170px]">
        {label}
      </span>
      {isLocal && localModelStatus === "ready" && (
        <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-700 font-bold uppercase tracking-wider">
          Offline
        </span>
      )}
    </div>
  );
};
