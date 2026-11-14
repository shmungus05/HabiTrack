/**
 * Scientific Evidence Card used by both the research workspace and the
 * assistant drawer. Renders the authoritative citation metadata, excerpt, and
 * the normalized hybrid-RRF match badge with calm, readable typography.
 */

import { ArrowUpRight, BookOpen, Building2, Quote } from "lucide-react";

import { doiUrl } from "../lib/format";
import type { CitedEvidence } from "../types/api";
import { Badge } from "./ui/Badge";

interface EvidenceCardProps {
  evidence: CitedEvidence;
  compact?: boolean;
}

export function EvidenceCard({ evidence, compact = false }: EvidenceCardProps) {
  const link = doiUrl(evidence.doi_citation);
  const relevance = Math.max(0, Math.min(100, Math.round(evidence.relevance_pct)));

  return (
    <article
      className={`group rounded-xl glass-panel glass-card-hover transition-all ${
        compact ? "p-3.5" : "p-4 sm:p-5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-sky-200 bg-sky-50 text-sky-600">
            <BookOpen className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-wider text-sky-700">
              {evidence.report_identifier ?? evidence.doc_id}
            </p>
            <h4
              className={`mt-0.5 font-semibold leading-snug tracking-tight text-foreground ${
                compact ? "text-xs" : "text-sm"
              }`}
            >
              {evidence.title}
            </h4>
            <p className="mt-1 text-xs text-muted">
              {evidence.section_heading}
              {evidence.authors ? ` · ${evidence.authors}` : ""}
            </p>
          </div>
        </div>
        <Badge variant="accent" className="shrink-0">
          RRF {relevance}%
        </Badge>
      </div>

      <p
        className={`mt-3 border-l-2 border-sky-400 pl-3 text-secondary ${
          compact ? "text-xs leading-relaxed" : "text-xs sm:text-sm leading-relaxed"
        }`}
      >
        <Quote className="mr-1 inline h-3 w-3 text-sky-600" />
        {evidence.excerpt}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5 rounded-lg glass-panel-subtle px-2.5 py-0.5 text-secondary">
          <Building2 className="h-3 w-3 text-sky-600" />
          {evidence.source_repository}
        </span>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg glass-panel-subtle px-2.5 py-0.5 text-sky-700 transition-colors hover:border-sky-300 hover:bg-sky-50 cursor-pointer"
          >
            DOI {evidence.doi_citation}
            <ArrowUpRight className="h-3 w-3" />
          </a>
        ) : (
          <span className="rounded-lg glass-panel-subtle px-2.5 py-0.5 text-secondary">
            NASA Life Sciences
          </span>
        )}
      </div>
    </article>
  );
}
