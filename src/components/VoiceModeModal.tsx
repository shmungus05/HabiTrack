/**
 * web/src/components/VoiceModeModal.tsx: Dedicated Interactive SI Voice Mode
 *
 * Implements a high-end, minimalist Perplexity/Gemini Live conversational workspace:
 * - font-black headings, generous whitespace, rounded-[32px] containers
 * - Fluid reactive concentric audio visualizer orb
 * - Continuous hands-free turn taking (Speak -> Telemetry Correlate -> Speak Back -> Listen)
 * - Real-time live interim transcription display & barge-in support
 * - Procedural NASA Quindar radio comms sound FX
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  Radio,
  Activity,
  Square,
  Compass,
  Gauge,
} from "lucide-react";
import {
  startAudioEnergyMeter,
  playQuindarTone,
  playCommsChirp,
  type AudioMeter,
} from "../lib/speech";
import { useAssistantStore } from "../stores/assistantStore";
import { useCohortStore } from "../stores/cohortStore";

export const VoiceModeModal: React.FC = () => {
  const {
    isVoiceModalOpen,
    closeVoiceModal,
    isSpeaking,
    speakingMessageId,
    stopSpeaking,
    submitQuery,
    isLoading,
    messages,
    quindarBeepsEnabled,
    setQuindarBeepsEnabled,
    selectedCompartment,
    voicePersona,
    setVoicePersona,
    setSelectedVoiceName,
    speakMessage,
    voiceRate,
    setVoiceRate,
    aiModelMode,
    setAiModelMode,
    localModelStatus,
    loadLocalModel,
  } = useAssistantStore();

  const activeAstronautId = useCohortStore((state) => state.activeAstronautId);

  const [energyLevel, setEnergyLevel] = useState<number>(0);
  const [interimText, setInterimText] = useState<string>("");
  const [micMuted, setMicMuted] = useState<boolean>(false);
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");

  const recognitionRef = useRef<any>(null);
  const audioMeterRef = useRef<AudioMeter | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isListeningRef = useRef<boolean>(false);

  // Synchronized state refs to avoid stale closures and cyclic dependency loops
  const isSpeakingRef = useRef<boolean>(isSpeaking);
  isSpeakingRef.current = isSpeaking;
  const isLoadingRef = useRef<boolean>(isLoading);
  isLoadingRef.current = isLoading;
  const voiceStatusRef = useRef<"idle" | "listening" | "thinking" | "speaking">(voiceStatus);
  voiceStatusRef.current = voiceStatus;
  const isVoiceModalOpenRef = useRef<boolean>(isVoiceModalOpen);
  isVoiceModalOpenRef.current = isVoiceModalOpen;
  const micMutedRef = useRef<boolean>(micMuted);
  micMutedRef.current = micMuted;

  // Stop everything safely
  const stopMicrophone = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Safe abort
      }
      recognitionRef.current = null;
    }
    if (audioMeterRef.current) {
      audioMeterRef.current.stop();
      audioMeterRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setEnergyLevel(0);
  }, []);

  // Initialize Speech Recognition & Microphone Stream
  const startListening = useCallback(async () => {
    if (micMutedRef.current || !isVoiceModalOpenRef.current) return;

    // Check Web Speech API support
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      setInterimText("Speech recognition is unavailable in this environment. Please use text input.");
      return;
    }

    try {
      // Setup Audio Meter
      if (!mediaStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const meter = await startAudioEnergyMeter(stream);
        audioMeterRef.current = meter;

        const updateEnergy = () => {
          if (audioMeterRef.current && isListeningRef.current) {
            setEnergyLevel(audioMeterRef.current.getEnergy());
            animFrameRef.current = requestAnimationFrame(updateEnergy);
          }
        };
        animFrameRef.current = requestAnimationFrame(updateEnergy);
      }

      if (quindarBeepsEnabled) {
        playCommsChirp(0.04);
      }

      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onstart = () => {
        isListeningRef.current = true;
        setVoiceStatus("listening");
      };

      rec.onresult = (event: any) => {
        let currentInterim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            final += item[0].transcript;
          } else {
            currentInterim += item[0].transcript;
          }
        }

        const candidate = (final || currentInterim).trim();
        if (candidate) {
          setInterimText(candidate);
        }

        if (final && final.trim()) {
          stopMicrophone();
          setVoiceStatus("thinking");
          submitQuery(final.trim());
        }
      };

      rec.onerror = (e: any) => {
        if (e.error !== "no-speech") {
          console.warn("[VoiceMode] Speech error:", e.error);
        }
      };

      rec.onend = () => {
        isListeningRef.current = false;
        // If still in listening state and modal open and not thinking/speaking, restart listening
        if (
          isVoiceModalOpenRef.current &&
          !micMutedRef.current &&
          voiceStatusRef.current === "listening" &&
          !isSpeakingRef.current &&
          !isLoadingRef.current
        ) {
          try {
            rec.start();
          } catch {
            // Safe retry
          }
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.warn("[VoiceMode] Media stream access failed:", err);
      setInterimText("Microphone access was denied. Please allow microphone permissions.");
    }
  }, [quindarBeepsEnabled, stopMicrophone, submitQuery]);

  // Handle open/close lifecycle
  useEffect(() => {
    if (isVoiceModalOpen) {
      if (quindarBeepsEnabled) {
        playQuindarTone("intro");
      }
      startListening();
    } else {
      stopMicrophone();
      stopSpeaking();
      setInterimText("");
      setVoiceStatus("idle");
    }

    return () => {
      stopMicrophone();
      stopSpeaking();
    };
  }, [isVoiceModalOpen]);

  // Synchronize state with assistant store
  useEffect(() => {
    if (!isVoiceModalOpen) return;

    if (isLoading) {
      setVoiceStatus("thinking");
    } else if (isSpeaking) {
      setVoiceStatus("speaking");
      stopMicrophone();
    } else if (voiceStatus === "speaking" && !isSpeaking) {
      // Finished speaking, automatically resume listening for turn-taking!
      setVoiceStatus("listening");
      setInterimText("");
      const timer = setTimeout(() => {
        startListening();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isSpeaking, isVoiceModalOpen, voiceStatus, startListening, stopMicrophone]);

  // Global Escape key listener
  useEffect(() => {
    if (!isVoiceModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeVoiceModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVoiceModalOpen, closeVoiceModal]);

  // Tap Orb: Barge-in / Interrupt if speaking, or toggle mic if listening
  const handleOrbClick = () => {
    if (isSpeaking) {
      stopSpeaking();
      setVoiceStatus("listening");
      startListening();
    } else if (voiceStatus === "listening") {
      stopMicrophone();
      setVoiceStatus("idle");
    } else if (voiceStatus === "idle") {
      startListening();
    }
  };

  // Global Keyboard shortcuts: Space (pause/interrupt/resume), M (toggle mic), Escape (exit)
  useEffect(() => {
    if (!isVoiceModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeVoiceModal();
      } else if (e.code === "Space" && (e.target === document.body || (e.target as HTMLElement).tagName === "DIV")) {
        e.preventDefault();
        handleOrbClick();
      } else if ((e.key === "m" || e.key === "M") && (e.target === document.body || (e.target as HTMLElement).tagName === "DIV")) {
        e.preventDefault();
        if (micMuted) {
          setMicMuted(false);
          startListening();
        } else {
          setMicMuted(true);
          stopMicrophone();
          setVoiceStatus("idle");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVoiceModalOpen, closeVoiceModal, handleOrbClick, micMuted, startListening, stopMicrophone]);

  if (!isVoiceModalOpen) return null;

  // Most recent user spoken prompt ("what I taught/talked")
  const lastUserMessage = [...messages].reverse().find((m) => m.sender === "user");
  const displayedUserPrompt = interimText.trim() || lastUserMessage?.text || "";

  // Dynamic visual sizing for reactive orb
  const baseScale = 1.0 + Math.min(0.45, energyLevel * 0.9);
  const ringScale1 = 1.15 + energyLevel * 0.7;
  const ringScale2 = 1.35 + energyLevel * 1.2;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Interactive SI Voice Mode"
      className="fixed inset-0 z-50 flex flex-col justify-between p-6 sm:p-10 md:p-14 bg-slate-950/95 backdrop-blur-3xl text-white select-none animate-in fade-in duration-75"
    >
      {/* Top Header Bar */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shadow-inner">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black tracking-wide uppercase text-white">
                HabiTrack Voice Mode
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/15 border border-sky-500/30 text-sky-300">
                LIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
              <span>{activeAstronautId ?? "ASTRO-01"}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Compass className="w-3 h-3 text-sky-400" />
                {selectedCompartment}
              </span>
            </p>
          </div>
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active SI Model Badge */}
          <button
            type="button"
            onClick={() => {
              const nextMode = aiModelMode === "frontier" ? "local" : "frontier";
              setAiModelMode(nextMode);
              if (nextMode === "local" && localModelStatus !== "ready") {
                loadLocalModel();
              }
            }}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
              aiModelMode === "local"
                ? "bg-emerald-950/40 border-emerald-800 text-emerald-300 hover:bg-emerald-900/40"
                : "bg-sky-950/40 border-sky-800 text-sky-300 hover:bg-sky-900/40"
            }`}
            title="Toggle between Frontier Cloud and Local WebGPU"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                aiModelMode === "local" ? "bg-emerald-400 animate-pulse" : "bg-sky-400 animate-pulse"
              }`}
            />
            <span className="hidden sm:inline">
              {aiModelMode === "frontier" ? "Frontier (Gemini)" : "Local (Llama 3.2)"}
            </span>
          </button>

          {/* Quick Voice Speed Toggle */}
          <button
            type="button"
            onClick={() => {
              const nextRate = voiceRate <= 1.05 ? 1.2 : voiceRate <= 1.25 ? 1.4 : 1.0;
              setVoiceRate(nextRate);
            }}
            className="px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 text-xs font-mono text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Cycle Voice Synthesis Speed (1.0x, 1.2x, 1.4x)"
          >
            <Gauge className="w-3.5 h-3.5 text-sky-400" />
            <span>{voiceRate.toFixed(1)}x</span>
          </button>

          {/* Quindar Comms Toggle */}
          <button
            type="button"
            onClick={() => setQuindarBeepsEnabled(!quindarBeepsEnabled)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
              quindarBeepsEnabled
                ? "bg-slate-800/80 border-slate-700 text-sky-300 shadow-xs"
                : "bg-slate-900/40 border-slate-800 text-slate-500 hover:text-slate-300"
            }`}
            title="Toggle Apollo/ISS Quindar Comms Beeps"
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Quindar Beeps</span>
          </button>

          {/* Close Modal */}
          <button
            type="button"
            onClick={closeVoiceModal}
            className="flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            title="Exit Voice Mode (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Central Visualizer & Reactive Orb */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-xl mx-auto w-full my-4 text-center">
        {/* Quick Voice Persona Switcher - Clean Typography Without Emojis */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-900/90 border border-slate-800/90 backdrop-blur-md mb-6 shadow-inner">
          {[
            { id: "nova", label: "Nova", desc: "Warm" },
            { id: "orion", label: "Orion", desc: "Calm" },
            { id: "athena", label: "Athena", desc: "Precise" },
            { id: "capcom", label: "Capcom", desc: "Radio" },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setVoicePersona(p.id as any);
                setSelectedVoiceName(null);
                speakMessage("voice-switch", `Switched to ${p.label} voice.`);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer flex items-center gap-1.5 ${
                voicePersona === p.id
                  ? "bg-sky-600 text-white font-black shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/70"
              }`}
            >
              <span>{p.label}</span>
              <span
                className={`text-[10px] font-mono opacity-65 ${
                  voicePersona === p.id ? "text-sky-100 font-bold" : "text-slate-500"
                }`}
              >
                {p.desc}
              </span>
            </button>
          ))}
        </div>

        {/* Animated Concentric Orb Container */}
        <div
          onClick={handleOrbClick}
          className="relative flex items-center justify-center w-52 h-52 sm:w-64 sm:h-64 cursor-pointer group"
          title={isSpeaking ? "Tap to interrupt SI speech" : "Tap to mute / resume microphone"}
        >
          {/* Outer Pulsing Glow Wave 2 */}
          <div
            className={`absolute inset-0 rounded-full transition-transform duration-100 ease-out pointer-events-none opacity-20 blur-xl ${
              voiceStatus === "listening"
                ? "bg-sky-400"
                : voiceStatus === "thinking"
                ? "bg-sky-500 animate-pulse"
                : voiceStatus === "speaking"
                ? "bg-emerald-400 animate-pulse"
                : "bg-slate-700"
            }`}
            style={{
              transform: `scale(${voiceStatus === "listening" ? ringScale2 : 1.1})`,
            }}
          />

          {/* Outer Pulsing Wave 1 */}
          <div
            className={`absolute inset-0 rounded-full transition-transform duration-100 ease-out pointer-events-none opacity-30 blur-md border border-white/20 ${
              voiceStatus === "listening"
                ? "bg-gradient-to-tr from-sky-500/30 to-cyan-400/30"
                : voiceStatus === "thinking"
                ? "bg-gradient-to-tr from-sky-600/30 to-blue-500/30"
                : voiceStatus === "speaking"
                ? "bg-gradient-to-tr from-emerald-500/40 to-teal-400/40"
                : "bg-slate-800/40"
            }`}
            style={{
              transform: `scale(${voiceStatus === "listening" ? ringScale1 : 1.05})`,
            }}
          />

          {/* Radar Sweep Ring while Thinking */}
          {voiceStatus === "thinking" && (
            <div className="absolute inset-2 rounded-full border-2 border-dashed border-sky-400/40 animate-spin duration-3000 pointer-events-none" />
          )}

          {/* Core Interactive Sphere */}
          <div
            className={`relative flex items-center justify-center w-36 h-36 sm:w-44 sm:h-44 rounded-full shadow-2xl transition-all duration-200 border ${
              voiceStatus === "listening"
                ? "bg-gradient-to-b from-sky-500 to-blue-600 border-sky-300/40 shadow-sky-500/30 group-hover:shadow-sky-500/50"
                : voiceStatus === "thinking"
                ? "bg-gradient-to-b from-slate-900 to-sky-950 border-sky-400/40 shadow-sky-500/30"
                : voiceStatus === "speaking"
                ? "bg-gradient-to-b from-emerald-500 to-teal-600 border-emerald-300/40 shadow-emerald-500/30 group-hover:shadow-emerald-500/50"
                : "bg-slate-800 border-slate-700 shadow-slate-900/50"
            }`}
            style={{
              transform: `scale(${voiceStatus === "listening" ? baseScale : 1.0})`,
            }}
          >
            {/* Center State Icon */}
            {voiceStatus === "listening" && (
              <div className="flex flex-col items-center gap-1.5 text-white">
                <Mic
                  className="w-8 h-8 sm:w-10 sm:h-10 transition-transform duration-100"
                  style={{ transform: `scale(${1 + energyLevel * 0.15})` }}
                />
                {/* Dynamic live audio equalizer bars */}
                <div className="flex items-center gap-1 h-3 mt-0.5">
                  {[0.5, 1.0, 0.75, 0.4].map((factor, idx) => {
                    const barHeight = Math.max(3, Math.min(12, Math.round(energyLevel * 20 * factor)));
                    return (
                      <span
                        key={idx}
                        className="w-1 rounded-full bg-white transition-all duration-75"
                        style={{ height: `${barHeight}px` }}
                      />
                    );
                  })}
                </div>
                <span className="text-[10px] font-mono tracking-wider font-bold uppercase opacity-85">
                  Listening
                </span>
              </div>
            )}

            {voiceStatus === "thinking" && (
              <div className="flex flex-col items-center gap-1.5 text-sky-400">
                <Activity className="w-8 h-8 sm:w-10 sm:h-10 animate-pulse" />
                <span className="text-[10px] font-mono tracking-wider font-bold uppercase text-sky-300">
                  Synthesizing
                </span>
              </div>
            )}

            {voiceStatus === "speaking" && (
              <div className="flex flex-col items-center gap-1.5 text-white">
                <Volume2 className="w-8 h-8 sm:w-10 sm:h-10 animate-pulse text-white" />
                <span className="text-[10px] font-mono tracking-wider font-bold uppercase text-emerald-200">
                  Speaking
                </span>
              </div>
            )}

            {voiceStatus === "idle" && (
              <div className="flex flex-col items-center gap-1.5 text-slate-400">
                <MicOff className="w-8 h-8 sm:w-10 sm:h-10" />
                <span className="text-[10px] font-mono tracking-wider font-bold uppercase">
                  Paused
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Minimalist Live Status Indicator */}
        <div className="mt-7 max-w-lg w-full min-h-[46px] flex items-center justify-center px-4">
          {voiceStatus === "listening" && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/25 text-sky-300 text-xs font-mono font-medium tracking-wide">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
              <span>Listening for voice input...</span>
            </div>
          )}

          {voiceStatus === "thinking" && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-950/80 border border-sky-500/30 text-sky-300 text-xs font-mono font-medium tracking-wide shadow-xs">
              <Activity className="w-3.5 h-3.5 animate-pulse text-sky-400" />
              <span>Correlating station telemetry &amp; flight rules...</span>
            </div>
          )}

          {voiceStatus === "speaking" && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-medium tracking-wide shadow-xs">
              <Volume2 className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
              <span>Transmitting response · Tap orb or press Space to interrupt</span>
            </div>
          )}

          {voiceStatus === "idle" && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono font-medium">
              <span>Paused · Tap orb or press Space to speak</span>
            </div>
          )}
        </div>

        {/* User Spoken Input Card ("what I taught/talked") — strictly no SI text clutter */}
        {displayedUserPrompt ? (
          <div className="mt-4 max-w-lg w-full mx-auto p-5 rounded-[28px] bg-slate-900/90 border border-slate-800/90 backdrop-blur-xl text-left shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-sky-400" />
                Crew Spoken Query
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {voiceStatus === "listening" ? "Transcribing live" : "Transcribed"}
              </span>
            </div>
            <p className="text-sm sm:text-base font-bold text-white leading-relaxed font-sans line-clamp-3">
              "{displayedUserPrompt}"
            </p>
          </div>
        ) : (
          <div className="mt-4 max-w-lg w-full mx-auto p-4 rounded-[28px] bg-slate-900/40 border border-slate-800/50 backdrop-blur-xs text-center">
            <p className="text-xs text-slate-400 font-medium">
              Speak naturally about any symptoms, compartment telemetry, or flight procedures.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Action Footer Bar */}
      <div className="w-full max-w-xl mx-auto flex items-center justify-between px-4 py-3 rounded-[24px] bg-slate-900/80 border border-slate-800/80 backdrop-blur-md shadow-lg">
        {/* Mic Mute / Unmute */}
        <button
          type="button"
          onClick={() => {
            if (micMuted) {
              setMicMuted(false);
              startListening();
            } else {
              setMicMuted(true);
              stopMicrophone();
              setVoiceStatus("idle");
            }
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            micMuted
              ? "bg-red-500/20 text-red-400 border border-red-500/40"
              : "bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
          }`}
          title="Toggle Microphone (M)"
        >
          {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-sky-400" />}
          <span>{micMuted ? "Unmute Mic" : "Mute Mic"}</span>
        </button>

        {/* Central Keyboard Hints / Continuous Active */}
        <div className="text-[11px] text-slate-400 font-mono hidden sm:flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px]">
            Space
          </span>
          <span>{isSpeaking ? "Interrupt" : "Pause / Resume"}</span>
        </div>

        {/* Barge-in / Interrupt Button if speaking, or Exit Button */}
        <div className="flex items-center gap-2">
          {isSpeaking && (
            <button
              type="button"
              onClick={stopSpeaking}
              className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Interrupt Voice</span>
            </button>
          )}

          <button
            type="button"
            onClick={closeVoiceModal}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
            title="Exit Voice Mode (Esc)"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
