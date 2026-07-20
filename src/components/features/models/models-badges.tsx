"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle } from "lucide-react";

export const FAMILY_TONE: Record<string, string> = {
  llama3: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  llama2: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  qwen2: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  mistral: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  phi3: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  gemma2: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  deepseek: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
};

export function FamilyBadge({ family }: { family: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn("text-[10px] font-semibold", FAMILY_TONE[family] ?? "bg-muted text-muted-foreground")}
    >
      {family}
    </Badge>
  );
}

export function ArchBadge({ architecture }: { architecture: string }) {
  return (
    <Badge
      variant="secondary"
      className="bg-white/60 font-mono text-[10px] font-semibold text-foreground/70 dark:bg-black/20"
    >
      {architecture}
    </Badge>
  );
}

export function MoeBadge({ isMoe, expertCount }: { isMoe: boolean; expertCount?: number }) {
  if (isMoe) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className="bg-violet-500/15 text-[10px] font-semibold text-violet-700 dark:text-violet-300"
          >
            MoE
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Mixture of Experts — {expertCount ?? "?"} active experts</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Badge variant="secondary" className="bg-muted text-[10px] font-semibold text-muted-foreground">
      Dense
    </Badge>
  );
}

export function VramWarningBadge({ sizeGb, gpuVramGb }: { sizeGb: number; gpuVramGb: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="secondary"
          className="gap-1 bg-amber-500/15 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
        >
          <AlertTriangle className="size-3" /> VRAM
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        Model size ({sizeGb} GB) exceeds GPU VRAM ({gpuVramGb} GB). May require CPU offloading or fail to load.
      </TooltipContent>
    </Tooltip>
  );
}
