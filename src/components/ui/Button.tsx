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
    "bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border-slate-200 hover:border-slate-300 shadow-xs",
  primary:
    "bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-medium border-slate-900 shadow-xs",
  secondary:
    "bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 border-slate-200",
  ghost:
    "bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-600 hover:text-slate-900 border-transparent",
  danger:
    "bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-700 border-red-200",
  dashed:
    "bg-white hover:bg-slate-50 text-secondary hover:text-foreground border-border border-dashed hover:border-border-strong",
  link:
    "bg-transparent text-sky-600 hover:text-sky-700 underline-offset-4 hover:underline border-transparent p-0 h-auto",
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
      className={`inline-flex items-center justify-center font-medium rounded-lg border cursor-pointer transition-all duration-200 select-none disabled:opacity-40 disabled:cursor-not-allowed ${VARIANT_STYLES[variant]} ${sizeClass} ${className}`}
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
