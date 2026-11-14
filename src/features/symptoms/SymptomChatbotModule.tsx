/**
 * Isolated Component: 5-Factor Contextual Symptom Diagnostic Chatbot
 * Perplexity minimalist styling:
 * - font-semibold uppercase headers
 * - rounded-lg containers
 * - generous whitespace & micro-animations
 * - 100% preservation of suggestion prompts and multi-factor decision logic
 */

import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  User,
  Send,
  Sparkles,
  AlertTriangle,
  Clock,
  Compass,
  CheckCircle2,
  Activity,
  Wind,
  Droplets,
  Flame,
  Radio,
} from "lucide-react";
import { detectLocationFromText, evaluateContextualTriage } from "../triage/ContextualTriageAdapter";
import type { EnvironmentalSnapshot } from "../risk/ClinicalRiskModule";

interface MessageItem {
  id: string;
  sender: "ai" | "user";
  timestamp: string;
  content: string;
  location?: string;
  snapshot?: EnvironmentalSnapshot;
  countermeasures?: string[];
  lagWindow?: string;
}

interface SymptomChatbotModuleProps {
  currentSnapshot?: EnvironmentalSnapshot;
  onLogSymptom?: (symptomText: string, location: string) => void;
  className?: string;
}

export const SymptomChatbotModule: React.FC<SymptomChatbotModuleProps> = ({
  currentSnapshot = {
    co2Ppm: 3197,
    tempC: 22.8,
    humidityPct: 43.9,
    radiationRateMGy: 0.20,
    pressureMmHg: 758.2,
  },
  onLogSymptom,
  className = "",
}) => {
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "msg-0",
      sender: "ai",
      timestamp: "Just now",
      content:
        "Greetings Astronaut. I am your onboard **AI Flight Medical Decision Support System**.\n\nI continuously monitor your health against all **5 spacecraft environmental factors**: Carbon Dioxide (ppCO₂), Space Radiation, Ambient Temperature, Relative Humidity, and Cabin Pressure.\n\nDescribe any symptoms or discomfort you are experiencing in orbit.",
      snapshot: currentSnapshot,
    },
  ]);

  const [input, setInput] = useState("");
  const [selectedModule, setSelectedModule] = useState("Auto-Detect");
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const suggestions = [
    "🩺 Run a full 5-factor environmental health check",
    "I have a throbbing headache in Node 2",
    "My eyes are dry, stinging, and irritated in Columbus",
    "Overheating and heavy sweating after workout in US Lab",
    "Feeling dizzy and lightheaded upon waking up in crew quarters",
  ];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = (text: string) => {
    const query = text.trim();
    if (!query) return;

    const userMsg: MessageItem = {
      id: `usr-${Date.now()}`,
      sender: "user",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      content: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const hasExplicitLoc = Boolean(detectLocationFromText(query));
      const evalInput =
        !hasExplicitLoc && selectedModule !== "Auto-Detect"
          ? `${query} (${selectedModule})`
          : query;
      const triage = evaluateContextualTriage(evalInput, currentSnapshot);
      const modName =
        triage.detectedModule?.name ??
        (selectedModule !== "Auto-Detect" ? selectedModule : "General Station Bay");

      let responseContent = `Evaluated report against current environmental telemetry in **${modName}**.\n\n`;
      if (triage.potentialDelayedCausality) {
        responseContent += `⚠️ **Physiological Causality Flag**: ${triage.potentialDelayedCausality.rationale}\n\n`;
        responseContent += `⏱️ **Biological Latency Lag**: Expected onset peak is **${triage.potentialDelayedCausality.lagWindow}** (${triage.potentialDelayedCausality.confidenceMatch}).`;
      } else {
        responseContent += `Environmental parameters are within acceptable margins. Vitals remain concordant with circadian baselines.`;
      }

      const aiMsg: MessageItem = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        content: responseContent,
        location: modName,
        snapshot: currentSnapshot,
        countermeasures: triage.countermeasures,
        lagWindow: triage.potentialDelayedCausality?.lagWindow,
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
      onLogSymptom?.(query, modName);
    }, 600);
  };

  return (
    <div
      className={`p-5 sm:p-6 glass-panel rounded-xl flex flex-col h-[680px] ${className}`}
    >
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center">
            <Bot className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">Clinical AI Diagnostic Chatbot</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Sparkles className="w-3 h-3" />
                5-Factor
              </span>
            </div>
            <p className="text-xs text-muted">Context-aware 5-factor triage &amp; biological lag evaluation</p>
          </div>
        </div>

        {/* 5-Channel Top Telemetry Banner */}
        <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-mono glass-panel-subtle px-3 py-2 rounded-xl">
          <span className="inline-flex items-center gap-1 text-[#0284c7]">
            <Wind className="w-3 h-3" />
            CO₂ {currentSnapshot.co2Ppm} PPM
          </span>
          <span className="text-border-strong">·</span>
          <span className="inline-flex items-center gap-1 text-[#ea580c]">
            <Flame className="w-3 h-3" />
            {currentSnapshot.tempC}°C
          </span>
          <span className="text-border-strong">·</span>
          <span className="inline-flex items-center gap-1 text-[#0891b2]">
            <Droplets className="w-3 h-3" />
            {currentSnapshot.humidityPct}%
          </span>
          <span className="text-border-strong">·</span>
          <span className="inline-flex items-center gap-1 text-[#d97706]">
            <Radio className="w-3 h-3" />
            {currentSnapshot.radiationRateMGy} mGy/d
          </span>
          <span className="text-border-strong">·</span>
          <span className="inline-flex items-center gap-1 text-[#059669]">
            <Activity className="w-3 h-3" />
            {currentSnapshot.pressureMmHg} mmHg
          </span>
        </div>
      </div>

      {/* Suggestion Prompts */}
      <div className="py-3 flex flex-wrap gap-2 shrink-0">
        {suggestions.map((sug) => (
          <button
            key={sug}
            onClick={() => handleSend(sug)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-medium glass-panel-subtle hover:border-sky-300 hover:bg-sky-50 text-secondary hover:text-sky-700 transition-colors cursor-pointer"
          >
            {sug}
          </button>
        ))}
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-3 ${m.sender === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold ${
                m.sender === "user"
                  ? "bg-sky-50 text-sky-700 border border-sky-200"
                  : "glass-panel-subtle text-sky-600"
              }`}
            >
              {m.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
              className={`max-w-[84%] p-4 rounded-xl text-xs space-y-2.5 ${
                m.sender === "user"
                  ? "bg-sky-50 text-foreground border border-sky-200 rounded-tr-none"
                  : "glass-panel-subtle text-foreground rounded-tl-none"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted font-mono pb-1.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className={m.sender === "ai" ? "text-sky-700 font-semibold" : "text-foreground font-semibold"}>
                    {m.sender === "user" ? "Astronaut" : "Flight Medical Officer AI"}
                  </span>
                  {m.location && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-secondary border border-border">
                      <Compass className="w-3 h-3 text-sky-600" />
                      {m.location}
                    </span>
                  )}
                </div>
                <span>{m.timestamp}</span>
              </div>

              <p className="whitespace-pre-line leading-relaxed">{m.content}</p>

              {/* Embedded 5-Factor Environmental Scorecard */}
              {m.sender === "ai" && m.snapshot && (
                <div className="p-2.5 rounded-lg bg-white border border-border space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-muted">
                    <span className="uppercase tracking-wider">5-Factor Telemetry Snapshot</span>
                    {m.lagWindow && (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <Clock className="w-3 h-3" />
                        {m.lagWindow}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[11px] font-mono">
                    <div className="px-2 py-1 rounded bg-surface-subtle border border-border-subtle">
                      <span className="text-muted block">CO₂</span>
                      <span className="text-[#0284c7] font-semibold">{m.snapshot.co2Ppm} ppm</span>
                    </div>
                    <div className="px-2 py-1 rounded bg-surface-subtle border border-border-subtle">
                      <span className="text-muted block">Radiation</span>
                      <span className="text-[#d97706] font-semibold">{m.snapshot.radiationRateMGy} mGy</span>
                    </div>
                    <div className="px-2 py-1 rounded bg-surface-subtle border border-border-subtle">
                      <span className="text-muted block">Temp</span>
                      <span className="text-[#ea580c] font-semibold">{m.snapshot.tempC} °C</span>
                    </div>
                    <div className="px-2 py-1 rounded bg-surface-subtle border border-border-subtle">
                      <span className="text-muted block">Humidity</span>
                      <span className="text-[#0891b2] font-semibold">{m.snapshot.humidityPct}%</span>
                    </div>
                    <div className="px-2 py-1 rounded bg-surface-subtle border border-border-subtle col-span-2 sm:col-span-1">
                      <span className="text-muted block">Pressure</span>
                      <span className="text-[#059669] font-semibold">{m.snapshot.pressureMmHg}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Countermeasure Recommendations */}
              {m.countermeasures && m.countermeasures.length > 0 && (
                <div className="pt-2 border-t border-border space-y-1.5">
                  <span className="font-medium text-sky-700 uppercase text-[11px] tracking-[0.14em] flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Recommended Actions:
                  </span>
                  <ul className="space-y-1">
                    {m.countermeasures.map((cm, idx) => (
                      <li key={idx} className="flex items-center gap-1.5 text-secondary text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{cm}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-sky-700 font-mono pl-11">
            <div className="w-2 h-2 rounded-full bg-sky-600 animate-pulse" />
            <span>Evaluating multi-factor environmental telemetry...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className="pt-3 border-t border-border flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0"
      >
        <div className="flex items-center gap-1.5 sm:w-48">
          <Compass className="w-4 h-4 text-sky-600 shrink-0" />
          <select
            aria-label="Compartment Location"
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-white border border-border text-foreground text-xs focus:outline-none focus:border-sky-600 cursor-pointer"
          >
            <option value="Auto-Detect" className="bg-white text-foreground">Module: Auto-Detect</option>
            <option value="Node 2 Harmony" className="bg-white text-foreground">Node 2 Harmony</option>
            <option value="Destiny US Lab" className="bg-white text-foreground">US Lab Destiny</option>
            <option value="Columbus" className="bg-white text-foreground">Columbus Lab</option>
            <option value="Kibo JEM" className="bg-white text-foreground">Kibo JEM</option>
            <option value="Unity Node 1" className="bg-white text-foreground">Node 1 Unity</option>
            <option value="Cupola" className="bg-white text-foreground">Cupola</option>
          </select>
        </div>

        <div className="flex flex-1 items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe symptoms, discomfort, or compartment location..."
            className="flex-1 px-4 py-2.5 rounded-lg bg-white border border-border text-foreground text-xs focus:outline-none focus:border-sky-600"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Report</span>
          </button>
        </div>
      </form>
    </div>
  );
};
