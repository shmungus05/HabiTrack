import React from "react";
import { Film, Play, BookOpen, Clock, ShieldCheck, ChevronRight } from "lucide-react";
import type { SpaceCareResourceReference } from "../types/api";

interface WatchableResourceCardProps {
  resource: SpaceCareResourceReference;
  onWatch: (resource: SpaceCareResourceReference) => void;
}

export const WatchableResourceCard: React.FC<WatchableResourceCardProps> = ({
  resource,
  onWatch,
}) => {
  return (
    <div className="group relative flex flex-col sm:flex-row gap-4 p-4 rounded-[24px] bg-white border border-slate-200/90 shadow-xs hover:shadow-md hover:border-sky-300 transition-all duration-300">
      {/* Thumbnail with Video Play Overlay */}
      <div
        onClick={() => onWatch(resource)}
        className="relative w-full sm:w-44 h-28 sm:h-auto rounded-2xl overflow-hidden bg-slate-900 cursor-pointer shrink-0 group/thumb"
      >
        {resource.thumbnailUrl ? (
          <img
            src={resource.thumbnailUrl}
            alt={resource.title}
            className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-500 opacity-90 group-hover/thumb:opacity-100"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-sky-400">
            <Film className="w-8 h-8 opacity-70" />
          </div>
        )}

        {/* Video Overlay Badge */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/35 group-hover/thumb:bg-black/20 transition-colors">
          <div className="w-10 h-10 rounded-full bg-white/95 text-sky-600 flex items-center justify-center shadow-lg group-hover/thumb:scale-110 group-hover/thumb:bg-sky-500 group-hover/thumb:text-white transition-all duration-200">
            <Play className="w-4 h-4 ml-0.5 fill-current" />
          </div>
        </div>

        {/* Duration Pill */}
        {resource.durationMinutes && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-xs text-[11px] font-mono font-medium text-white flex items-center gap-1">
            <Clock className="w-3 h-3 text-sky-400" />
            <span>{resource.durationMinutes}m</span>
          </div>
        )}
      </div>

      {/* Card Content & Metadata */}
      <div className="flex-1 flex flex-col justify-between min-w-0">
        <div>
          {/* Header Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-wider uppercase bg-sky-50 text-sky-700 border border-sky-200/60">
              <BookOpen className="w-3 h-3" />
              {resource.sourceDocId}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Verified NASA HRP
            </span>
          </div>

          {/* Title */}
          <h4
            onClick={() => onWatch(resource)}
            className="text-sm font-black text-slate-900 leading-snug line-clamp-1 hover:text-sky-600 cursor-pointer transition-colors"
          >
            {resource.title}
          </h4>

          {/* Description */}
          <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {resource.description}
          </p>
        </div>

        {/* Chapters & Watch Button Footer */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          {/* Chapter Preview Chips */}
          {resource.chapters && resource.chapters.length > 0 ? (
            <div className="flex items-center gap-1.5 overflow-hidden text-[11px] text-slate-500 font-mono">
              <span className="text-slate-400 shrink-0">Chapters:</span>
              <span className="truncate max-w-[200px] sm:max-w-[240px]">
                {resource.chapters.slice(0, 2).map((c) => c.title).join(" · ")}
                {resource.chapters.length > 2 ? ` +${resource.chapters.length - 2} more` : ""}
              </span>
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 italic">
              {resource.sourceName}
            </div>
          )}

          {/* Action CTA */}
          <button
            type="button"
            onClick={() => onWatch(resource)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 active:scale-97 shadow-xs hover:shadow-sky-200 transition-all cursor-pointer ml-auto shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Watch Guide</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-70" />
          </button>
        </div>
      </div>
    </div>
  );
};
