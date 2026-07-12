"use client";

import * as React from "react";
import { cn, hashStr } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ViewToggle } from "@/components/ui/view-toggle";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  BarChart, Bar, XAxis, ResponsiveContainer, Tooltip as RTooltip,
} from "recharts";
import {
  AlertCircle, AlertTriangle, ArrowLeft, Boxes, CheckCircle2, Copy, Cpu,
  Download, Edit3, ExternalLink, FileText, FolderOpen, HardDrive,
  Loader2, Pencil, Play, Search, Sparkles, Tag, Trash2, XCircle,
} from "lucide-react";
import {
  useLlamaStore, searchHFModels, HF_QUANTS,
  fmtBytes, fmtNum,
  type HFSearchResult, type LlamaModel, type ViewMode,
} from "@/lib/llama-store";

const CARD_COLORS = ["green", "orange", "blue", "pink", "purple"] as const;
const VIEW_STORAGE_KEY = "ll-models-view";

const FAMILY_TONE: Record<string, string> = {
  llama3: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  llama2: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  qwen2: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  mistral: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  phi3: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  gemma2: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  deepseek: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
};

// ---------- helpers ----------

function FamilyBadge({ family }: { family: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn("text-[10px] font-semibold", FAMILY_TONE[family] ?? "bg-muted text-muted-foreground")}
    >
      {family}
    </Badge>
  );
}

/** Architecture badge — neutral/secondary, monospace (e.g. llama, qwen2, gemma2). */
function ArchBadge({ architecture }: { architecture: string }) {
  return (
    <Badge
      variant="secondary"
      className="bg-white/60 font-mono text-[10px] font-semibold text-foreground/70 dark:bg-black/20"
    >
      {architecture}
    </Badge>
  );
}

/** MoE / Dense badge. MoE variant is violet with a tooltip listing active experts. */
function MoeBadge({ isMoe, expertCount }: { isMoe: boolean; expertCount?: number }) {
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
    <Badge
      variant="secondary"
      className="bg-muted text-[10px] font-semibold text-muted-foreground"
    >
      Dense
    </Badge>
  );
}

/** Amber VRAM-exceed warning badge with a tooltip — shown when sizeGb > gpuVramGb. */
function VramWarningBadge({ sizeGb, gpuVramGb }: { sizeGb: number; gpuVramGb: number }) {
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

function deriveModelName(repo: string): string {
  const slug = repo.split("/")[1] ?? repo;
  const base = slug
    .replace(/[-_]GGUF$/i, "")
    .replace(/[-_]Instruct$/i, "")
    .replace(/[_-]/g, " ")
    .trim();
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Per-model usage stats. Until the backend tracks per-model history, these
 *  are all zero/empty — no fake data. */
function deriveModelStats(_modelId: string) {
  return {
    timesLoaded: 0,
    totalTokens: 0,
    avgTps: 0,
    lastUsed: "—",
    daily: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => ({ day: d, tokens: 0 })),
  };
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="ghost" size="icon"
      className={cn("size-6 text-foreground/55 hover:text-foreground", className)}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch { /* clipboard unavailable */ }
      }}
      aria-label="Copy"
    >
      {copied ? <CheckCircle2 className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
    </Button>
  );
}

// ---------- Model card / row ----------

interface CardActions {
  onSelect: (m: LlamaModel) => void;
  onEdit: (m: LlamaModel) => void;
  onDownload: (m: LlamaModel) => void;
  onLoad: (m: LlamaModel) => void;
}

function ModelCard({
  model, index, actions, gpuVramGb,
}: { model: LlamaModel; index: number; actions: CardActions; gpuVramGb: number }) {
  const color = CARD_COLORS[index % CARD_COLORS.length];
  const isMissing = model.missing;
  const isReady = model.downloaded && !isMissing;
  const isDownloading = model.downloading === true;
  const progress = Math.round(model.downloadProgress ?? 0);
  const overVram = gpuVramGb > 0 && model.sizeGb > gpuVramGb;

  // Downloading cards are not interactive — no detail navigation, no action buttons.
  const interactive = !isDownloading;

  return (
    <Card
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? () => actions.onSelect(model) : undefined}
      onKeyDown={
        interactive
          ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); actions.onSelect(model); } }
          : undefined
      }
      className={cn(
        "group overflow-hidden border-0 shadow-soft transition-all duration-200",
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
            <Badge variant="secondary" className="shrink-0 gap-1 bg-amber-500/15 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300">
              <Loader2 className="size-3 animate-spin" /> Downloading
            </Badge>
          ) : isReady ? (
            <Badge variant="secondary" className="shrink-0 gap-1 bg-emerald-500/15 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-3" /> Ready
            </Badge>
          ) : isMissing ? (
            <Badge variant="secondary" className="shrink-0 gap-1 bg-red-500/15 text-[10px] font-semibold uppercase text-red-700 dark:text-red-300">
              <XCircle className="size-3" /> Not found
            </Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0 gap-1 bg-white/60 text-[10px] font-semibold uppercase text-muted-foreground dark:bg-black/20">
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
            {/* Horizontal fill bar — emerald grows left→right with a smooth 200ms transition. */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-200 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
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
                  <Button size="sm" className="h-8 flex-1 text-xs" onClick={(e) => { e.stopPropagation(); actions.onLoad(model); }}>
                    <Sparkles className="mr-1.5 size-3.5" /> Load
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Launch instance with this model</TooltipContent>
              </Tooltip>
            ) : isMissing ? (
              <Button
                size="sm" variant="secondary"
                className="h-8 flex-1 bg-white/60 text-xs dark:bg-black/20"
                onClick={(e) => { e.stopPropagation(); actions.onEdit(model); }}
              >
                <Pencil className="mr-1.5 size-3.5" /> Edit
              </Button>
            ) : (
              <Button
                size="sm" variant="secondary"
                className="h-8 flex-1 bg-white/60 text-xs dark:bg-black/20"
                onClick={(e) => { e.stopPropagation(); actions.onDownload(model); }}
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

function StatusBadge({ model }: { model: LlamaModel }) {
  if (model.downloading === true) {
    const progress = Math.round(model.downloadProgress ?? 0);
    return (
      <Badge variant="secondary" className="gap-1 bg-amber-500/15 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300">
        <Loader2 className="size-3 animate-spin" /> {progress}%
      </Badge>
    );
  }
  if (model.missing) {
    return (
      <Badge variant="secondary" className="gap-1 bg-red-500/15 text-[10px] font-semibold uppercase text-red-700 dark:text-red-300">
        <XCircle className="size-3" /> Not found
      </Badge>
    );
  }
  if (model.downloaded) {
    return (
      <Badge variant="secondary" className="gap-1 bg-emerald-500/15 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="size-3" /> Ready
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 bg-amber-500/15 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300">
      <AlertCircle className="size-3" /> Missing
    </Badge>
  );
}

function ModelTable({
  models, actions, gpuVramGb,
}: { models: LlamaModel[]; actions: CardActions; gpuVramGb: number }) {
  return (
    <Card className="border-0 bg-white shadow-soft dark:bg-zinc-900/60">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60">
              <TableHead className="pl-4 text-xs uppercase tracking-wide text-muted-foreground">Name</TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Builder</TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Family</TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Arch</TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Type</TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Quant</TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Size</TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Status</TableHead>
              <TableHead className="pr-4 text-right text-xs uppercase tracking-wide text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((m) => {
              const isDownloading = m.downloading === true;
              const progress = Math.round(m.downloadProgress ?? 0);
              const overVram = gpuVramGb > 0 && m.sizeGb > gpuVramGb;
              return (
                <TableRow
                  key={m.id}
                  onClick={isDownloading ? undefined : () => actions.onSelect(m)}
                  className={cn(
                    isDownloading ? "cursor-default opacity-90" : "cursor-pointer",
                    m.missing && "opacity-60",
                  )}
                >
                  <TableCell className="pl-4 py-3">
                    <div className="flex items-center gap-2">
                      <Boxes className="size-4 shrink-0 text-foreground/50" />
                      <span className="text-sm font-medium">{m.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-xs text-muted-foreground">{m.builder}</TableCell>
                  <TableCell className="py-3"><FamilyBadge family={m.family} /></TableCell>
                  <TableCell className="py-3"><ArchBadge architecture={m.architecture} /></TableCell>
                  <TableCell className="py-3"><MoeBadge isMoe={m.isMoe} expertCount={m.expertCount} /></TableCell>
                  <TableCell className="py-3 text-xs font-mono text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {m.quant}
                      {overVram && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertTriangle className="size-3 text-amber-600 dark:text-amber-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Model size ({m.sizeGb} GB) exceeds GPU VRAM ({gpuVramGb} GB). May require CPU offloading or fail to load.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 text-xs text-muted-foreground">{fmtBytes(m.sizeGb)}</TableCell>
                  <TableCell className="py-3"><StatusBadge model={m} /></TableCell>
                  <TableCell className="pr-4 py-3">
                    {isDownloading ? (
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-muted/60">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-[width] duration-200 ease-linear"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">{progress}%</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        {m.downloaded && !m.missing && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7"
                                onClick={(e) => { e.stopPropagation(); actions.onLoad(m); }}>
                                <Play className="size-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Launch instance</TooltipContent>
                          </Tooltip>
                        )}
                        {!m.downloaded && !m.missing && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7"
                                onClick={(e) => { e.stopPropagation(); actions.onDownload(m); }}>
                                <Download className="size-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7"
                              onClick={(e) => { e.stopPropagation(); actions.onEdit(m); }}>
                              <Edit3 className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); actions.onEdit(m); }}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete (in edit dialog)</TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ---------- Edit dialog ----------

function EditModelDialog({
  model, open, onOpenChange, focusPath,
}: {
  model: LlamaModel | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  focusPath?: boolean;
}) {
  const updateModel = useLlamaStore((s) => s.updateModel);
  const deleteModel = useLlamaStore((s) => s.deleteModel);
  const markModelMissing = useLlamaStore((s) => s.markModelMissing);
  const locateModel = useLlamaStore((s) => s.locateModel);

  const [name, setName] = React.useState("");
  const [path, setPath] = React.useState("");
  const [builder, setBuilder] = React.useState("");
  const [quant, setQuant] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const pathRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open || !model) return;
    setName(model.name);
    setPath(model.path);
    setBuilder(model.builder);
    setQuant(model.quant);
    setDescription(model.description);
    setConfirmDelete(false);
    if (focusPath) {
      setTimeout(() => pathRef.current?.focus(), 50);
    }
  }, [open, model, focusPath]);

  if (!model) return null;

  const handleSave = () => {
    updateModel(model.id, { name: name.trim(), path: path.trim(), builder: builder.trim(), quant: quant.trim(), description });
    if (model.missing && path.trim() !== model.path) {
      locateModel(model.id, path.trim());
    }
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="size-4 text-primary" /> Edit model
            </DialogTitle>
            <DialogDescription>Update metadata, fix a moved file path, or remove this model.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="ed-name" className="text-xs">Display name</Label>
              <Input id="ed-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-path" className="text-xs">File path</Label>
              <Input
                id="ed-path" ref={pathRef}
                value={path} onChange={(e) => setPath(e.target.value)}
                className="font-mono text-xs"
              />
              {model.missing && (
                <p className="text-[11px] text-red-600 dark:text-red-400">
                  File is currently missing. Update the path to mark the model as found.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ed-builder" className="text-xs">Builder</Label>
                <Input id="ed-builder" value={builder} onChange={(e) => setBuilder(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ed-quant" className="text-xs">Quant</Label>
                <Input id="ed-quant" value={quant} onChange={(e) => setQuant(e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-desc" className="text-xs">Description</Label>
              <Textarea id="ed-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="text-xs" />
            </div>
          </div>
          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            <Button
              variant="outline" size="sm"
              className="text-destructive hover:bg-red-500/10 hover:text-destructive"
              onClick={() => markModelMissing(model.id, !model.missing)}
            >
              <AlertTriangle className="mr-1.5 size-3.5" />
              {model.missing ? "Mark as found" : "Mark as missing"}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSave}><CheckCircle2 className="mr-1.5 size-3.5" /> Save</Button>
            </div>
          </DialogFooter>
          <Separator />
          <div className="flex items-center justify-between rounded-lg border border-red-200/60 bg-red-500/5 px-3 py-2">
            <div>
              <p className="text-xs font-medium text-red-700 dark:text-red-400">Delete this model</p>
              <p className="text-[11px] text-muted-foreground">Removes it from the list. File on disk is not touched.</p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-1.5 size-3.5" /> Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{model.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the model from LlamaLauncher. The GGUF file on disk is not deleted.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteModel(model.id); setConfirmDelete(false); onOpenChange(false); }}
            >
              Delete model
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------- Launch confirm dialog (visual) ----------

function LaunchConfirmDialog({ model, open, onOpenChange }: {
  model: LlamaModel | null; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  if (!model) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="size-4 text-primary" /> Launch instance
          </DialogTitle>
          <DialogDescription>
            Start a new llama-server instance using <span className="font-medium text-foreground">{model.name}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border/70 bg-muted/40 p-3 text-xs">
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Model</span><span className="font-medium">{model.name}</span></div>
          <div className="mt-1.5 flex items-center justify-between"><span className="text-muted-foreground">Quant</span><span className="font-mono">{model.quant}</span></div>
          <div className="mt-1.5 flex items-center justify-between"><span className="text-muted-foreground">Size</span><span className="font-mono">{fmtBytes(model.sizeGb)}</span></div>
          <div className="mt-1.5 flex items-center justify-between"><span className="text-muted-foreground">Context length</span><span className="font-mono">{fmtNum(model.contextLength)}</span></div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Switch to the Instances page and click <span className="font-medium">Launch instance</span> to start serving this model.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onOpenChange(false)}><CheckCircle2 className="mr-1.5 size-3.5" /> Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- HF download dialog (search-first) ----------

interface HFDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefillRepo?: string;
  prefillModelName?: string;
}

function HFDownloadDialog({ open, onOpenChange, prefillRepo, prefillModelName }: HFDialogProps) {
  const startHFDownload = useLlamaStore((s) => s.startHFDownload);

  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<HFSearchResult[]>([]);
  const [selectedRepo, setSelectedRepo] = React.useState<HFSearchResult | null>(null);
  const [quant, setQuant] = React.useState<string>("Q4_K_M");
  const [modelName, setModelName] = React.useState<string>("");
  const [searching, setSearching] = React.useState(false);

  // Reset state whenever dialog opens. Prefill selection if a repo was passed.
  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setQuant("Q4_K_M");
    setSearching(false);
    if (prefillRepo) {
      const r = searchHFModels(prefillRepo.split("/")[1] ?? prefillRepo).find((x) => x.repo === prefillRepo);
      setSelectedRepo(r ?? null);
      setModelName(prefillModelName ?? deriveModelName(prefillRepo));
    } else {
      setSelectedRepo(null);
      setModelName("");
    }
  }, [open, prefillRepo, prefillModelName]);

  // Debounced search.
  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(() => {
      setResults(searchHFModels(q));
      setSearching(false);
    }, 180);
    return () => clearTimeout(t);
  }, [query, open]);

  const quantInfo = HF_QUANTS.find((q) => q.id === quant);
  const baseSizeGb = selectedRepo?.baseSizeGb ?? 0;
  const estimatedGb = Math.round(baseSizeGb * (quantInfo?.sizeFactor ?? 0.6) * 10) / 10;
  const filename = selectedRepo ? `${selectedRepo.repo.split("/")[1] ?? selectedRepo.repo}-${quant}.gguf` : "";
  const builder = selectedRepo?.builder ?? "";
  const canStart = !!selectedRepo && !!quantInfo && modelName.trim().length > 0;

  const handleSelectResult = (r: HFSearchResult) => {
    setSelectedRepo(r);
    setModelName(deriveModelName(r.repo));
  };

  const handleSubmit = () => {
    if (!canStart || !selectedRepo) return;
    startHFDownload({ repo: selectedRepo.repo, quant, modelName: modelName.trim(), builder });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Download className="size-4 text-primary" /> Download from HuggingFace
          </DialogTitle>
          <DialogDescription className="text-xs">
            Search the HuggingFace Hub for GGUF checkpoints, then pick a quantization.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-2">
          {/* LEFT: search + results */}
          <div className="flex min-h-0 flex-col border-b border-border/60 md:border-b-0 md:border-r">
            <div className="border-b border-border/60 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search models on HuggingFace…"
                  className="h-8 pl-8 text-xs"
                />
                {searching && <Loader2 className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {results.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                  <Search className="size-6 text-muted-foreground/50" />
                  <p className="text-[11px] text-muted-foreground">
                    {query.trim() ? "No models match your search." : "Type to search 24 curated GGUF repos."}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/40">
                  {results.map((r) => {
                    const isSel = selectedRepo?.repo === r.repo;
                    return (
                      <li key={r.repo}>
                        <button
                          type="button"
                          onClick={() => handleSelectResult(r)}
                          className={cn(
                            "flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors",
                            isSel ? "bg-primary/5" : "hover:bg-muted/40",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-mono text-[11px] font-medium">{r.repo}</span>
                            {isSel && <CheckCircle2 className="size-3.5 shrink-0 text-primary" />}
                          </div>
                          <p className="truncate text-[11px] text-muted-foreground">{r.description}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-semibold">{r.builder}</Badge>
                            <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-semibold">{r.parameterCount}</Badge>
                            <span className="text-[10px] text-muted-foreground">{fmtNum(r.downloads)} downloads</span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* RIGHT: quantization picker (or placeholder) */}
          <div className="flex min-h-0 flex-col">
            {!selectedRepo ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                <Boxes className="size-6 text-muted-foreground/50" />
                <p className="text-[11px] text-muted-foreground">Select a model to choose quantization</p>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
                <div className="mb-3 rounded-md border border-border/60 bg-muted/30 p-2.5">
                  <p className="truncate font-mono text-[11px] font-semibold">{selectedRepo.repo}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{selectedRepo.description}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-semibold">{selectedRepo.builder}</Badge>
                    <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-semibold">{selectedRepo.parameterCount}</Badge>
                    <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-semibold">{selectedRepo.license}</Badge>
                    <span className="text-[10px] text-muted-foreground">{fmtNum(selectedRepo.downloads)} dl</span>
                  </div>
                </div>

                <Label className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Quantization
                </Label>
                <div className="space-y-1.5">
                  {HF_QUANTS.map((q) => {
                    const sizeGb = Math.round(selectedRepo.baseSizeGb * q.sizeFactor * 10) / 10;
                    const isSel = quant === q.id;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setQuant(q.id)}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-md border p-2 text-left transition-colors",
                          isSel ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40",
                        )}
                      >
                        <div className={cn(
                          "mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full border",
                          isSel ? "border-primary bg-primary" : "border-muted-foreground/40",
                        )}>
                          {isSel && <CheckCircle2 className="size-2.5 text-primary-foreground" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold">{q.label}</span>
                            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">~{sizeGb.toFixed(1)} GB</span>
                          </div>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">{q.note}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <Label htmlFor="hf-name" className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Model name
                </Label>
                <Input
                  id="hf-name" value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer with summary */}
        <div className="border-t border-border/60 px-5 py-3">
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>Will download <span className="font-mono font-semibold text-foreground">{selectedRepo ? `~${estimatedGb.toFixed(1)} GB` : "—"}</span></span>
            {builder && <><span>·</span><span>builder <span className="font-medium text-foreground">{builder}</span></span></>}
            {filename && <><span>·</span><span className="truncate font-mono">/models/{filename}</span></>}
          </div>
          <DialogFooter className="flex-row justify-end gap-2 sm:justify-end">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={!canStart}>
              <Download className="mr-1.5 size-3.5" /> Start download
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Detail view ----------

function MetaItem({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-xs text-foreground", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-white p-3 shadow-soft dark:bg-zinc-900/60">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ModelDetailView({
  model, onBack, onEdit, onLoad,
}: {
  model: LlamaModel; onBack: () => void; onEdit: (m: LlamaModel) => void; onLoad: (m: LlamaModel) => void;
}) {
  const stats = React.useMemo(() => deriveModelStats(model.id), [model.id]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumbs items={[{ label: "Models", onClick: onBack }, { label: model.name }]} />
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5 size-3.5" /> Back
        </Button>
      </div>

      {model.missing && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Model file not found at <span className="font-mono text-xs">{model.path}</span></AlertTitle>
          <AlertDescription className="text-xs">
            The file may have been moved or deleted. Update the path to continue using this model.
            <Button variant="outline" size="sm" className="ml-3 h-7"
              onClick={() => onEdit(model)}>
              <Pencil className="mr-1.5 size-3" /> Update path
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        {/* MAIN column */}
        <div className="space-y-5">
          {/* Header card */}
          <Card className="border-0 bg-white shadow-soft dark:bg-zinc-900/60">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted">
                    <Boxes className="size-6 text-foreground/70" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">{model.name}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px] font-semibold">{model.builder}</Badge>
                      <FamilyBadge family={model.family} />
                      <Badge variant="secondary" className="gap-1 text-[10px] font-semibold">
                        <Cpu className="size-2.5" /> {model.quant}
                      </Badge>
                      <Badge variant="secondary" className="gap-1 text-[10px] font-semibold">
                        <HardDrive className="size-2.5" /> {fmtBytes(model.sizeGb)}
                      </Badge>
                    </div>
                  </div>
                </div>
                <StatusBadge model={model} />
              </div>
              {model.description && (
                <p className="mt-3 text-sm text-muted-foreground">{model.description}</p>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card className="border-0 bg-white shadow-soft dark:bg-zinc-900/60">
            <CardContent className="p-5">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <FileText className="size-4 text-foreground/60" /> Metadata
              </h3>
              <Separator className="mb-1" />
              <MetaItem label="Architecture" value={model.architecture} mono />
              <MetaItem label="Context length" value={fmtNum(model.contextLength)} mono />
              <MetaItem label="Parameter count" value={model.parameterCount} mono />
              <MetaItem label="Quantization bits" value={String(model.quantizationBits)} mono />
              <MetaItem label="License" value={model.license} />
              <MetaItem label="Uploaded" value={model.uploadedAt} mono />
              <MetaItem label="HF downloads" value={fmtNum(model.hfDownloads)} />
              <MetaItem label="Tags" value={model.tags.length ? model.tags.join(", ") : "—"} />
              <Separator className="my-1" />
              <div className="py-1.5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">File path</span>
                  <CopyButton text={model.path} />
                </div>
                <p className="truncate rounded-md bg-muted/40 px-2 py-1.5 font-mono text-[11px]">{model.path}</p>
              </div>
              {model.hfRepo && (
                <MetaItem
                  label="HuggingFace repo"
                  value={
                    <a
                      href={`https://huggingface.co/${model.hfRepo}`}
                      target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <span className="font-mono text-[11px]">{model.hfRepo}</span>
                      <ExternalLink className="size-3" />
                    </a>
                  }
                />
              )}
            </CardContent>
          </Card>

          {/* Usage statistics */}
          <Card className="border-0 bg-white shadow-soft dark:bg-zinc-900/60">
            <CardContent className="p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-foreground/60" /> Usage statistics on this device
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Times loaded" value={String(stats.timesLoaded)} />
                <StatTile label="Total tokens" value={fmtNum(stats.totalTokens)} />
                <StatTile label="Avg tok/s" value={stats.avgTps.toFixed(1)} />
                <StatTile label="Last used" value={stats.lastUsed} />
              </div>
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Tokens generated · last 7 days
                </p>
                <div className="h-36 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.daily} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} stroke="hsl(var(--muted-foreground))" />
                      <RTooltip
                        cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                        contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid hsl(var(--border))" }}
                      />
                      <Bar dataKey="tokens" fill="hsl(var(--primary) / 0.7)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SIDEBAR */}
        <div className="space-y-5">
          <Card className="border-0 bg-white shadow-soft dark:bg-zinc-900/60">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold">Actions</h3>
              <div className="space-y-2">
                <Button className="w-full justify-start" disabled={model.missing || !model.downloaded} onClick={() => onLoad(model)}>
                  <Play className="mr-2 size-4" /> Launch instance
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => onEdit(model)}>
                  <Pencil className="mr-2 size-4" /> Edit
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => onEdit(model)}>
                  <Trash2 className="mr-2 size-4" /> Delete
                </Button>
                <Separator className="my-1" />
                <Button variant="outline" className="w-full justify-start" disabled>
                  <FolderOpen className="mr-2 size-4" /> Open in file manager
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={async () => {
                  try { await navigator.clipboard.writeText(model.path); } catch { /* noop */ }
                }}>
                  <Copy className="mr-2 size-4" /> Copy path
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white shadow-soft dark:bg-zinc-900/60">
            <CardContent className="p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Tag className="size-4 text-foreground/60" /> Builder info
              </h3>
              <div className="mb-2 flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-full bg-muted font-mono text-xs font-semibold uppercase">
                  {model.builder.slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-medium">{model.builder}</p>
                  <p className="text-[10px] text-muted-foreground">Community quantizer</p>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Models by <span className="font-medium text-foreground">{model.builder}</span> are community quantizations. Verify integrity before use.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------- Main page ----------

export function ModelsPage() {
  const models = useLlamaStore((s) => s.models);
  const systemCapabilities = useLlamaStore((s) => s.systemCapabilities);
  const activeWorkspaceId = useLlamaStore((s) => s.activeWorkspaceId);

  const workspaceModels = React.useMemo(
    () => models.filter((m) => m.workspaceId === activeWorkspaceId),
    [models, activeWorkspaceId],
  );
  const ready = workspaceModels.filter((m) => m.downloaded && !m.missing).length;

  const [view, setView] = React.useState<ViewMode>("grid");
  const [mounted, setMounted] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [editModel, setEditModel] = React.useState<LlamaModel | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editFocusPath, setEditFocusPath] = React.useState(false);
  const [hfOpen, setHfOpen] = React.useState(false);
  const [hfPrefillRepo, setHfPrefillRepo] = React.useState<string | undefined>(undefined);
  const [hfPrefillName, setHfPrefillName] = React.useState<string | undefined>(undefined);
  const [launchModel, setLaunchModel] = React.useState<LlamaModel | null>(null);
  const [launchOpen, setLaunchOpen] = React.useState(false);

  // Hydrate view from localStorage after mount (avoids SSR mismatch).
  React.useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "grid" || saved === "table") setView(saved);
    } catch { /* localStorage unavailable */ }
  }, []);

  const handleViewChange = React.useCallback((v: ViewMode) => {
    setView(v);
    try { localStorage.setItem(VIEW_STORAGE_KEY, v); } catch { /* noop */ }
  }, []);

  const selectedModel = selectedId ? workspaceModels.find((m) => m.id === selectedId) ?? null : null;

  const openHF = React.useCallback(() => {
    setHfPrefillRepo(undefined);
    setHfPrefillName(undefined);
    setHfOpen(true);
  }, []);

  const openHFForModel = React.useCallback((m: LlamaModel) => {
    setHfPrefillRepo(m.hfRepo);
    setHfPrefillName(m.name);
    setHfOpen(true);
  }, []);

  const openEdit = React.useCallback((m: LlamaModel, focusPath = false) => {
    setEditModel(m);
    setEditFocusPath(focusPath);
    setEditOpen(true);
  }, []);

  const handleLoad = React.useCallback((m: LlamaModel) => {
    setLaunchModel(m);
    setLaunchOpen(true);
  }, []);

  const actions: CardActions = {
    onSelect: (m) => setSelectedId(m.id),
    onEdit: (m) => openEdit(m, m.missing),
    onDownload: openHFForModel,
    onLoad: handleLoad,
  };

  if (selectedModel) {
    return (
      <div className="space-y-6">
        <ModelDetailView
          model={selectedModel}
          onBack={() => setSelectedId(null)}
          onEdit={(m) => openEdit(m, m.missing)}
          onLoad={handleLoad}
        />
        <EditModelDialog model={editModel} open={editOpen} onOpenChange={setEditOpen} focusPath={editFocusPath} />
        <LaunchConfirmDialog model={launchModel} open={launchOpen} onOpenChange={setLaunchOpen} />
        <HFDownloadDialog open={hfOpen} onOpenChange={setHfOpen} prefillRepo={hfPrefillRepo} prefillModelName={hfPrefillName} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Models</h1>
          <p className="text-sm text-muted-foreground">
            Browse, download and manage GGUF model files. {ready} of {workspaceModels.length} ready.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Render placeholder ViewToggle during SSR to avoid hydration mismatch. */}
          {mounted ? (
            <ViewToggle value={view} onChange={handleViewChange} />
          ) : (
            <div className="h-8 w-32" />
          )}
          <Button size="sm" onClick={openHF}>
            <Download className="mr-1.5 size-3.5" /> Download from HF
          </Button>
        </div>
      </div>

      {workspaceModels.length === 0 ? (
        <Card className="border-dashed border-2 border-border bg-transparent shadow-none">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <Boxes className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium">No models in this workspace.</p>
              <p className="text-xs text-muted-foreground">Download from HuggingFace to get started.</p>
            </div>
            <Button size="sm" onClick={openHF}>
              <Download className="mr-1.5 size-3.5" /> Download from HF
            </Button>
          </CardContent>
        </Card>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {workspaceModels.map((m, i) => (
            <ModelCard key={m.id} model={m} index={i} actions={actions} gpuVramGb={systemCapabilities.gpuVramGb} />
          ))}
        </div>
      ) : (
        <ModelTable models={workspaceModels} actions={actions} gpuVramGb={systemCapabilities.gpuVramGb} />
      )}

      <EditModelDialog model={editModel} open={editOpen} onOpenChange={setEditOpen} focusPath={editFocusPath} />
      <LaunchConfirmDialog model={launchModel} open={launchOpen} onOpenChange={setLaunchOpen} />
      <HFDownloadDialog open={hfOpen} onOpenChange={setHfOpen} prefillRepo={hfPrefillRepo} prefillModelName={hfPrefillName} />
    </div>
  );
}
