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
    container: "bg-surface-elevated border-border text-secondary",
    dot: "bg-muted",
  },
  accent: {
    container: "bg-accent-soft border-accent-secondary/50 text-accent-light",
    dot: "bg-accent-light",
  },
  success: {
    container: "bg-surface-elevated border-border text-foreground",
    dot: "bg-foreground",
  },
  warning: {
    container: "bg-surface-elevated border-border-strong text-foreground",
    dot: "bg-foreground",
  },
  danger: {
    container: "bg-critical/10 border-critical/25 text-critical",
    dot: "bg-critical",
  },
  investigate: {
    container: "bg-critical/10 border-critical/25 text-critical",
    dot: "bg-critical",
  },
  observe: {
    container: "bg-surface-elevated border-border-strong text-secondary",
    dot: "bg-secondary",
  },
  info: {
    container: "bg-surface-elevated border-border text-secondary",
    dot: "bg-secondary",
  },
  neutral: {
    container: "bg-surface-elevated border-border-subtle text-muted",
    dot: "bg-faint",
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
