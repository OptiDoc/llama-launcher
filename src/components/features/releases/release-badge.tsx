"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, Info } from "lucide-react";
import { RELEASE_VARIANTS, type ReleaseVariant } from "@/lib/llama-store";

// ---------- Variant metadata ----------

const VARIANT_STYLE: Record<ReleaseVariant, { badge: string; dot: string }> = {
  cuda12: { badge: "bg-primary/15 text-primary dark:text-primary/80", dot: "bg-primary" },
  cuda13: { badge: "bg-purple-500/15 text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
  vulkan: { badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  cpu: { badge: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300", dot: "bg-zinc-500" },
  hip: { badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  opencl: { badge: "bg-teal-500/15 text-teal-700 dark:text-teal-300", dot: "bg-teal-500" },
  metal: { badge: "bg-slate-500/15 text-slate-700 dark:text-slate-300", dot: "bg-slate-500" },
};

export const VARIANT_LABEL = Object.fromEntries(RELEASE_VARIANTS.map((v) => [v.id, v.label] as const)) as Record<
  ReleaseVariant,
  string
>;

export const VARIANT_NOTE = Object.fromEntries(RELEASE_VARIANTS.map((v) => [v.id, v.note] as const)) as Record<
  ReleaseVariant,
  string
>;

export const CUDA_NOTE = "CUDA libraries will be auto-copied to the build directory after download.";

export function isCuda(v: ReleaseVariant): boolean {
  return v === "cuda12" || v === "cuda13";
}

export function variantOrder(v: ReleaseVariant): number {
  const i = RELEASE_VARIANTS.findIndex((r) => r.id === v);
  return i === -1 ? 99 : i;
}

export function shortCommit(c: string): string {
  return c.length > 7 ? c.slice(0, 7) : c;
}

// ---------- Shared badges ----------

export function InstalledBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 bg-emerald-500/15 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300",
        className,
      )}
    >
      <CheckCircle2 className="size-3" />
      Installed
    </Badge>
  );
}

export function VariantBadge({ variant, withCudaNote = false }: { variant: ReleaseVariant; withCudaNote?: boolean }) {
  const s = VARIANT_STYLE[variant];
  const inner = (
    <Badge variant="secondary" className={cn("gap-1 text-[10px] font-semibold uppercase", s.badge)}>
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {VARIANT_LABEL[variant]}
      {withCudaNote && isCuda(variant) && <Info className="size-3 opacity-70" />}
    </Badge>
  );
  if (withCudaNote && isCuda(variant)) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help">{inner}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[240px] text-xs font-normal">{CUDA_NOTE}</TooltipContent>
      </Tooltip>
    );
  }
  return inner;
}
