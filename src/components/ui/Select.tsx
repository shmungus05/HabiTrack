import React, { forwardRef } from "react";

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, options, children, className = "", id, ...props },
  ref,
) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="block mb-1.5 text-xs font-medium text-muted"
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={`w-full h-9 text-xs text-foreground bg-surface border border-border rounded-lg px-3 transition-colors focus:border-accent-light focus:outline-none disabled:opacity-50 disabled:bg-canvas cursor-pointer ${
          error ? "border-critical/60 focus:border-critical" : ""
        } ${className}`}
        {...props}
      >
        {options
          ? options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                className="bg-surface text-foreground"
              >
                {opt.label}
              </option>
            ))
          : children}
      </select>
      {error && (
        <p className="mt-1 text-xs text-critical">{error}</p>
      )}
    </div>
  );
});
