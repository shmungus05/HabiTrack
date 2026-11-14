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
              className={`flex items-center gap-2 py-2 text-xs font-medium cursor-pointer transition-colors border-b-2 -mb-[1px] ${
                isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] ${
                    isActive
                      ? "bg-slate-100 text-slate-800 border border-slate-200"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
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
      className={`inline-flex items-center gap-1 rounded-lg border border-slate-200/70 bg-slate-100/80 p-1 ${className}`}
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
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors duration-150 select-none ${
              isActive
                ? "bg-white text-slate-900 border border-slate-200/90 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] ${
                  isActive
                    ? "bg-slate-100 text-slate-800 border border-slate-200"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
