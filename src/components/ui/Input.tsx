import React, { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, leftIcon, rightIcon, className = "", id, ...props },
  ref,
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block mb-1.5 text-xs font-medium text-muted"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <span className="absolute left-3 text-muted pointer-events-none">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full h-9 text-xs text-foreground bg-surface border border-border rounded-lg placeholder:text-muted transition-colors focus:border-accent-light focus:outline-none disabled:opacity-50 disabled:bg-canvas ${
            leftIcon ? "pl-9" : "px-3"
          } ${rightIcon ? "pr-9" : "px-3"} ${
            error ? "border-critical/60 focus:border-critical" : ""
          } ${className}`}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-3 text-muted pointer-events-none">
            {rightIcon}
          </span>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs text-critical">{error}</p>
      )}
    </div>
  );
});

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className = "", id, ...props },
  ref,
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block mb-1.5 text-xs font-medium text-muted"
        >
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        className={`w-full text-xs text-foreground bg-surface border border-border rounded-lg p-3 placeholder:text-muted transition-colors focus:border-accent-light focus:outline-none disabled:opacity-50 disabled:bg-canvas resize-y ${
          error ? "border-critical/60 focus:border-critical" : ""
        } ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-critical">{error}</p>
      )}
    </div>
  );
});
