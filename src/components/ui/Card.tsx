import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "surface" | "elevated" | "inset";
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  radius?: "section" | "module" | "default" | "sm";
  interactive?: boolean;
}

const PADDING_MAP = {
  none: "p-0",
  sm: "p-3",
  md: "p-4 sm:p-5",
  lg: "p-6",
  xl: "p-6 sm:p-8",
};

const RADIUS_MAP = {
  section: "rounded-[32px]",
  module: "rounded-2xl",
  default: "rounded-2xl",
  sm: "rounded-xl",
};

export function Card({
  variant = "surface",
  padding = "md",
  radius = "default",
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
    ? "glass-card-hover cursor-pointer hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200"
    : "";

  return (
    <div
      className={`${RADIUS_MAP[radius]} border ${bg} ${PADDING_MAP[padding]} ${hover} ${className}`}
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
