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
      const triage = evaluateContextualTriage(query, currentSnapshot);
      const modName = triage.detectedModule?.name ?? "General Station Bay";

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
      className={`p-4 sm:p-6 bg-surface rounded-lg border border-border flex flex-col h-[680px] ${className}`}
    >
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-elevated border border-border flex items-center justify-center">
            <Bot className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Clinical AI Diagnostic Chatbot</h3>
            <p className="text-xs text-muted">Context-aware 5-factor triage &amp; lag evaluation</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-muted bg-surface-elevated px-3 py-1.5 rounded-md border border-border">
          <span>CO₂: {currentSnapshot.co2Ppm} PPM</span>
          <span>·</span>
          <span>Temp: {currentSnapshot.tempC} °C</span>
          <span>·</span>
          <span>Rad: {currentSnapshot.radiationRateMGy} mGy/d</span>
        </div>
      </div>

      {/* Suggestion Prompts */}
      <div className="py-3 flex flex-wrap gap-2 shrink-0">
        {suggestions.map((sug) => (
          <button
            key={sug}
            onClick={() => handleSend(sug)}
            className="px-3 py-1 rounded-md text-[11px] font-medium bg-surface-elevated hover:bg-surface-subtle text-secondary hover:text-foreground border border-border transition-colors cursor-pointer"
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
                  ? "bg-surface-subtle text-foreground border border-border-strong"
                  : "bg-surface-elevated text-secondary border border-border"
              }`}
            >
              {m.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
              className={`max-w-[82%] p-4 rounded-lg text-xs space-y-2.5 ${
                m.sender === "user"
                  ? "bg-surface-subtle text-foreground border border-border-strong rounded-tr-none"
                  : "bg-surface-elevated border border-border text-foreground rounded-tl-none"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-muted font-mono pb-1 border-b border-border">
                <span>{m.sender === "user" ? "Astronaut" : "Flight Medical Officer AI"}</span>
                <span>{m.timestamp}</span>
              </div>

              <p className="whitespace-pre-line leading-relaxed">{m.content}</p>

              {/* Countermeasure Recommendations */}
              {m.countermeasures && m.countermeasures.length > 0 && (
                <div className="pt-2 border-t border-border space-y-1">
                  <span className="font-medium text-muted uppercase text-[10px] tracking-[0.14em] block">
                    Recommended Actions:
                  </span>
                  <ul className="space-y-1">
                    {m.countermeasures.map((cm, idx) => (
                      <li key={idx} className="flex items-center gap-1.5 text-secondary text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-secondary shrink-0" />
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
          <div className="flex items-center gap-2 text-xs text-muted font-mono pl-11">
            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
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
        className="pt-3 border-t border-border flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe symptoms, discomfort, or compartment location..."
          className="flex-1 px-4 py-2.5 rounded-lg bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-accent-light"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="px-4 py-2.5 rounded-lg bg-accent-secondary hover:bg-accent-hover disabled:opacity-40 text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Report</span>
        </button>
      </form>
    </div>
  );
};
