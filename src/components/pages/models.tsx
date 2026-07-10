"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Boxes,
  Plus,
  Download,
  CheckCircle2,
  HardDrive,
  Cpu,
  Sparkles,
  FolderOpen,
} from "lucide-react";
import { useLlamaStore, type LlamaModel } from "@/lib/llama-store";

const CARD_COLORS = ["green", "orange", "blue", "pink", "purple"] as const;

function FamilyBadge({ family }: { family: string }) {
  const tone: Record<string, string> = {
    llama3: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    qwen2: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
    mistral: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    phi3: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    gemma2: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    deepseek: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  };
  return (
    <Badge
      variant="secondary"
      className={cn("text-[10px] font-semibold", tone[family] ?? "bg-muted text-muted-foreground")}
    >
      {family}
    </Badge>
  );
}

function ModelCard({ model, index }: { model: LlamaModel; index: number }) {
  const downloadModel = useLlamaStore((s) => s.downloadModel);
  const color = CARD_COLORS[index % CARD_COLORS.length];
  const [progress, setProgress] = React.useState(0);
  const [downloading, setDownloading] = React.useState(false);

  const startDownload = () => {
    if (model.downloaded || downloading) return;
    setDownloading(true);
    setProgress(8);
    const tick = () => {
      setProgress((p) => {
        const next = p + Math.max(4, (100 - p) * 0.18);
        if (next >= 100) {
          downloadModel(model.id);
          setDownloading(false);
          return 100;
        }
        setTimeout(tick, 220);
        return next;
      });
    };
    setTimeout(tick, 220);
  };

  return (
    <Card className={cn("overflow-hidden border-0 shadow-sm", `card-${color}`)}>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-white/60 dark:bg-black/20">
              <Boxes className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{model.name}</h3>
              <p className="text-xs text-foreground/70">{model.sizeGb.toFixed(1)} GB</p>
            </div>
          </div>
          {model.downloaded ? (
            <Badge
              variant="secondary"
              className="gap-1 bg-emerald-500/15 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300"
            >
              <CheckCircle2 className="size-3" />
              Ready
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="bg-white/60 text-[10px] font-semibold uppercase text-muted-foreground dark:bg-black/20"
            >
              <Download className="mr-1 size-3" />
              Remote
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FamilyBadge family={model.family} />
          <Badge
            variant="secondary"
            className="bg-white/60 text-[10px] font-semibold dark:bg-black/20"
          >
            <Cpu className="mr-1 size-3" />
            {model.quant}
          </Badge>
          <Badge
            variant="secondary"
            className="bg-white/60 text-[10px] font-semibold dark:bg-black/20"
          >
            <HardDrive className="mr-1 size-3" />
            {model.sizeGb.toFixed(1)} GB
          </Badge>
        </div>

        <div className="rounded-md bg-white/40 px-2.5 py-1.5 dark:bg-black/15">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-foreground/55">
            <FolderOpen className="size-3" />
            Path
          </div>
          <p className="mt-0.5 truncate font-mono text-[11px] text-foreground/80">{model.path}</p>
        </div>

        {downloading && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-foreground/70">
              <span className="flex items-center gap-1.5">
                <Download className="size-3 animate-pulse" />
                Downloading…
              </span>
              <span className="font-mono">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5 bg-white/40 dark:bg-black/20" />
          </div>
        )}

        <div className="flex items-center gap-2">
          {model.downloaded ? (
            <Button size="sm" className="h-8 flex-1 text-xs">
              <Sparkles className="mr-1.5 size-3.5" />
              Load
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 flex-1 bg-white/60 text-xs dark:bg-black/20"
              onClick={startDownload}
              disabled={downloading}
            >
              <Download className="mr-1.5 size-3.5" />
              {downloading ? "Downloading" : "Download"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AddModelDialog() {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-1.5 size-3.5" />
          Add Model
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add a model</DialogTitle>
          <DialogDescription>
            Register a GGUF model already on disk, or paste an HF repo URL to fetch later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm text-muted-foreground">
          <p>
            This is a placeholder dialog. In the full app it would let you browse the models
            directory, scan for <code className="font-mono">.gguf</code> files, or pull from
            HuggingFace by repo id.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ModelsPage() {
  const models = useLlamaStore((s) => s.models);
  const ready = models.filter((m) => m.downloaded).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Models</h1>
          <p className="text-sm text-muted-foreground">
            Browse, download and manage GGUF model files. {ready} of {models.length} ready.
          </p>
        </div>
        <AddModelDialog />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {models.map((m, i) => (
          <ModelCard key={m.id} model={m} index={i} />
        ))}
      </div>
    </div>
  );
}
