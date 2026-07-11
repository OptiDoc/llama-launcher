"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1 text-sm", className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {item.onClick && !isLast ? (
              <button
                type="button"
                onClick={item.onClick}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </button>
            ) : (
              <span className={cn(isLast ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {item.label}
              </span>
            )}
            {!isLast && <ChevronRight className="size-3.5 text-muted-foreground/60" />}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
