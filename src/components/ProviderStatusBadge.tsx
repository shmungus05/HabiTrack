/**
 * web/src/components/ProviderStatusBadge.tsx: Displays active decision support
 * engine status and live AI model telemetry with Perplexity minimalist aesthetics.
 */

import React, { useEffect } from "react";
import { useAssistantStore } from "../stores/assistantStore";

export const ProviderStatusBadge: React.FC = () => {
  const { providerStatus, refreshProviderStatus } = useAssistantStore();

  useEffect(() => {
    refreshProviderStatus();
  }, [refreshProviderStatus]);

  if (!providerStatus) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass-panel-subtle text-[11px] text-muted font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span>Initializing...</span>
      </div>
    );
  }

  const isGemini = providerStatus.active_provider === "gemini-flash-lite";
  const isOllama = providerStatus.ollama_available;

  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg glass-panel-subtle text-[11px] font-mono tracking-tight">
      <span
        className={`w-2 h-2 rounded-full ${
          isGemini
            ? "bg-emerald-500"
            : isOllama
            ? "bg-sky-600"
            : "bg-amber-500"
        }`}
      />
      <span className="text-secondary truncate max-w-[170px]">
        {providerStatus.active_model_name}
      </span>
      {providerStatus.gemini_audio_testing_enabled && (
        <span className="px-1.5 py-0.5 rounded bg-sky-50 border border-sky-200 text-[11px] text-sky-700 font-medium uppercase tracking-wider">
          Audio Live
        </span>
      )}
    </div>
  );
};
