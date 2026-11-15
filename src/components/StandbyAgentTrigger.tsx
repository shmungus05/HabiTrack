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

interface StandbyAgentTriggerProps {
  onNavigateToAssistant?: () => void;
  isAssistantPage?: boolean;
}

export const StandbyAgentTrigger: React.FC<StandbyAgentTriggerProps> = ({
  onNavigateToAssistant,
  isAssistantPage = false,
}) => {
  const {
    isOpen,
    openDrawer,
    closeDrawer,
    pttState,
    setPttState,
    setSpeechTranscript,
    submitQuery,
    latchedRule,
    isVoiceModalOpen,
    openVoiceModal,
    closeVoiceModal,
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

  // Global Keybindings: Ctrl+K (open assistant & focus) and Alt+V (toggle voice PTT)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K: Navigate to Dedicated AI Assistant
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (onNavigateToAssistant) {
          onNavigateToAssistant();
        } else if (isOpen) {
          closeDrawer();
        } else {
          openDrawer("chat");
        }
      }
      // Alt+V: Launch Interactive Voice Mode
      if (e.altKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        if (isVoiceModalOpen) {
          closeVoiceModal();
        } else {
          openVoiceModal();
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

  if (isAssistantPage) {
    return null;
  }

  return (
    <aside
      aria-label="Standby AI Assistant"
      className="fixed bottom-5 right-5 z-40 flex items-center select-none"
    >
      {/* Single Unified HabiTrack AI Floating Action Trigger */}
      <button
        type="button"
        onClick={() => {
          if (onNavigateToAssistant) {
            onNavigateToAssistant();
          } else {
            openDrawer("chat");
          }
        }}
        className={`group relative flex items-center gap-2.5 p-2 pr-3.5 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 hover:border-slate-300 transition-all duration-200 cursor-pointer shadow-elevated hover:shadow-lg active:scale-95 ${
          isRecording ? "ring-2 ring-red-500/50 border-red-500" : ""
        }`}
        title="Open Dedicated HabiTrack AI Workstation (Ctrl+K · Alt+V Voice)"
      >
        {/* Dynamic Waveform Energy Aura during Voice Dictation */}
        {isRecording && (
          <span
            className="absolute inset-0 rounded-full border-2 border-red-400/80 pointer-events-none animate-ping"
            style={{
              transform: `scale(${1.0 + energyLevel * 0.5})`,
              opacity: 0.3 + energyLevel * 0.7,
            }}
          />
        )}

        {/* HabiTrack Official Brand Emblem */}
        <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-50 border border-slate-200/80 overflow-hidden p-0.5 shadow-2xs">
          <img
            src="/Logo.png"
            alt="HabiTrack Logo"
            className="h-full w-full object-contain rounded-full"
          />
        </span>

        {/* Label and Status */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold tracking-tight whitespace-nowrap ${isRecording ? "text-red-600 animate-pulse" : "text-slate-900"}`}>
            {isRecording ? "Listening..." : "HabiTrack AI"}
          </span>

          <kbd className="hidden sm:inline-flex items-center rounded-md bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
            Ctrl K
          </kbd>
        </div>

      </button>
    </aside>
  );
};
