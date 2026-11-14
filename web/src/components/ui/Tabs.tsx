import React from "react";

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface TabsProps {
  items: readonly TabItem[] | TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  variant?: "underline" | "segmented";
  className?: string;
}

export function Tabs({
  items,
  activeId,
  onChange,
  variant = "segmented",
  className = "",
}: TabsProps) {
  if (variant === "underline") {
    return (
      <div
        className={`flex items-center gap-6 border-b border-border ${className}`}
        role="tablist"
      >
        {items.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 py-2 text-xs font-medium transition-colors border-b-2 -mb-[1px] ${
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted hover:text-secondary"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="rounded bg-surface-subtle px-1.5 py-0.5 text-[10px] text-secondary">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1 ${className}`}
      role="tablist"
    >
      {items.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150 select-none ${
              isActive
                ? "bg-surface-subtle text-foreground border border-border-strong"
                : "text-muted hover:text-foreground hover:bg-surface-elevated border border-transparent"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-secondary">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
