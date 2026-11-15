import React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Badge } from "./Badge";

export interface MetricCardProps {
  label: string;
  value: string | number;
  unit: string;
  baseline: string | number;
  delta: number;
  formatDelta: (delta: number, unit?: string) => string;
  warn?: boolean;
  icon?: React.ReactNode;
  sparkline?: React.ReactNode;
  streamName?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  baseline,
  delta,
  formatDelta,
  warn = false,
  icon,
  sparkline,
  streamName,
}: MetricCardProps) {
  const isZero = delta === 0;
  const isUp = delta > 0;

  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl glass-panel glass-card-hover shadow-2xs p-4 sm:p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs ${
        warn
          ? "border-amber-200/90 bg-amber-50/40"
          : "border-slate-200/90 bg-white"
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {icon && (
              <span className="grid h-7 w-7 place-items-center rounded-lg border border-border bg-surface-subtle text-sky-600">
                {icon}
              </span>
            )}
            <span className="text-xs font-medium text-muted">
              {label}
            </span>
          </div>
          {warn && (
            <Badge variant="warning" dot>
              Elevated
            </Badge>
          )}
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {value}
          </span>
          <span className="text-xs text-muted">
            {unit}
          </span>
        </div>
      </div>

      {sparkline && <div className="my-3">{sparkline}</div>}

      <div className="flex items-center justify-between border-t border-border-subtle pt-2.5 text-xs">
        <span className="text-muted">
          μ {baseline} {unit}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 font-medium ${
            isZero
              ? "text-muted"
              : warn
              ? "text-amber-700"
              : isUp
              ? "text-sky-700"
              : "text-emerald-700"
          }`}
        >
          {!isZero &&
            (isUp ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            ))}
          {formatDelta(delta, unit)}
        </span>
      </div>

      {streamName && (
        <span className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted">
          {streamName}
        </span>
      )}
    </div>
  );
}
