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
      className={`relative flex flex-col justify-between rounded-lg border p-4 sm:p-5 transition-colors ${
        warn
          ? "border-border-strong bg-surface-elevated"
          : "border-border bg-surface hover:border-border-strong"
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {icon && (
              <span className="grid h-6 w-6 place-items-center rounded-md border border-border bg-surface-elevated text-secondary">
                {icon}
              </span>
            )}
            <span className="text-xs font-medium text-muted">
              {label}
            </span>
          </div>
          {warn && (
            <Badge variant="warning" dot>
              Alert
            </Badge>
          )}
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-semibold tracking-tight text-foreground">
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
              ? "text-foreground"
              : isUp
              ? "text-foreground"
              : "text-secondary"
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
        <span className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted">
          {streamName}
        </span>
      )}
    </div>
  );
}
