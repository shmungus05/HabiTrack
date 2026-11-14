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
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 select-none"
    >
      {/* Standby Trigger Pill */}
      <div
        className={`group flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-white border transition-colors duration-150 cursor-pointer shadow-elevated ${
          latchedRule
            ? "border-amber-300 hover:border-amber-400"
            : "border-slate-200 hover:border-slate-300"
        }`}
        onClick={() => openDrawer(latchedRule ? "checklists" : "evidence")}
        title={latchedRule ? `${latchedRule.rule_id}: ${latchedRule.title}` : "Open Wayfinder AI (Ctrl+K)"}
      >
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            latchedRule ? "bg-amber-500" : "bg-sky-600"
          }`}
        />

        <span className="text-xs font-semibold tracking-tight text-slate-900 whitespace-nowrap">
          Wayfinder AI
        </span>

        {latchedRule && (
          <span className="px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-mono font-medium">
            {latchedRule.rule_id}
          </span>
        )}

        <kbd className="hidden sm:inline-flex items-center rounded-md bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[11px] font-mono text-slate-600">
          Ctrl K
        </kbd>
      </div>

      {/* Push-to-Talk Mic Button */}
      <button
        type="button"
        title={isRecording ? "Release to Send (Alt+V)" : "Push-to-Talk Voice (Alt+V)"}
        className={`relative flex items-center justify-center w-9 h-9 rounded-full border transition-all duration-150 cursor-pointer shadow-elevated ${
          isRecording
            ? "bg-red-600 border-red-600 text-white scale-105"
            : "bg-white border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900"
        }`}
        onMouseDown={startListening}
        onMouseUp={stopListening}
        onTouchStart={startListening}
        onTouchEnd={stopListening}
      >
        {/* Dynamic Waveform Energy Aura */}
        {isRecording && (
          <span
            className="absolute inset-0 rounded-full border border-red-400/70 pointer-events-none animate-ping"
            style={{
              transform: `scale(${1.0 + energyLevel * 0.8})`,
              opacity: 0.3 + energyLevel * 0.7,
            }}
          />
        )}
        <svg
          className="w-4 h-4 relative z-10"
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
