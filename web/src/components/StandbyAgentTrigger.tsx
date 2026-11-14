/**
 * web/src/components/StandbyAgentTrigger.tsx: Global floating standby pill
 * with Push-to-Talk voice capture, keyboard shortcuts (Ctrl+K, Alt+V),
 * real-time audio energy waveform, and latched rule indicator.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  PushToTalkController,
  startAudioEnergyMeter,
  type AudioMeter,
} from "../lib/speech";
import { useAssistantStore } from "../stores/assistantStore";

export const StandbyAgentTrigger: React.FC = () => {
  const {
    isOpen,
    openDrawer,
    closeDrawer,
    pttState,
    setPttState,
    setSpeechTranscript,
    submitQuery,
    latchedRule,
  } = useAssistantStore();

  const [energyLevel, setEnergyLevel] = useState<number>(0);
  const pttControllerRef = useRef<PushToTalkController | null>(null);
  const audioMeterRef = useRef<AudioMeter | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Setup PTT controller
  useEffect(() => {
    pttControllerRef.current = new PushToTalkController(
      (payload) => {
        setSpeechTranscript(payload.transcript);
        if (payload.isFinal) {
          submitQuery(payload.transcript);
        }
      },
      (err) => {
        console.warn("PTT Speech error:", err);
        stopListening();
      },
      () => {
        stopListening();
      }
    );

    return () => {
      stopListening();
    };
  }, [setSpeechTranscript, submitQuery]);

  // Global Keybindings: Ctrl+K (open drawer & focus) and Alt+V (toggle voice PTT)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K: Open Standby Drawer
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          closeDrawer();
        } else {
          openDrawer("checklists");
        }
      }
      // Alt+V: Toggle Voice PTT
      if (e.altKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        if (pttState === "LISTENING") {
          stopListening();
        } else {
          startListening();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, openDrawer, closeDrawer, pttState]);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const meter = await startAudioEnergyMeter(stream);
      audioMeterRef.current = meter;

      const updateWaveform = () => {
        if (audioMeterRef.current) {
          setEnergyLevel(audioMeterRef.current.getEnergy());
          animationFrameRef.current = requestAnimationFrame(updateWaveform);
        }
      };
      animationFrameRef.current = requestAnimationFrame(updateWaveform);

      pttControllerRef.current?.start();
      setPttState("LISTENING");
    } catch (err) {
      console.warn("Microphone access failed:", err);
      setPttState("IDLE");
    }
  };

  const stopListening = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioMeterRef.current) {
      audioMeterRef.current.stop();
      audioMeterRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    pttControllerRef.current?.stop();
    setPttState("IDLE");
    setEnergyLevel(0);
  };

  const isRecording = pttState === "LISTENING";

  return (
    <aside
      aria-label="Standby AI Assistant"
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 select-none"
    >
      {/* Standby Trigger Pill */}
      <div
        className={`group flex items-center gap-3 px-4 py-2.5 rounded-lg bg-surface-elevated border transition-colors duration-200 cursor-pointer ${
          latchedRule
            ? "border-border-strong hover:border-foreground/40"
            : "border-border hover:border-border-strong"
        }`}
        onClick={() => openDrawer(latchedRule ? "checklists" : "evidence")}
      >
        {/* Pulsing Status Dot */}
        <div className="relative flex items-center justify-center">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              latchedRule
                ? "bg-foreground"
                : "bg-secondary"
            }`}
          />
          {latchedRule && (
            <span className="absolute w-5 h-5 rounded-full bg-foreground/15 animate-ping" />
          )}
        </div>

        {/* Pill Content */}
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-foreground group-hover:text-foreground transition-colors">
              WAYFINDER AI
            </span>
            {latchedRule && (
              <span className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border text-secondary text-[10px] font-mono font-medium tracking-tight">
                {latchedRule.rule_id}
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted font-mono">
            {latchedRule
              ? latchedRule.title.slice(0, 30) + "..."
              : "Standby | Press Ctrl+K"}
          </span>
        </div>

        {/* Keyboard Hint Badge */}
        <div className="hidden sm:flex items-center gap-1 pl-1 text-[10px] font-mono text-faint">
          <kbd className="px-1.5 py-0.5 rounded-md bg-surface-elevated border border-border text-secondary">
            Ctrl
          </kbd>
          <span>+</span>
          <kbd className="px-1.5 py-0.5 rounded-md bg-surface-elevated border border-border text-secondary">
            K
          </kbd>
        </div>
      </div>

      {/* Push-to-Talk Mic Button */}
      <button
        type="button"
        title={isRecording ? "Release to Send (Alt+V)" : "Push-to-Talk Voice (Alt+V)"}
        className={`relative flex items-center justify-center w-11 h-11 rounded-lg border transition-colors duration-200 ${
          isRecording
            ? "bg-critical-strong border-critical text-white scale-105"
            : "bg-surface-elevated hover:bg-surface-subtle border-border text-secondary hover:text-foreground"
        }`}
        onMouseDown={startListening}
        onMouseUp={stopListening}
        onTouchStart={startListening}
        onTouchEnd={stopListening}
      >
        {/* Dynamic Waveform Energy Aura */}
        {isRecording && (
          <span
            className="absolute inset-0 rounded-lg border border-critical/60 pointer-events-none animate-ping"
            style={{
              transform: `scale(${1.0 + energyLevel * 0.8})`,
              opacity: 0.3 + energyLevel * 0.7,
            }}
          />
        )}
        <svg
          className="w-5 h-5 relative z-10"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
      </button>
    </aside>
  );
};
