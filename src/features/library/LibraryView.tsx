import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Film,
  Globe2,
  Image as ImageIcon,
  Loader2,
  Play,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { fetchLibraryGuides, searchNasaMediaLibrary } from "../../services/api";
import type { GuideCategory, LibraryGuide, NasaMediaItem } from "../../types/library";
import { GuideCard } from "./GuideCard";
import { GuideDetailModal } from "./GuideDetailModal";
import { NasaMediaModal } from "./NasaMediaModal";

interface LibraryViewProps {
  astronautId?: string;
  onNavigateToSymptoms?: (symptomCode?: string) => void;
}

type LibraryTab = "curated_procedures" | "nasa_live_search";

const CATEGORIES: Array<{ key: GuideCategory | "all"; label: string }> = [
  { key: "all", label: "All Disciplines" },
  { key: "exercise", label: "Exercise Countermeasures" },
  { key: "sleep", label: "Sleep & Circadian" },
  { key: "medical", label: "Clinical & First Aid" },
  { key: "nutrition", label: "Nutrition & Galley" },
  { key: "adaptation", label: "Space Adaptation" },
];

export function LibraryView({
  astronautId = "ASTRO-01",
  onNavigateToSymptoms,
}: LibraryViewProps) {
  const [activeTab, setActiveTab] = useState<LibraryTab>("curated_procedures");

  // Tab 1: Curated Guides State
  const [guides, setGuides] = useState<LibraryGuide[]>([]);
  const [isLoadingGuides, setIsLoadingGuides] = useState(true);
  const [activeCategory, setActiveCategory] = useState<GuideCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGuide, setSelectedGuide] = useState<LibraryGuide | null>(null);

  // Tab 2: NASA Live Search State
  const [nasaQuery, setNasaQuery] = useState("iss astronaut exercise");
  const [nasaMediaType, setNasaMediaType] = useState<"video" | "image" | "all">("all");
  const [nasaResults, setNasaResults] = useState<NasaMediaItem[]>([]);
  const [isLoadingNasa, setIsLoadingNasa] = useState(false);
  const [selectedNasaItem, setSelectedNasaItem] = useState<NasaMediaItem | null>(null);

  // Load Curated Guides
  const loadGuides = useCallback(async () => {
    setIsLoadingGuides(true);
    try {
      const data = await fetchLibraryGuides(activeCategory, searchQuery);
      setGuides(data);
    } catch (err) {
      console.error("Failed to load library guides", err);
    } finally {
      setIsLoadingGuides(false);
    }
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    loadGuides();
  }, [loadGuides]);

  // Load NASA Live Search Results
  const runNasaSearch = useCallback(
    async (q: string, type: "video" | "image" | "all") => {
      setIsLoadingNasa(true);
      try {
        const items = await searchNasaMediaLibrary(q, type);
        setNasaResults(items);
      } catch (err) {
        console.error("NASA Media Search failed", err);
      } finally {
        setIsLoadingNasa(false);
      }
    },
    []
  );

  useEffect(() => {
    if (activeTab === "nasa_live_search" && nasaResults.length === 0) {
      runNasaSearch(nasaQuery, nasaMediaType);
    }
  }, [activeTab, nasaQuery, nasaMediaType, nasaResults.length, runNasaSearch]);

  const handleNasaSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nasaQuery.trim()) {
      runNasaSearch(nasaQuery, nasaMediaType);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Top Banner (Clean Perplexity White Card, rounded-[32px]) */}
      <div className="rounded-[32px] border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold tracking-wide">
              <span>EXPEDITION 71 OPERATIONAL RESOURCE CENTER</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              Operational Library &amp; NASA Media Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              Fast, full-fidelity spaceflight resources: standardized countermeasure checklists, rapid-streaming instructional video, and direct search across the entire NASA Image &amp; Video Library.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
            <div className="px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 flex items-center gap-2">
              <span className="text-slate-400">CREW:</span>
              <span className="font-bold text-slate-900">{astronautId}</span>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>NASA CDN Direct Stream</span>
            </div>
          </div>
        </div>

        {/* Tab Switcher: Curated vs Live NASA Search */}
        <div className="flex items-center gap-2 mt-6 pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setActiveTab("curated_procedures")}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "curated_procedures"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-50 hover:bg-slate-100 text-slate-600"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Flight Procedures &amp; Countermeasures ({guides.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("nasa_live_search")}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "nasa_live_search"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-50 hover:bg-slate-100 text-slate-600"
            }`}
          >
            <Globe2 className="w-4 h-4 text-sky-500" />
            <span>Live NASA Image &amp; Video Search</span>
          </button>
        </div>
      </div>

      {/* TAB 1: CURATED PROCEDURES & COUNTERMEASURES */}
      {activeTab === "curated_procedures" && (
        <div className="space-y-6">
          {/* Search and Category Filter Toolbar */}
          <div className="space-y-3">
            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search procedures by technique, NASA document ID, or symptom code..."
                className="w-full px-5 py-3.5 pl-11 pr-10 rounded-2xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs font-medium transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-3.5 p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : null}
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-1">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setActiveCategory(cat.key)}
                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                      isActive
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Guide Cards Grid */}
          {isLoadingGuides ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-72 rounded-[28px] border border-slate-200 bg-white/60 animate-pulse"
                />
              ))}
            </div>
          ) : guides.length === 0 ? (
            <div className="p-12 text-center rounded-[32px] border border-slate-200 bg-white space-y-3">
              <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">No procedures found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No matching flight guides found for your query. Try resetting your search terms.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("all");
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {guides.map((guide) => (
                <GuideCard
                  key={guide.id}
                  guide={guide}
                  onSelect={(g) => setSelectedGuide(g)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE NASA IMAGE & VIDEO SEARCH (FULL RESOURCE) */}
      {activeTab === "nasa_live_search" && (
        <div className="space-y-6">
          <form onSubmit={handleNasaSearchSubmit} className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={nasaQuery}
                  onChange={(e) => setNasaQuery(e.target.value)}
                  placeholder="Search thousands of official NASA videos and photos (e.g. spacewalk, food, exercise, sleeping)..."
                  className="w-full px-5 py-3.5 pl-11 pr-4 rounded-2xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs font-medium"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setNasaMediaType("all");
                      runNasaSearch(nasaQuery, "all");
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      nasaMediaType === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNasaMediaType("video");
                      runNasaSearch(nasaQuery, "video");
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      nasaMediaType === "video" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
                    }`}
                  >
                    <Film className="w-3 h-3 text-sky-600" />
                    <span>Videos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNasaMediaType("image");
                      runNasaSearch(nasaQuery, "image");
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      nasaMediaType === "image" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
                    }`}
                  >
                    <ImageIcon className="w-3 h-3 text-emerald-600" />
                    <span>Photos</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoadingNasa}
                  className="px-5 py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {isLoadingNasa ? "Searching..." : "Search NASA API"}
                </button>
              </div>
            </div>

            {/* Quick Keyword Shortcuts */}
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar text-xs">
              <span className="text-slate-400 font-mono text-[11px] uppercase tracking-wider shrink-0">
                Popular:
              </span>
              {[
                "astronaut exercise",
                "space station tour",
                "spacewalk eva",
                "food in space",
                "sleeping in microgravity",
                "cupola earth view",
              ].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setNasaQuery(term);
                    runNasaSearch(term, nasaMediaType);
                  }}
                  className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>
          </form>

          {/* NASA Live Results Grid */}
          {isLoadingNasa ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-72 rounded-[28px] border border-slate-200 bg-white/60 animate-pulse"
                />
              ))}
            </div>
          ) : nasaResults.length === 0 ? (
            <div className="p-12 text-center rounded-[32px] border border-slate-200 bg-white space-y-3">
              <Globe2 className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">No NASA media found</h3>
              <p className="text-xs text-slate-500">
                Try searching for broader keywords like &ldquo;iss&rdquo; or &ldquo;astronaut&rdquo;.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {nasaResults.map((item) => (
                <div
                  key={item.nasaId}
                  onClick={() => setSelectedNasaItem(item)}
                  className="group flex flex-col justify-between rounded-[28px] border border-slate-200/90 bg-white p-5 hover:border-sky-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer shadow-xs"
                >
                  <div className="space-y-3">
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <Film className="w-8 h-8" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute top-2.5 left-2.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider backdrop-blur-sm border shadow-xs ${
                            item.mediaType === "video"
                              ? "bg-sky-50 text-sky-800 border-sky-200"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          }`}
                        >
                          {item.mediaType}
                        </span>
                      </div>
                      <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-[10px] font-mono font-bold text-white flex items-center gap-1 shadow-xs">
                        <span>{item.dateCreated}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono font-semibold text-slate-400 block truncate uppercase">
                        {item.nasaId} {item.center ? `· ${item.center}` : ""}
                      </span>
                      <h4 className="text-sm font-black text-slate-900 group-hover:text-sky-700 transition-colors tracking-tight line-clamp-2 leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-medium text-slate-500">
                      NASA Public Domain
                    </span>
                    <button
                      type="button"
                      className="px-3 py-1 rounded-xl bg-slate-50 hover:bg-sky-50 hover:text-sky-700 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <span>{item.mediaType === "video" ? "Stream Video" : "Inspect Photo"}</span>
                      {item.mediaType === "video" ? (
                        <Play className="w-3 h-3 fill-current" />
                      ) : (
                        <ImageIcon className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <GuideDetailModal
        guide={selectedGuide}
        onClose={() => setSelectedGuide(null)}
        onNavigateToSymptoms={onNavigateToSymptoms}
      />
      <NasaMediaModal
        item={selectedNasaItem}
        onClose={() => setSelectedNasaItem(null)}
      />
    </div>
  );
}
