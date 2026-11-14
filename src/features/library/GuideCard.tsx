import { CheckCircle2, Clock, ExternalLink, Play, ShieldAlert } from "lucide-react";
import type { LibraryGuide } from "../../types/library";

interface GuideCardProps {
  guide: LibraryGuide;
  onSelect: (guide: LibraryGuide) => void;
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  exercise: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-200",
  },
  sleep: {
    bg: "bg-indigo-50",
    text: "text-indigo-800",
    border: "border-indigo-200",
  },
  medical: {
    bg: "bg-rose-50",
    text: "text-rose-800",
    border: "border-rose-200",
  },
  nutrition: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
  },
  adaptation: {
    bg: "bg-sky-50",
    text: "text-sky-800",
    border: "border-sky-200",
  },
};

export function GuideCard({ guide, onSelect }: GuideCardProps) {
  const catStyle = CATEGORY_STYLES[guide.category] ?? {
    bg: "bg-slate-100",
    text: "text-slate-800",
    border: "border-slate-200",
  };

  const hasFlightRule = guide.safetyNotices.some(
    (n) => n.level === "FLIGHT_RULE" || n.level === "WARNING"
  );

  return (
    <div
      onClick={() => onSelect(guide)}
      className="group flex flex-col justify-between rounded-[28px] border border-slate-200/90 bg-white p-5 sm:p-6 hover:border-sky-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer shadow-xs"
    >
      <div className="space-y-4">
        {/* Authentic NASA Media Poster Frame */}
        {guide.thumbnailUrl ? (
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80">
            <img
              src={guide.thumbnailUrl}
              alt={guide.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-2.5 left-2.5">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider backdrop-blur-sm border shadow-xs ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
              >
                {guide.category}
              </span>
            </div>
            <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-[10px] font-mono font-bold text-white flex items-center gap-1 shadow-xs">
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>{guide.durationMinutes} min</span>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          {/* Document ID */}
          <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
            <span className="font-semibold uppercase tracking-wider text-slate-400">REF:</span>
            <span className="text-sky-700 font-bold">{guide.nasaDocumentId}</span>
          </div>

          {/* Title */}
          <h3 className="text-base font-black text-slate-900 group-hover:text-sky-700 transition-colors tracking-tight leading-snug">
            {guide.title}
          </h3>

          {/* Summary */}
          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
            {guide.summary}
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-[11px]">
          {hasFlightRule ? (
            <span className="flex items-center gap-1 text-amber-700 font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              <span>Safety Rule Pinned</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>NASA Verified</span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(guide);
          }}
          className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-sky-50 hover:text-sky-700 border border-slate-200/80 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>Watch Video</span>
          <Play className="w-3 h-3 fill-current" />
        </button>
      </div>
    </div>
  );
}
