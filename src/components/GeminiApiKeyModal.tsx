/**
 * src/components/GeminiApiKeyModal.tsx: Onboard Gemini 2.5 Flash API Key & Diagnostics
 *
 * Minimalist Perplexity-styled modal allowing crew & flight surgeons to view,
 * configure, test, and persist their Google Gemini API key with live diagnostics.
 */

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  getGeminiApiKey,
  setGeminiApiKey,
  testGeminiApiKey,
} from "../services/ai/geminiClient";

interface GeminiApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GeminiApiKeyModal: React.FC<GeminiApiKeyModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const existing = getGeminiApiKey() || "";
      setApiKeyInput(existing);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestKey = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testGeminiApiKey(apiKeyInput);
      setTestResult(res);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Connection failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    setGeminiApiKey(apiKeyInput);
    onClose();
  };

  const handleClear = () => {
    setApiKeyInput("");
    setGeminiApiKey("");
    setTestResult({
      success: true,
      message: "API key cleared. System reverted to autonomous Mastra standby mode.",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in-50 duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-[32px] border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900">
                Gemini 2.5 Flash Engine
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Client-Side Browser Execution &amp; Multi-Turn Chat
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Callout */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-500">Active Engine:</span>
            {apiKeyInput ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100/70 text-emerald-800 font-semibold border border-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Gemini 2.5 Flash Generative AI
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100/70 text-amber-800 font-semibold border border-amber-300">
                <Radio className="w-3 h-3 text-amber-600" />
                Autonomous Mastra Standby (Offline)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            HabiTrack executes directly in your browser with zero backend latency. Providing your Google Gemini API key enables fluent multi-turn conversations, adaptive clinical reasoning, and rich dialogue like ChatGPT.
          </p>
        </div>

        {/* Input & Form */}
        <div className="space-y-3">
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
            Google Gemini API Key
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <input
              type={showKey ? "text" : "password"}
              value={apiKeyInput}
              onChange={(e) => {
                setApiKeyInput(e.target.value);
                setTestResult(null);
              }}
              placeholder="Paste your Gemini API key (starts with AIzaSy...)"
              className="w-full pl-10 pr-12 py-3 rounded-2xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-sm font-mono text-slate-900 bg-white shadow-2xs outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
              title={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Keys are securely stored in your local browser storage.</span>
            {apiKeyInput && (
              <button
                type="button"
                onClick={handleClear}
                className="text-red-600 hover:text-red-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                Clear Key
              </button>
            )}
          </div>
        </div>

        {/* Test Result Message */}
        {testResult && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-medium flex items-start gap-2.5 ${
              testResult.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <X className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{testResult.message}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={!apiKeyInput.trim() || isTesting}
            onClick={handleTestKey}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                Testing Key...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                Test Connection
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Apply &amp; Save
          </button>
        </div>
      </div>
    </div>
  );
};
