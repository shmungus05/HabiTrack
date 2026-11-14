/**
 * Shared presentation helpers: severity theming, stream parsing, and timestamp
 * formatting used across the console surfaces.
 */

import type { SeverityLevel, UncertaintyLevel } from "../types/api";

export const SEVERITY_ORDER: SeverityLevel[] = ["INVESTIGATE", "OBSERVE", "INFO"];

export function severityRank(severity: SeverityLevel): number {
  return SEVERITY_ORDER.indexOf(severity);
}

export function severityTheme(severity: SeverityLevel): {
  label: string;
  text: string;
  border: string;
  background: string;
  dot: string;
  hex: string;
} {
  switch (severity) {
    case "INVESTIGATE":
      return {
        label: "Investigate",
        text: "text-critical",
        border: "border-critical/25",
        background: "bg-critical/10",
        dot: "bg-critical",
        hex: "#f87171",
      };
    case "OBSERVE":
      return {
        label: "Observe",
        text: "text-foreground",
        border: "border-border-strong",
        background: "bg-surface-elevated",
        dot: "bg-foreground",
        hex: "#d4d4d4",
      };
    default:
      return {
        label: "Info",
        text: "text-secondary",
        border: "border-border",
        background: "bg-surface-elevated",
        dot: "bg-foreground",
        hex: "#a3a3a3",
      };
  }
}

export function uncertaintyTheme(uncertainty: UncertaintyLevel): string {
  switch (uncertainty) {
    case "LOW":
      return "text-secondary border-border bg-surface-elevated";
    case "MODERATE":
      return "text-foreground border-border-strong bg-surface-elevated";
    default:
      return "text-critical border-critical/40 bg-critical/10";
  }
}

export function parseStreamIds(streamIds: string): string[] {
  return Array.from(new Set(streamIds.match(/stream_[a-z0-9_]+/g) ?? []));
}

export function prettyStream(streamId: string): string {
  return streamId
    .replace(/^stream_/, "")
    .replace(/_/g, " ")
    .toUpperCase();
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatTime(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatSigned(value: number, digits = 1): string {
  const rounded = Number(value.toFixed(digits));
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}`;
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function doiUrl(doi: string | null): string | null {
  if (!doi) {
    return null;
  }
  const trimmed = doi.trim();
  if (!trimmed) {
    return null;
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://doi.org/${trimmed}`;
}
