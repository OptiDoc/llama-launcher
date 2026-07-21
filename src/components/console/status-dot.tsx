/**
 * Status dot component.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type { LlamaInstance } from "@/lib/llama-store";

function StatusDot({ status }: { status: LlamaInstance["status"] }) {
  const color =
    status === "running"
      ? "bg-emerald-500"
      : status === "starting"
        ? "bg-amber-500 animate-pulse"
        : status === "stopping"
          ? "bg-orange-500 animate-pulse"
          : status === "error"
            ? "bg-red-500"
            : "bg-muted-foreground/50";
  return <span className={cn("inline-block size-1.5 rounded-full", color)} />;
}

export { StatusDot };
