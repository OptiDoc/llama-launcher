"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertCircle, Boxes, CheckCircle2, Copy, Cpu, Database, Download,
  FolderOpen, HardDrive, Loader2, Plus, Sparkles, XCircle,
} from "lucide-react";
import {
  useLlamaStore, type HFDownload, type LlamaModel,
  HF_POPULAR_REPOS, HF_QUANTS,
} from "@/lib/llama-store";

const CARD_COLORS = ["green", "orange", "blue", "pink", "purple"] as const;

const FAMILY_TONE: Record<string, string> = {
  llama3: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  qwen2: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  mistral: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  phi3: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  gemma2: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  deepseek: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
};

function FamilyBadge({ family }: { family: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-[10px] font-semibold",
        FAMILY_TONE[family] ?? "bg-muted text-muted-foreground",
      )}
    >
      {family}
    </Badge>
  );
}

function deriveModelName(repo: string): string {
  const slug = repo.split("/")[1] ?? repo;
  const base = slug
    .replace(/[-_]GGUF$/i, "")
    .replace(/[-_]Instruct$/i, "")
    .replace(/[_-]/g, " ")
    .trim();
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

function ModelCard({
  model,
  index,
  onDownload,
}: {
  model: LlamaModel;
  index: number;
  onDownload: (model: LlamaModel) => void;
}) {
  const color = CARD_COLORS[index % CARD_COLORS.length];
  const [copied, setCopied] = React.useState(false);

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(model.path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Card className={cn("overflow-hidden border-0 shadow-soft", `card-${color}`)}>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/60 dark:bg-black/20">
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
              className="shrink-0 gap-1 bg-emerald-500/15 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300"
            >
              <CheckCircle2 className="size-3" />
              Ready
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="shrink-0 gap-1 bg-white/60 text-[10px] font-semibold uppercase text-muted-foreground dark:bg-black/20"
            >
              <AlertCircle className="size-3" />
              Missing
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FamilyBadge family={model.family} />
          {([
            [Cpu, model.quant],
            [HardDrive, `${model.sizeGb.toFixed(1)} GB`],
          ] as const).map(([Icon, text], i) => (
            <Badge key={i} variant="secondary" className="bg-white/60 text-[10px] font-semibold dark:bg-black/20">
              <Icon className="mr-1 size-3" />
              {text}
            </Badge>
          ))}
        </div>

        <div className="rounded-md bg-white/40 px-2.5 py-1.5 dark:bg-black/15">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-foreground/55">
              <FolderOpen className="size-3" />
              Path
            </div>
            <Button
              variant="ghost" size="icon"
              className="size-5 text-foreground/55 hover:text-foreground"
              onClick={copyPath} aria-label="Copy path"
            >
              {copied ? <CheckCircle2 className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
            </Button>
          </div>
          <p className="mt-0.5 truncate font-mono text-[11px] text-foreground/80">{model.path}</p>
        </div>

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
              onClick={() => onDownload(model)}
            >
              <Download className="mr-1.5 size-3.5" />
              Download
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ActiveDownloadsPanel({ downloads }: { downloads: HFDownload[] }) {
  const active = downloads.filter((d) => d.status !== "completed");
  if (active.length === 0) return null;
  return (
    <Card className="border-0 bg-white shadow-soft dark:bg-zinc-900/60">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Download className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Active downloads</h2>
          <Badge variant="secondary" className="text-[10px]">{active.length}</Badge>
        </div>
        <div className="space-y-3">
          {active.map((d) => (
            <div key={d.id} className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Database className="size-3.5 shrink-0 text-foreground/60" />
                  <span className="truncate text-xs font-medium">{d.repo}</span>
                  <Badge variant="secondary" className="shrink-0 text-[10px] font-semibold">
                    {d.quant}
                  </Badge>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-[11px] text-foreground/70">
                  {d.status === "failed" ? (
                    <span className="flex items-center gap-1 text-destructive">
                      <XCircle className="size-3.5" /> Failed
                    </span>
                  ) : d.status === "queued" ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="size-3.5 animate-spin" /> Queued
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Loader2 className="size-3.5 animate-spin" />
                      <span className="font-mono">{Math.round(d.progress)}%</span>
                    </span>
                  )}
                  <span className="font-mono">{d.sizeGb.toFixed(1)} GB</span>
                </div>
              </div>
              <p className="mt-1.5 truncate font-mono text-[10px] text-foreground/55">{d.filename}</p>
              <Progress value={d.progress} className="mt-2 h-1.5" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface HFDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillRepo?: string;
  prefillModelName?: string;
}

function HFDownloadDialog({ open, onOpenChange, prefillRepo, prefillModelName }: HFDialogProps) {
  const startHFDownload = useLlamaStore((s) => s.startHFDownload);

  const [selectedPopular, setSelectedPopular] = React.useState<string>("");
  const [repo, setRepo] = React.useState<string>("");
  const [quant, setQuant] = React.useState<string>("Q4_K_M");
  const [modelName, setModelName] = React.useState<string>("");

  // Initialize / reset state whenever the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    const initialRepo = prefillRepo ?? HF_POPULAR_REPOS[0].repo;
    const isPopular = HF_POPULAR_REPOS.some((r) => r.repo === initialRepo);
    setSelectedPopular(isPopular ? initialRepo : "custom");
    setRepo(initialRepo);
    setQuant("Q4_K_M");
    setModelName(prefillModelName ?? deriveModelName(initialRepo));
  }, [open]);

  const popularInfo = HF_POPULAR_REPOS.find((r) => r.repo === repo);
  const baseSizeGb = popularInfo?.baseSizeGb ?? 8;
  const quantInfo = HF_QUANTS.find((q) => q.id === quant);
  const estimatedGb = React.useMemo(
    () => Math.round(baseSizeGb * (quantInfo?.sizeFactor ?? 0.6) * 10) / 10,
    [baseSizeGb, quantInfo],
  );
  const filename = `${repo.split("/")[1] ?? repo}-${quant}.gguf`;
  const canStart = repo.trim().length > 0 && modelName.trim().length > 0 && !!quantInfo;

  const handlePopularChange = (value: string) => {
    setSelectedPopular(value);
    if (value === "custom") {
      setRepo("");
      return;
    }
    setRepo(value);
    setModelName(deriveModelName(value));
  };

  const handleSubmit = () => {
    if (!canStart) return;
    startHFDownload({ repo: repo.trim(), quant, modelName: modelName.trim() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-4 text-primary" />
            Download from HuggingFace
          </DialogTitle>
          <DialogDescription>
            Pull a GGUF checkpoint from the HuggingFace Hub and register it in your models directory.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[80vh] space-y-5 overflow-y-auto pr-1">
          {/* Repository */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-foreground/70">
              Repository
            </Label>
            <Select value={selectedPopular} onValueChange={handlePopularChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a popular repo…" />
              </SelectTrigger>
              <SelectContent>
                {HF_POPULAR_REPOS.map((r) => (
                  <SelectItem key={r.repo} value={r.repo}>
                    <span className="font-mono text-xs">{r.repo}</span>
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom repo…</SelectItem>
              </SelectContent>
            </Select>
            {popularInfo ? (
              <p className="text-xs text-muted-foreground">{popularInfo.description}</p>
            ) : selectedPopular === "custom" ? (
              <p className="text-xs text-muted-foreground">
                Enter any HuggingFace GGUF repo id (e.g. <span className="font-mono">user/model-GGUF</span>).
              </p>
            ) : null}
            <Input
              value={repo}
              onChange={(e) => {
                setRepo(e.target.value);
                if (selectedPopular !== "custom") setSelectedPopular("custom");
              }}
              placeholder="user/model-GGUF"
              className="font-mono text-xs"
            />
          </div>

          <Separator />

          {/* Quantization */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-foreground/70">
              Quantization
            </Label>
            <RadioGroup value={quant} onValueChange={setQuant} className="gap-2">
              {HF_QUANTS.map((q) => {
                const sizeGb = Math.round(baseSizeGb * q.sizeFactor * 10) / 10;
                return (
                  <Label
                    key={q.id}
                    htmlFor={`quant-${q.id}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                      quant === q.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40",
                    )}
                  >
                    <RadioGroupItem value={q.id} id={`quant-${q.id}`} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">{q.label}</span>
                        <span className="shrink-0 font-mono text-[11px] text-foreground/70">
                          ~{sizeGb.toFixed(1)} GB
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{q.note}</p>
                    </div>
                  </Label>
                );
              })}
            </RadioGroup>
          </div>

          <Separator />

          {/* Model name */}
          <div className="space-y-2">
            <Label htmlFor="hf-model-name" className="text-xs font-medium uppercase tracking-wide text-foreground/70">
              Model name
            </Label>
            <Input
              id="hf-model-name"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g. Llama 3.1 8B"
            />
            <p className="text-xs text-muted-foreground">
              Used as the display name in the model grid.
            </p>
          </div>

          {/* Summary */}
          <div className="rounded-lg border border-border/70 bg-muted/40 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Estimated size</span>
              <span className="font-mono font-semibold">{estimatedGb.toFixed(1)} GB</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Destination</span>
              <span className="truncate font-mono text-[11px]">/models/{filename}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canStart}>
            <Download className="mr-1.5 size-3.5" />
            Start download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddLocalDialog() {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-1.5 size-3.5" />
          Add Local
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="size-4 text-primary" />
            Register a local model
          </DialogTitle>
          <DialogDescription>
            Point LlamaLauncher at a GGUF file already on disk. The file is not copied.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="local-name" className="text-xs">Display name</Label>
            <Input id="local-name" placeholder="e.g. My custom 7B" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="local-path" className="text-xs">Path to .gguf</Label>
            <Input id="local-path" placeholder="/data/models/custom.gguf" className="font-mono text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="local-family" className="text-xs">Family</Label>
              <Select defaultValue="llama3">
                <SelectTrigger id="local-family" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(FAMILY_TONE).map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="local-quant" className="text-xs">Quant</Label>
              <Select defaultValue="Q4_K_M">
                <SelectTrigger id="local-quant" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HF_QUANTS.map((q) => (
                    <SelectItem key={q.id} value={q.id}>{q.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Local registration is a preview — files are validated on first launch.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>
            <CheckCircle2 className="mr-1.5 size-3.5" />
            Register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ModelsPage() {
  const models = useLlamaStore((s) => s.models);
  const downloads = useLlamaStore((s) => s.downloads);

  const ready = React.useMemo(() => models.filter((m) => m.downloaded).length, [models]);

  const [hfOpen, setHfOpen] = React.useState(false);
  const [prefillRepo, setPrefillRepo] = React.useState<string | undefined>(undefined);
  const [prefillModelName, setPrefillModelName] = React.useState<string | undefined>(undefined);

  const openHF = React.useCallback(() => {
    setPrefillRepo(undefined);
    setPrefillModelName(undefined);
    setHfOpen(true);
  }, []);

  const openHFForModel = React.useCallback((model: LlamaModel) => {
    setPrefillRepo(model.hfRepo);
    setPrefillModelName(model.name);
    setHfOpen(true);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Models</h1>
          <p className="text-sm text-muted-foreground">
            Browse, download and manage GGUF model files. {ready} of {models.length} ready.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={openHF}>
            <Download className="mr-1.5 size-3.5" />
            Download from HF
          </Button>
          <AddLocalDialog />
        </div>
      </div>

      <ActiveDownloadsPanel downloads={downloads} />

      {models.length === 0 ? (
        <Card className="border-dashed border-2 border-border bg-transparent shadow-none">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <Boxes className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium">No models yet.</p>
              <p className="text-xs text-muted-foreground">
                Download from HuggingFace to get started.
              </p>
            </div>
            <Button size="sm" onClick={openHF}>
              <Download className="mr-1.5 size-3.5" />
              Download from HF
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {models.map((m, i) => (
            <ModelCard key={m.id} model={m} index={i} onDownload={openHFForModel} />
          ))}
        </div>
      )}

      <HFDownloadDialog
        open={hfOpen}
        onOpenChange={setHfOpen}
        prefillRepo={prefillRepo}
        prefillModelName={prefillModelName}
      />
    </div>
  );
}
