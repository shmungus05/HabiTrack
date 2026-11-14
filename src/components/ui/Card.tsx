import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "surface" | "elevated" | "inset";
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
}

const PADDING_MAP = {
  none: "p-0",
  sm: "p-3",
  md: "p-4 sm:p-5",
  lg: "p-6",
};

export function Card({
  variant = "surface",
  padding = "md",
  interactive = false,
  className = "",
  children,
  ...props
}: CardProps) {
  const bg =
    variant === "elevated"
      ? "bg-surface-elevated border-border-strong shadow-elevated"
      : variant === "inset"
      ? "bg-surface-subtle border-border"
      : "glass-panel";

  const hover = interactive
    ? "glass-card-hover cursor-pointer"
    : "";

  return (
    <div
      className={`rounded-xl border ${bg} ${PADDING_MAP[padding]} ${hover} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex items-center justify-between border-b border-border pb-3 mb-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`text-sm font-semibold tracking-tight text-foreground ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-xs text-muted ${className}`} {...props}>
      {children}
    </p>
  );
}
