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
        text: "text-red-700",
        border: "border-red-200",
        background: "bg-red-50",
        dot: "bg-red-600",
        hex: "#dc2626",
      };
    case "OBSERVE":
      return {
        label: "Observe",
        text: "text-amber-700",
        border: "border-amber-200",
        background: "bg-amber-50",
        dot: "bg-amber-500",
        hex: "#d97706",
      };
    default:
      return {
        label: "Info",
        text: "text-sky-700",
        border: "border-sky-200",
        background: "bg-sky-50",
        dot: "bg-sky-600",
        hex: "#0284c7",
      };
  }
}

export function uncertaintyTheme(uncertainty: UncertaintyLevel): string {
  switch (uncertainty) {
    case "LOW":
      return "text-emerald-700 border-emerald-200 bg-emerald-50";
    case "MODERATE":
      return "text-amber-700 border-amber-200 bg-amber-50";
    default:
      return "text-red-700 border-red-200 bg-red-50";
  }
}

export function parseStreamIds(streamIds: string): string[] {
  return Array.from(new Set(streamIds.match(/stream_[a-z0-9_]+/g) ?? []));
}

export function prettyStream(streamId: string): string {
  switch (streamId) {
    case "stream_eda_co2":
      return "CO₂ (PPM)";
    case "stream_eda_temp":
      return "Temperature (°C)";
    case "stream_eda_humidity":
      return "Humidity (%)";
    case "stream_eda_radiation":
      return "Radiation (mGy/day)";
    case "stream_eda_pressure":
      return "Pressure (kPa)";
    default:
      return streamId
        .replace(/^stream_/, "")
        .replace(/_/g, " ")
        .toUpperCase();
  }
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return (
    date.toLocaleString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " UTC"
  );
}

export function formatTime(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return (
    date.toLocaleTimeString("en-US", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " UTC"
  );
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
