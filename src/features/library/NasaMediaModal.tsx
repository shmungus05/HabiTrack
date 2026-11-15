import { useEffect, useState } from "react";
import { ExternalLink, Film, Image as ImageIcon, Loader2, X } from "lucide-react";
import type { NasaMediaItem } from "../../types/library";
import { resolveNasaMediaDirectUrl } from "../../services/api";
import { NasaDescriptionFormatter } from "./NasaDescriptionFormatter";

interface NasaMediaModalProps {
  item: NasaMediaItem | null;
  onClose: () => void;
}

export function NasaMediaModal({ item, onClose }: NasaMediaModalProps) {
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!item) {
      setDirectUrl(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let active = true;

    resolveNasaMediaDirectUrl(item)
      .then((url) => {
        if (active) {
          setDirectUrl(url);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setDirectUrl(item.thumbnailUrl);
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [item]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!item) return null;

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
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/60">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                item.mediaType === "video"
                  ? "bg-sky-100 text-sky-800 border border-sky-200"
                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
              }`}
            >
              {item.mediaType === "video" ? (
                <Film className="w-3 h-3" />
              ) : (
                <ImageIcon className="w-3 h-3" />
              )}
              <span>NASA {item.mediaType.toUpperCase()}</span>
            </span>

            <div className="min-w-0">
              <span className="text-[11px] font-mono text-slate-500 block truncate">
                NASA ID: {item.nasaId} {item.center ? `· Center: ${item.center}` : ""} · {item.dateCreated}
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                {item.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 border border-slate-200 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media Frame */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <div className="relative aspect-video w-full rounded-2xl bg-black overflow-hidden shadow-sm border border-slate-200 flex items-center justify-center">
            {isLoading ? (
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                <span className="text-xs font-mono">Streaming asset from NASA CDN...</span>
              </div>
            ) : item.mediaType === "video" && directUrl ? (
              <video
                src={directUrl}
                poster={item.thumbnailUrl}
                controls
                autoPlay
                playsInline
                preload="metadata"
                className="w-full h-full object-contain"
              >
                Your browser does not support HTML5 video streaming.
              </video>
            ) : directUrl ? (
              <img
                src={directUrl}
                alt={item.title}
                className="w-full h-full object-contain"
              />
            ) : (
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* Metadata & Actions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-mono font-semibold">
                  {item.nasaId}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Official Public Domain Archive
                </span>
              </div>

              {directUrl ? (
                <a
                  href={directUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-sky-50 text-sky-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <span>Open Raw File</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : null}
            </div>

            <div className="p-6 rounded-[24px] bg-slate-50/80 border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                  NASA Archive Description &amp; Credits
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  Formatted HTML
                </span>
              </div>
              <NasaDescriptionFormatter rawDescription={item.description} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
