import React from "react";

export interface StatusDotProps {
  status?: "online" | "offline" | "calibrated" | "calibrating" | "warn" | "error";
  pulse?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  online: "bg-emerald-500",
  offline: "bg-slate-400",
  calibrated: "bg-emerald-500",
  calibrating: "bg-amber-500",
  warn: "bg-amber-500",
  error: "bg-red-600",
};

export function StatusDot({
  status = "online",
  pulse = false,
  size = "sm",
  className = "",
}: StatusDotProps) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.online;
  const dimension = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";

  return (
    <span
      className={`inline-block rounded-full ${dimension} ${color} ${
        pulse ? "animate-pulse" : ""
      } ${className}`}
    />
  );
}
