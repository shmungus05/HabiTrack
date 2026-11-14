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
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border text-[11px] text-muted font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse" />
        <span>Initializing...</span>
      </div>
    );
  }

  const isGemini = providerStatus.active_provider === "gemini-flash-lite";
  const isOllama = providerStatus.ollama_available;

  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-surface border border-border text-[11px] font-mono tracking-tight">
      <span
        className={`w-2 h-2 rounded-full ${
          isGemini
            ? "bg-foreground"
            : isOllama
            ? "bg-secondary"
            : "bg-muted"
        }`}
      />
      <span className="text-secondary truncate max-w-[170px]">
        {providerStatus.active_model_name}
      </span>
      {providerStatus.gemini_audio_testing_enabled && (
        <span className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border text-[9px] text-secondary font-medium uppercase tracking-wider">
          Audio Live
        </span>
      )}
    </div>
  );
};
