"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLlamaStore, fmtBytes } from "@/lib/llama-store";
import type { LlamaModel } from "@/lib/llama-store";
import { FamilyBadge, ArchBadge, MoeBadge, VramWarningBadge } from "./models-badges";
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  Cpu,
  Download,
  Loader2,
  Pencil,
  Sparkles,
  XCircle,
  XSquare,
} from "lucide-react";

export const CARD_COLORS = ["green", "orange", "blue", "pink", "purple"] as const;

export interface CardActions {
  onSelect: (m: LlamaModel) => void;
  onEdit: (m: LlamaModel) => void;
  onDownload: (m: LlamaModel) => void;
  onLoad: (m: LlamaModel) => void;
}

export function ModelCard({
  model,
  index,
  actions,
  gpuVramGb,
}: {
  model: LlamaModel;
  index: number;
  actions: CardActions;
  gpuVramGb: number;
}) {
  const color = CARD_COLORS[index % CARD_COLORS.length];
  const isMissing = model.missing;
  const isReady = model.downloaded && !isMissing;
  const isDownloading = model.downloading === true;
  const progress = Math.round(model.downloadProgress ?? 0);
  const overVram = gpuVramGb > 0 && model.sizeGb > gpuVramGb;

  const interactive = !isDownloading;

  return (
    <Card
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? () => actions.onSelect(model) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                actions.onSelect(model);
              }
            }
          : undefined
      }
      className={cn(
        "group overflow-hidden p-0 shadow-none transition-all duration-200",
        interactive
          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lifted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          : "cursor-default",
        `card-${color}`,
        isMissing && "grayscale opacity-60",
      )}
    >
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/60 dark:bg-black/20">
              <Boxes className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{model.name}</h3>
              <p className="text-xs text-foreground/70">{fmtBytes(model.sizeGb)}</p>
            </div>
          </div>
          {isDownloading ? (
            <Badge
              variant="secondary"
              className="shrink-0 gap-1 bg-amber-500/15 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300"
            >
              <Loader2 className="size-3 animate-spin" /> Downloading
            </Badge>
          ) : isReady ? (
            <Badge
              variant="secondary"
              className="shrink-0 gap-1 bg-emerald-500/15 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300"
            >
              <CheckCircle2 className="size-3" /> Ready
            </Badge>
          ) : isMissing ? (
            <Badge
              variant="secondary"
              className="shrink-0 gap-1 bg-red-500/15 text-[10px] font-semibold uppercase text-red-700 dark:text-red-300"
            >
              <XCircle className="size-3" /> Not found
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="shrink-0 gap-1 bg-white/60 text-[10px] font-semibold uppercase text-muted-foreground dark:bg-black/20"
            >
              <AlertCircle className="size-3" /> Missing
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="bg-white/60 text-[10px] font-semibold dark:bg-black/20">
            {model.builder}
          </Badge>
          <FamilyBadge family={model.family} />
          <ArchBadge architecture={model.architecture} />
          <MoeBadge isMoe={model.isMoe} expertCount={model.expertCount} />
          <Badge variant="secondary" className="gap-1 bg-white/60 text-[10px] font-semibold dark:bg-black/20">
            <Cpu className="size-3" /> {model.quant}
          </Badge>
          {overVram && <VramWarningBadge sizeGb={model.sizeGb} gpuVramGb={gpuVramGb} />}
        </div>

        {isDownloading ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1 text-foreground/70">
                <Download className="size-3" /> Downloading…
              </span>
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-200 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <button
              onClick={() => useLlamaStore.getState().cancelDownload(model.downloadId ?? "")}
              className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-600 transition-colors"
            >
              <XSquare className="size-3" /> Cancel download
            </button>
          </div>
        ) : isMissing ? (
          <div className="rounded-md border border-red-300/50 bg-red-500/5 px-2.5 py-1.5 text-[11px] text-red-700 dark:text-red-300">
            <p className="font-medium">File not found at:</p>
            <p className="mt-0.5 truncate font-mono text-[10px] opacity-80">{model.path}</p>
            <p className="mt-1">Want to update the path?</p>
          </div>
        ) : null}

        {interactive && (
          <div className="flex items-center gap-2">
            {isReady ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.onLoad(model);
                    }}
                  >
                    <Sparkles className="mr-1.5 size-3.5" /> Load
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Launch instance with this model</TooltipContent>
              </Tooltip>
            ) : isMissing ? (
              <Button
                size="sm"
                variant="secondary"
                className="flex-1 bg-white/60 dark:bg-black/20"
                onClick={(e) => {
                  e.stopPropagation();
                  actions.onEdit(model);
                }}
              >
                <Pencil className="mr-1.5 size-3.5" /> Edit
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                className="flex-1 bg-white/60 dark:bg-black/20"
                onClick={(e) => {
                  e.stopPropagation();
                  actions.onDownload(model);
                }}
              >
                <Download className="mr-1.5 size-3.5" /> Download
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
