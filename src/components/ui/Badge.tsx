import React from "react";

export type BadgeVariant =
  | "default"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "investigate"
  | "observe"
  | "info"
  | "neutral";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
  pulse?: boolean;
}

const BADGE_VARIANTS: Record<BadgeVariant, { container: string; dot: string }> = {
  default: {
    container: "bg-slate-100/80 border-slate-200/80 text-slate-700",
    dot: "bg-slate-500",
  },
  accent: {
    container: "bg-sky-50/80 border-sky-200/80 text-sky-700",
    dot: "bg-sky-600",
  },
  success: {
    container: "bg-emerald-50/80 border-emerald-200/80 text-emerald-700",
    dot: "bg-emerald-600",
  },
  warning: {
    container: "bg-amber-50/80 border-amber-200/80 text-amber-700",
    dot: "bg-amber-500",
  },
  danger: {
    container: "bg-red-50/80 border-red-200/80 text-red-700",
    dot: "bg-red-600",
  },
  investigate: {
    container: "bg-red-50/80 border-red-200/80 text-red-700",
    dot: "bg-red-600",
  },
  observe: {
    container: "bg-amber-50/80 border-amber-200/80 text-amber-700",
    dot: "bg-amber-500",
  },
  info: {
    container: "bg-sky-50/80 border-sky-200/80 text-sky-700",
    dot: "bg-sky-600",
  },
  neutral: {
    container: "bg-slate-50 border-slate-200/80 text-slate-600",
    dot: "bg-slate-400",
  },
};

export function Badge({
  variant = "default",
  dot = false,
  pulse = false,
  className = "",
  children,
  ...props
}: BadgeProps) {
  const styles = BADGE_VARIANTS[variant] || BADGE_VARIANTS.default;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide select-none ${styles.container} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${styles.dot} ${
            pulse ? "animate-pulse" : ""
          }`}
        />
      )}
      {children}
    </span>
  );
}
