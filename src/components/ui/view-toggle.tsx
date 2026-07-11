"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { LayoutGrid, Table2 } from "lucide-react";
import type { ViewMode } from "@/lib/llama-store";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
  className?: string;
}

export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  return (
    <div className={cn("inline-flex h-8 items-center rounded-lg border bg-card p-0.5 shadow-soft", className)}>
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
          value === "grid"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        title="Grid view"
        aria-pressed={value === "grid"}
      >
        <LayoutGrid className="size-3.5" />
        <span className="hidden sm:inline">Grid</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("table")}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
          value === "table"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        title="Table view"
        aria-pressed={value === "table"}
      >
        <Table2 className="size-3.5" />
        <span className="hidden sm:inline">Table</span>
      </button>
    </div>
  );
}
