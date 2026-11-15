import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  ExternalLink,
  Play,
  RotateCcw,
  ShieldAlert,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { LibraryGuide } from "../../types/library";

interface GuideDetailModalProps {
  guide: LibraryGuide | null;
  onClose: () => void;
  onNavigateToSymptoms?: (symptomCode?: string) => void;
}

export function GuideDetailModal({
  guide,
  onClose,
  onNavigateToSymptoms,
}: GuideDetailModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    setActiveChapterIndex(0);
    setCompletedSteps(new Set());
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [guide]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!guide) return null;

  const toggleStep = (index: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleAudioGuidance = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const textToSpeak = `${guide.title}. Reference: ${guide.nasaDocumentId}. Action steps: ${guide.instructions.join(". ")}`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleChapterClick = (idx: number, seconds: number) => {
    setActiveChapterIndex(idx);
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      void videoRef.current.play();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-[32px] border border-slate-200/90 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/60">
          <div className="flex items-center gap-3 min-w-0">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-200">
              {guide.category}
            </span>
            <div className="min-w-0">
              <span className="text-[11px] font-mono text-slate-500 block truncate">
                REF: {guide.nasaDocumentId} · {guide.sourceRepository}
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                {guide.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleAudioGuidance}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                isSpeaking
                  ? "bg-amber-100 text-amber-900 border-amber-300"
                  : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
              }`}
              title="Read procedural steps aloud"
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-amber-700" />
                  <span>Stop Audio</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-sky-600" />
                  <span>Audio Guidance</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 border border-slate-200 transition-colors cursor-pointer"
              aria-label="Close procedure modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* Native HTML5 Video Stream & Chapter Deck */}
          <div className="space-y-3">
            <div className="relative aspect-video w-full rounded-2xl bg-black overflow-hidden shadow-sm border border-slate-200">
              <video
                ref={videoRef}
                src={guide.mediaUrl}
                poster={guide.thumbnailUrl}
                controls
                playsInline
                preload="metadata"
                onPlay={() => {
                  if (typeof window !== "undefined" && "speechSynthesis" in window) {
                    window.speechSynthesis.cancel();
                    setIsSpeaking(false);
                  }
                }}
                className="w-full h-full object-contain"
              >
                Your browser does not support the video tag.
              </video>
            </div>

            {/* Direct Link & Chapter Scrub Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
                <span className="text-[11px] font-mono text-slate-500 font-bold px-1 shrink-0 uppercase">
                  Chapters:
                </span>
                {guide.chapters.map((ch, idx) => {
                  const isActive = activeChapterIndex === idx;
                  return (
                    <button
                      key={ch.time}
                      type="button"
                      onClick={() => handleChapterClick(idx, ch.seconds)}
                      className={`px-3 py-1 rounded-lg text-xs font-mono whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 border ${
                        isActive
                          ? "bg-sky-600 text-white font-bold border-sky-600 shadow-2xs"
                          : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      <Play className="w-2.5 h-2.5" />
                      <span>{ch.time}</span>
                      <span className="opacity-80">· {ch.title}</span>
                    </button>
                  );
                })}
              </div>

              <a
                href={guide.mediaUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[11px] font-bold text-sky-700 hover:underline flex items-center gap-1 shrink-0 px-2"
                title="Direct NASA Media CDN Stream"
              >
                <span>NASA Video Asset</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Action Checklist & Safety Information */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Action Checklist (7 cols) */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-sky-600" />
                  <span>Execution Checklist</span>
                </h3>
                <span className="text-[11px] font-mono text-slate-500">
                  {completedSteps.size} of {guide.instructions.length} completed
                </span>
              </div>

              <div className="space-y-2">
                {guide.instructions.map((ins, idx) => {
                  const isDone = completedSteps.has(idx);
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleStep(idx)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                        isDone
                          ? "bg-emerald-50/60 border-emerald-200 opacity-80"
                          : "bg-white border-slate-200/90 hover:border-slate-300"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStep(idx);
                        }}
                        className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                          isDone
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-slate-300 bg-slate-50 text-transparent"
                        }`}
                        aria-label={`Step ${idx + 1}`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block mb-0.5">
                          Step {idx + 1}
                        </span>
                        <p
                          className={`text-xs leading-relaxed ${
                            isDone ? "text-slate-400 line-through" : "text-slate-800"
                          }`}
                        >
                          {ins}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Flight Rule & Safety Precautions (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>Flight Surgeon Safety Precautions</span>
                </h3>

                <div className="space-y-2.5">
                  {guide.safetyNotices.map((notice, nIdx) => (
                    <div
                      key={nIdx}
                      className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs text-amber-900 leading-relaxed space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-200/80 text-amber-900 border border-amber-300">
                          {notice.level}
                        </span>
                        {notice.ruleId ? (
                          <span className="text-[11px] font-mono font-bold text-amber-800">
                            RULE: {notice.ruleId}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] pt-1 text-amber-950">{notice.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Related Symptoms Link */}
              {guide.relatedSymptomCodes && guide.relatedSymptomCodes.length > 0 && onNavigateToSymptoms ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                    Associated Symptoms
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {guide.relatedSymptomCodes.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateToSymptoms(code);
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-white hover:bg-slate-100 text-sky-700 border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>Log {code}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
