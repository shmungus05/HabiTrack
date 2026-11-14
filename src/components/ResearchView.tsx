/**
 * Research workspace: debounced free-text literature search over the embedded
 * NASA HRR/OSDR corpus, rendered as Scientific Evidence Cards with normalized
 * hybrid-RRF match badges.
 * Calm, clean research surface with comfortable reading typography.
 */

import { AlertTriangle, Loader2, Search, Sparkles, Telescope } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { EvidenceCard } from "./EvidenceCard";
import { queryAssistant } from "../services/api";
import type { AssistantResponse } from "../types/api";
import { Badge, Button } from "./ui";
import { NasaDatasetsCatalog } from "../features/datasets";

const EXAMPLE_QUERIES = [
  "cabin CO2 headache physiological susceptibility",
  "space radiation cardiovascular biomarkers",
  "bed rest autonomic deconditioning",
  "circadian misalignment sleep loss",
];

interface ResearchViewProps {
  astronautId: string;
}

export function ResearchView({ astronautId }: ResearchViewProps) {
  const [queryText, setQueryText] = useState("");
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);

  const runSearch = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length < 3) {
        setResult(null);
        setIsLoading(false);
        return;
      }
      const current = ++sequence.current;
      setIsLoading(true);
      setError(null);
      try {
        const response = await queryAssistant(trimmed, 5, astronautId);
        if (current !== sequence.current) {
          return;
        }
        setResult(response);
      } catch (caught) {
        if (current !== sequence.current) {
          return;
        }
        setError(
          caught instanceof Error ? caught.message : "Unable to search the literature.",
        );
      } finally {
        if (current === sequence.current) {
          setIsLoading(false);
        }
      }
    },
    [astronautId],
  );

  useEffect(() => {
    const trimmed = queryText.trim();
    if (trimmed.length < 3) {
      sequence.current += 1;
      setResult(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void runSearch(trimmed);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [queryText, runSearch]);

  const chooseExample = (example: string) => {
    setQueryText(example);
  };

  const evidence = result?.cited_evidence ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Research Workspace
          </h2>
          <p className="mt-1 text-xs text-muted">
            Hybrid BM25 + dense cosine retrieval over NASA HRR / OSDR passages.
          </p>
        </div>
        <Badge variant="accent">
          <Sparkles className="h-3.5 w-3.5" />
          Reciprocal Rank Fusion
        </Badge>
      </div>

      <div className="rounded-xl glass-panel p-4 sm:p-5">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-subtle px-3.5 py-2.5 transition-colors focus-within:border-sky-500 focus-within:bg-white">
          <Search className="h-4 w-4 shrink-0 text-sky-600" />
          <input
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            placeholder="Ask the NASA biomedical literature, e.g. cabin CO₂ and headache susceptibility…"
            className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted"
            aria-label="Research query"
          />
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-600" />
          ) : (
            <span className="shrink-0 text-[11px] text-muted font-mono">
              debounce 500 ms
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted mr-1">
            Try:
          </span>
          {EXAMPLE_QUERIES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => chooseExample(example)}
              className="rounded-lg glass-panel-subtle px-2.5 py-1 text-xs text-secondary transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 cursor-pointer"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          {error}
        </div>
      ) : null}

      {!queryText.trim() ? (
        <div className="rounded-xl glass-panel flex flex-col items-center justify-center gap-3 p-12 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-sky-200 bg-sky-50 text-sky-600">
            <Telescope className="h-5 w-5" />
          </span>
          <h3 className="text-sm font-semibold text-foreground">
            Explore the mission evidence base
          </h3>
          <p className="max-w-md text-xs leading-relaxed text-muted">
            Every answer is grounded in checked-in literature chunks and returns
            authoritative identifiers, section headings, and DOI links. Results are
            ranked by reciprocal rank fusion; percentages are calibrated relevance scores.
          </p>
        </div>
      ) : null}

      {isLoading && !result ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="glass-panel rounded-xl h-40 animate-pulse" />
          ))}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <article className="rounded-xl glass-panel p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={result.mode === "OLLAMA_GENERATIVE" ? "success" : "accent"}
                >
                  {result.mode === "OLLAMA_GENERATIVE"
                    ? "Ollama Generative"
                    : "Extractive Fallback"}
                </Badge>
                <Badge variant="default">{evidence.length} passages</Badge>
                {result.tripwire_triggered ? (
                  <Badge variant="danger">Guardrail tripwire</Badge>
                ) : null}
              </div>
              <span className="text-xs text-sky-700 font-mono">
                {result.latency_ms.toFixed(1)} ms
              </span>
            </div>
            <h3 className="mt-3.5 text-base font-semibold tracking-tight text-foreground">
              {result.headline}
            </h3>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-secondary">
              {result.scientific_context}
            </p>
            {result.study_caveats.length ? (
              <ul className="mt-3.5 space-y-1.5">
                {result.study_caveats.map((caveat) => (
                  <li
                    key={caveat}
                    className="flex items-start gap-2 text-xs leading-relaxed text-muted"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                    {caveat}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>

          <div className="grid gap-3 xl:grid-cols-2">
            {evidence.map((item) => (
              <EvidenceCard key={item.chunk_id} evidence={item} />
            ))}
          </div>

          <div className="rounded-xl glass-panel-subtle p-4 text-xs leading-relaxed text-muted">
            {result.disclaimer}
          </div>
        </div>
      ) : null}

      <NasaDatasetsCatalog className="mt-6" />
    </div>
  );
}
