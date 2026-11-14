import React, { forwardRef } from "react";

export type ButtonVariant = "default" | "primary" | "secondary" | "ghost" | "danger" | "dashed" | "link";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  default:
    "bg-surface-elevated hover:bg-surface-subtle active:bg-surface-hover text-foreground hover:text-foreground border-border hover:border-border-strong",
  primary:
    "bg-accent-secondary hover:bg-accent-hover active:bg-accent-secondary text-white border-accent-secondary",
  secondary:
    "bg-surface-subtle hover:bg-surface-hover active:bg-surface-subtle text-foreground border-border",
  ghost:
    "bg-transparent hover:bg-surface-subtle active:bg-surface-hover text-secondary hover:text-foreground border-transparent",
  danger:
    "bg-critical/10 hover:bg-critical/20 active:bg-critical/30 text-critical hover:text-critical border-critical/25",
  dashed:
    "bg-surface-elevated hover:bg-surface-subtle text-secondary hover:text-foreground border-border border-dashed",
  link:
    "bg-transparent text-accent-light hover:text-foreground underline-offset-4 hover:underline border-transparent p-0 h-auto",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-8 px-3 text-xs gap-2",
  lg: "h-9 px-4 text-sm gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "default",
    size = "md",
    isLoading = false,
    leftIcon,
    rightIcon,
    className = "",
    disabled,
    children,
    ...props
  },
  ref,
) {
  const isLink = variant === "link";
  const sizeClass = isLink ? "" : SIZE_STYLES[size];

  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center font-medium rounded-lg border transition-colors duration-150 select-none disabled:opacity-40 disabled:cursor-not-allowed ${VARIANT_STYLES[variant]} ${sizeClass} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
});
