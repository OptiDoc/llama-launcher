"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ViewToggle } from "@/components/ui/view-toggle";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  Server,
  Plus,
  Play,
  Square,
  Trash2,
  TerminalSquare,
  Cpu,
  Activity,
  MemoryStick,
  Clock,
  Network,
  ArrowLeft,
  RotateCcw,
  Zap,
  TrendingUp,
  Hash,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from "recharts";
import {
  useLlamaStore,
  uptimeString,
  pickPort,
  type LlamaInstance,
  type InstanceStatus,
  type ViewMode,
} from "@/lib/llama-store";

// ---------- helpers ----------

const VIEW_STORAGE_KEY = "ll-instances-view";

const STATUS_STYLE: Record<InstanceStatus, string> = {
  running: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  starting: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  stopping: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  error: "bg-red-500/15 text-red-700 dark:text-red-300",
  stopped: "bg-muted text-muted-foreground",
};

function StatusBadge({ status }: { status: InstanceStatus }) {
  const pulsing = status === "starting" || status === "stopping";
  return (
    <Badge
      variant="secondary"
      className={cn("gap-1.5 text-[10px] font-semibold uppercase tracking-wide", STATUS_STYLE[status])}
    >
      <span className={cn("size-1.5 rounded-full bg-current", pulsing && "animate-pulse")} />
      {status}
    </Badge>
  );
}

/** Deterministic 32-bit FNV-1a hash — SSR safe (no Math.random). */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h | 0);
}

/** Deterministic 20-sample throughput series for the detail-view chart. */
function deriveThroughput(id: string) {
  const h = hashStr(id);
  return Array.from({ length: 20 }, (_, i) => {
    const base = ((h >> (i % 16)) & 0xf) * 2.2 + ((h >> ((i + 3) % 16)) & 0x7) * 2.8 + 6;
    const noise = ((h >> ((i + 1) % 8)) & 0x3) * 1.5;
    return { idx: i + 1, tps: Math.round((base + noise) * 10) / 10 };
  });
}

function fmtStartedAt(startedAt?: number): string {
  if (!startedAt) return "—";
  return new Date(startedAt).toLocaleString();
}

const COLOR_DOT: Record<LlamaInstance["color"], string> = {
  green: "bg-emerald-400",
  orange: "bg-orange-400",
  blue: "bg-sky-400",
  pink: "bg-rose-400",
  purple: "bg-violet-400",
};

// ---------- tiles ----------

function StatTile({ icon, label, value, sub }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="border-0 bg-white shadow-soft dark:bg-zinc-900/60">
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-foreground/55">
          {icon}
          {label}
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
        {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function CardStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white/50 px-2.5 py-1.5 dark:bg-black/15">
      <span className="grid size-6 place-items-center rounded-md bg-white/70 text-foreground/70 dark:bg-black/25">
        {icon}
      </span>
      <div className="min-w-0 leading-tight">
        <div className="text-[10px] font-medium uppercase tracking-wide text-foreground/55">{label}</div>
        <div className="truncate text-xs font-semibold">{value}</div>
      </div>
    </div>
  );
}

// ---------- launch dialog ----------

function LaunchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const models = useLlamaStore((s) => s.models);
  const profiles = useLlamaStore((s) => s.profiles);
  const activeWorkspaceId = useLlamaStore((s) => s.activeWorkspaceId);
  const startInstance = useLlamaStore((s) => s.startInstance);
  const setActiveConsole = useLlamaStore((s) => s.setActiveConsole);
  const setConsoleOpen = useLlamaStore((s) => s.setConsoleOpen);

  const downloaded = React.useMemo(() => models.filter((m) => m.downloaded), [models]);
  const [name, setName] = React.useState("");
  const [modelId, setModelId] = React.useState("");
  const [profileId, setProfileId] = React.useState("");
  const [port, setPort] = React.useState("");
  const [host, setHost] = React.useState("127.0.0.1");
  const [gpu, setGpu] = React.useState("NVIDIA RTX 4070");

  // Reset form whenever dialog opens. Deps intentionally [open] only — we read
  // fresh store state inside to avoid stale closures / dep loops.
  React.useEffect(() => {
    if (!open) return;
    setName("");
    setPort(String(pickPort()));
    setHost("127.0.0.1");
    setGpu("NVIDIA RTX 4070");
    const dl = useLlamaStore.getState().models.filter((m) => m.downloaded);
    setModelId(dl[0]?.id ?? "");
    setProfileId("");
  }, [open]);

  // Profiles available for the selected model + workspace.
  const profileOptions = React.useMemo(() => {
    const selectedModel = models.find((m) => m.id === modelId);
    return profiles.filter((p) => {
      if (p.scope === "global") return true;
      if (selectedModel && p.modelId === selectedModel.id) return true;
      if (p.workspaceId === null) return true;
      if (p.workspaceId === activeWorkspaceId) return true;
      return false;
    });
  }, [profiles, models, modelId, activeWorkspaceId]);

  // Auto-default profileId when the current selection is no longer valid.
  React.useEffect(() => {
    if (!open) return;
    if (profileOptions.length > 0 && !profileOptions.some((p) => p.id === profileId)) {
      setProfileId(profileOptions[0].id);
    }
  }, [open, profileOptions, profileId]);

  const submit = () => {
    if (downloaded.length === 0 || profileOptions.length === 0) return;
    const model = models.find((m) => m.id === modelId)?.name ?? downloaded[0].name;
    const safeName = name.trim() || `${model.split(" ")[0] || "llama"}-${port}`;
    const id = startInstance({
      name: safeName,
      model,
      profile: profileId,
      port: Number(port) || pickPort(),
      host,
      gpu,
    });
    setActiveConsole(id);
    setConsoleOpen(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 size-3.5" />
          Launch Instance
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Launch llama-server</DialogTitle>
          <DialogDescription>
            Configure a new instance. It will start streaming logs to its own console tab.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="inst-name">Name</Label>
            <Input id="inst-name" placeholder="e.g. chat-prod-01" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Model</Label>
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select model" /></SelectTrigger>
                <SelectContent>
                  {downloaded.length === 0 ? (
                    <SelectItem value="__none" disabled>No models downloaded</SelectItem>
                  ) : (
                    downloaded.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Profile</Label>
              <Select value={profileId} onValueChange={setProfileId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select profile" /></SelectTrigger>
                <SelectContent>
                  {profileOptions.length === 0 ? (
                    <SelectItem value="__none" disabled>No profiles available</SelectItem>
                  ) : (
                    profileOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="inst-port">Port</Label>
              <Input id="inst-port" type="number" value={port} onChange={(e) => setPort(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inst-host">Host</Label>
              <Input id="inst-host" value={host} onChange={(e) => setHost(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>GPU</Label>
            <Select value={gpu} onValueChange={setGpu}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NVIDIA RTX 4070">NVIDIA RTX 4070</SelectItem>
                <SelectItem value="NVIDIA RTX 3090">NVIDIA RTX 3090</SelectItem>
                <SelectItem value="Apple M2 Max">Apple M2 Max</SelectItem>
                <SelectItem value="CPU">CPU</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={downloaded.length === 0 || profileOptions.length === 0}>
            <Play className="mr-1.5 size-3.5" />
            Launch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- grid view ----------

function InstanceCard({ instance, onSelect }: { instance: LlamaInstance; onSelect: (id: string) => void }) {
  const stopInstance = useLlamaStore((s) => s.stopInstance);
  const startInstance = useLlamaStore((s) => s.startInstance);
  const removeInstance = useLlamaStore((s) => s.removeInstance);
  const setActiveConsole = useLlamaStore((s) => s.setActiveConsole);

  const isRunning = instance.status === "running" || instance.status === "starting";
  const isStopped = instance.status === "stopped";

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(instance.id);
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onSelect(instance.id)}
      onKeyDown={handleKey}
      className={cn(
        "group cursor-pointer overflow-hidden border-0 shadow-soft transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lifted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        `card-${instance.color}`,
      )}
    >
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/60 dark:bg-black/20">
              <Server className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{instance.name}</h3>
              <p className="truncate text-xs text-foreground/70">{instance.model}</p>
            </div>
          </div>
          <StatusBadge status={instance.status} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <CardStat icon={<Network className="size-3.5" />} label="Port" value={`:${instance.port}`} />
          <CardStat icon={<Clock className="size-3.5" />} label="Uptime" value={uptimeString(instance.startedAt)} />
          <CardStat icon={<Zap className="size-3.5" />} label="Tok/s" value={instance.tokensPerSec.toFixed(1)} />
          <CardStat icon={<Cpu className="size-3.5" />} label="Req/min" value={String(instance.requestsPerMin)} />
        </div>

        <div className="flex items-center justify-between rounded-lg bg-white/40 px-2.5 py-1.5 text-[11px] dark:bg-black/15">
          <span className="flex items-center gap-1.5 text-foreground/70">
            <MemoryStick className="size-3.5" />
            Memory
          </span>
          <span className="font-mono font-semibold">
            {instance.memoryMb > 0 ? `${instance.memoryMb} MB` : "—"}
          </span>
        </div>

        {/* Action row — stopPropagation so the card click doesn't fire. */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 flex-1 bg-white/60 text-xs dark:bg-black/20"
            onClick={() => setActiveConsole(instance.id)}
          >
            <TerminalSquare className="mr-1.5 size-3.5" />
            Console
          </Button>
          {isRunning ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 flex-1 bg-white/60 text-xs text-red-600 hover:bg-white/80 dark:bg-black/20 dark:text-red-300"
              onClick={() => stopInstance(instance.id)}
            >
              <Square className="mr-1.5 size-3.5" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-8 flex-1 text-xs"
              disabled={instance.status === "stopping"}
              onClick={() =>
                startInstance({
                  name: instance.name,
                  model: instance.model,
                  profile: instance.profile,
                  port: instance.port,
                  host: instance.host,
                  gpu: instance.gpu,
                })
              }
            >
              <Play className="mr-1.5 size-3.5" />
              Start
            </Button>
          )}
          {isStopped && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => removeInstance(instance.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove instance</TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InstanceGrid({ instances, onSelect }: { instances: LlamaInstance[]; onSelect: (id: string) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {instances.map((inst) => (
        <InstanceCard key={inst.id} instance={inst} onSelect={onSelect} />
      ))}
    </div>
  );
}

// ---------- table view ----------

function InstanceTable({ instances, onSelect }: { instances: LlamaInstance[]; onSelect: (id: string) => void }) {
  return (
    <Card className="border-0 bg-white shadow-soft dark:bg-zinc-900/60">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60">
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Port</TableHead>
              <TableHead>Uptime</TableHead>
              <TableHead className="text-right">Tok/s</TableHead>
              <TableHead className="text-right">Req/min</TableHead>
              <TableHead className="text-right">Mem</TableHead>
              <TableHead className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {instances.map((inst) => (
              <TableRow
                key={inst.id}
                onClick={() => onSelect(inst.id)}
                className="cursor-pointer border-border/60"
              >
                <TableCell className="pl-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className={cn("size-2 rounded-full", COLOR_DOT[inst.color])} />
                    <span className="font-medium">{inst.name}</span>
                  </div>
                </TableCell>
                <TableCell className="max-w-[220px] truncate py-3 text-foreground/70">{inst.model}</TableCell>
                <TableCell className="py-3"><StatusBadge status={inst.status} /></TableCell>
                <TableCell className="py-3 font-mono text-xs">:{inst.port}</TableCell>
                <TableCell className="py-3 text-xs text-foreground/70">{uptimeString(inst.startedAt)}</TableCell>
                <TableCell className="py-3 text-right font-mono text-xs">{inst.tokensPerSec.toFixed(1)}</TableCell>
                <TableCell className="py-3 text-right font-mono text-xs">{inst.requestsPerMin}</TableCell>
                <TableCell className="py-3 text-right font-mono text-xs">
                  {inst.memoryMb > 0 ? `${inst.memoryMb} MB` : "—"}
                </TableCell>
                <TableCell className="pr-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <TableActions instance={inst} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TableActions({ instance }: { instance: LlamaInstance }) {
  const stopInstance = useLlamaStore((s) => s.stopInstance);
  const startInstance = useLlamaStore((s) => s.startInstance);
  const removeInstance = useLlamaStore((s) => s.removeInstance);
  const setActiveConsole = useLlamaStore((s) => s.setActiveConsole);
  const isRunning = instance.status === "running" || instance.status === "starting";
  const isStopped = instance.status === "stopped";

  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" className="size-7" onClick={() => setActiveConsole(instance.id)}>
            <TerminalSquare className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open console</TooltipContent>
      </Tooltip>
      {isRunning ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="size-7 text-red-600 hover:text-red-700" onClick={() => stopInstance(instance.id)}>
              <Square className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Stop</TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="size-7" disabled={instance.status === "stopping"}
              onClick={() => startInstance({
                name: instance.name, model: instance.model, profile: instance.profile,
                port: instance.port, host: instance.host, gpu: instance.gpu,
              })}>
              <Play className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Start</TooltipContent>
        </Tooltip>
      )}
      {isStopped && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => removeInstance(instance.id)}>
              <Trash2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Remove</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

// ---------- empty state ----------

function EmptyState({ onLaunch }: { onLaunch: () => void }) {
  return (
    <Card className="border-dashed border-2 shadow-soft">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-muted">
          <Server className="size-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">No instances yet</p>
          <p className="text-xs text-muted-foreground">
            Launch your first llama-server to get started.
          </p>
        </div>
        <Button size="sm" className="mt-1" onClick={onLaunch}>
          <Plus className="mr-1.5 size-3.5" />
          Launch Instance
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------- detail view ----------

function InstanceDetailView({ instance, onBack }: { instance: LlamaInstance; onBack: () => void }) {
  const profiles = useLlamaStore((s) => s.profiles);
  const stopInstance = useLlamaStore((s) => s.stopInstance);
  const startInstance = useLlamaStore((s) => s.startInstance);
  const removeInstance = useLlamaStore((s) => s.removeInstance);
  const setActiveConsole = useLlamaStore((s) => s.setActiveConsole);

  const isRunning = instance.status === "running" || instance.status === "starting";
  const isStopped = instance.status === "stopped";
  const profile = profiles.find((p) => p.name === instance.profile);
  const throughput = React.useMemo(() => deriveThroughput(instance.id), [instance.id]);
  const [confirmRemove, setConfirmRemove] = React.useState(false);

  const avgMemory = profile ? Math.round(profile.ctxSize * 0.5 + 1200) : instance.memoryMb;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumbs
          items={[
            { label: "Instances", onClick: onBack },
            { label: instance.name },
          ]}
        />
        <Button variant="ghost" size="sm" className="text-xs" onClick={onBack}>
          <ArrowLeft className="mr-1.5 size-3.5" />
          Back
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* ---------- main column ---------- */}
        <div className="space-y-5">
          {/* Header card */}
          <Card className={cn("border-0 shadow-soft", `card-${instance.color}`)}>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-12 place-items-center rounded-xl bg-white/60 dark:bg-black/20">
                    <Server className="size-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold tracking-tight">{instance.name}</h2>
                      <StatusBadge status={instance.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-foreground/70">{instance.model}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/70">
                  <span className="font-mono">{instance.host}:{instance.port}</span>
                  <span>·</span>
                  <span>{instance.gpu}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Clock className="size-3" /> {uptimeString(instance.startedAt)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usage statistics */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground/80">Usage statistics</h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                icon={<TrendingUp className="size-3.5" />}
                label="Tokens generated"
                value={instance.generatedTokens.toLocaleString()}
                sub={`${instance.promptTokens.toLocaleString()} prompt`}
              />
              <StatTile
                icon={<Cpu className="size-3.5" />}
                label="Total requests"
                value={instance.totalRequests.toLocaleString()}
                sub={`${instance.errorCount} errors`}
              />
              <StatTile
                icon={<Zap className="size-3.5" />}
                label="Peak tok/s"
                value={instance.peakTokensPerSec.toFixed(1)}
                sub={`${instance.tokensPerSec.toFixed(1)} current`}
              />
              <StatTile
                icon={<MemoryStick className="size-3.5" />}
                label="Avg memory"
                value={`${avgMemory} MB`}
                sub={`${instance.ctxSize} ctx`}
              />
            </div>
          </div>

          {/* Throughput chart */}
          <Card className="border-0 bg-white shadow-soft dark:bg-zinc-900/60">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground/80">Request throughput</h3>
                <span className="text-[11px] text-muted-foreground">last 20 samples · tok/s</span>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={throughput} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="idx"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      interval={4}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      width={36}
                    />
                    <RTooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 11,
                      }}
                      labelFormatter={(l) => `sample ${l}`}
                      formatter={(v: number) => [`${v.toFixed(1)} tok/s`, "throughput"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="tps"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Configuration */}
          <Card className="border-0 bg-white shadow-soft dark:bg-zinc-900/60">
            <CardContent className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground/80">Configuration</h3>
              <Separator className="mb-2" />
              <MetaItem label="Context size" value={<span className="font-mono">{instance.ctxSize}</span>} />
              <MetaItem label="Threads" value={<span className="font-mono">{instance.threads}</span>} />
              <MetaItem
                label="GPU layers"
                value={<span className="font-mono">{profile?.gpuLayers ?? "—"}</span>}
              />
              <MetaItem
                label="Card color"
                value={
                  <span className="flex items-center gap-1.5">
                    <span className={cn("size-2.5 rounded-full", COLOR_DOT[instance.color])} />
                    {instance.color}
                  </span>
                }
              />
              <MetaItem label="Started at" value={<span className="font-mono text-[11px]">{fmtStartedAt(instance.startedAt)}</span>} />
            </CardContent>
          </Card>
        </div>

        {/* ---------- sidebar ---------- */}
        <div className="space-y-5">
          {/* Actions */}
          <Card className="border-0 bg-white shadow-soft dark:bg-zinc-900/60">
            <CardContent className="space-y-2 p-5">
              <h3 className="text-sm font-semibold text-foreground/80">Actions</h3>
              <Separator className="mb-1" />
              <Button className="w-full justify-start" onClick={() => setActiveConsole(instance.id)}>
                <TerminalSquare className="mr-2 size-4" />
                Open Console
              </Button>
              {isRunning ? (
                <Button
                  variant="secondary"
                  className="w-full justify-start bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:text-red-300"
                  onClick={() => stopInstance(instance.id)}
                >
                  <Square className="mr-2 size-4" />
                  Stop instance
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  disabled={instance.status === "stopping"}
                  onClick={() =>
                    startInstance({
                      name: instance.name,
                      model: instance.model,
                      profile: instance.profile,
                      port: instance.port,
                      host: instance.host,
                      gpu: instance.gpu,
                    })
                  }
                >
                  <Play className="mr-2 size-4" />
                  Start instance
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled={!isRunning}
                onClick={() => stopInstance(instance.id)}
              >
                <RotateCcw className="mr-2 size-4" />
                Restart
              </Button>
              <Separator className="my-1" />
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={!isStopped}
                onClick={() => setConfirmRemove(true)}
              >
                <Trash2 className="mr-2 size-4" />
                Remove instance
              </Button>
            </CardContent>
          </Card>

          {/* Live status */}
          <Card className="border-0 bg-white shadow-soft dark:bg-zinc-900/60">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground/80">Live status</h3>
                <Badge variant="secondary" className={cn("text-[10px] uppercase", STATUS_STYLE[instance.status])}>
                  {instance.status}
                </Badge>
              </div>
              <Separator className="mb-2" />
              <MetaItem
                label="Throughput"
                value={<span className="flex items-center gap-1 font-mono"><Zap className="size-3" /> {instance.tokensPerSec.toFixed(1)} tok/s</span>}
              />
              <MetaItem
                label="Requests / min"
                value={<span className="flex items-center gap-1 font-mono"><Hash className="size-3" /> {instance.requestsPerMin}</span>}
              />
              <MetaItem
                label="Memory"
                value={<span className="flex items-center gap-1 font-mono"><MemoryStick className="size-3" /> {instance.memoryMb > 0 ? `${instance.memoryMb} MB` : "—"}</span>}
              />
              <MetaItem
                label="Uptime"
                value={<span className="flex items-center gap-1 font-mono"><Clock className="size-3" /> {uptimeString(instance.startedAt)}</span>}
              />
            </CardContent>
          </Card>

          {isStopped && (
            <p className="px-1 text-[11px] text-muted-foreground">
              Instance is stopped. Historical stats are preserved; live values are
              from the last run.
            </p>
          )}
        </div>
      </div>

      {/* Remove confirm */}
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove instance?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <span className="font-semibold">{instance.name}</span> and
              its console log. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                removeInstance(instance.id);
                setConfirmRemove(false);
                onBack();
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------- main page ----------

export function InstancesPage() {
  const instances = useLlamaStore((s) => s.instances);
  const activeWorkspaceId = useLlamaStore((s) => s.activeWorkspaceId);

  const [mounted, setMounted] = React.useState(false);
  const [view, setView] = React.useState<ViewMode>("grid");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [launchOpen, setLaunchOpen] = React.useState(false);

  // Hydrate view mode from localStorage after mount (SSR-safe).
  React.useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "grid" || saved === "table") setView(saved);
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  // Persist view mode (only after mount to avoid SSR write).
  React.useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      /* ignore */
    }
  }, [mounted, view]);

  const filtered = React.useMemo(
    () => instances.filter((i) => i.workspaceId === activeWorkspaceId),
    [instances, activeWorkspaceId],
  );

  const selectedInstance = selectedId
    ? filtered.find((i) => i.id === selectedId) ?? null
    : null;

  // If selection points to a removed/non-existent instance, fall back to list.
  React.useEffect(() => {
    if (selectedId && !selectedInstance) setSelectedId(null);
  }, [selectedId, selectedInstance]);

  const handleSelect = (id: string) => setSelectedId(id);
  const handleBack = () => setSelectedId(null);

  // ---------- detail view ----------
  if (selectedInstance) {
    return (
      <InstanceDetailView instance={selectedInstance} onBack={handleBack} />
    );
  }

  // ---------- list view ----------
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Instances</h1>
          <p className="text-sm text-muted-foreground">
            Launch, monitor and manage your llama.cpp server processes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Render placeholder toggle during SSR to avoid hydration mismatch. */}
          {mounted ? (
            <ViewToggle value={view} onChange={setView} />
          ) : (
            <div className="h-8 w-[112px] rounded-lg border bg-card shadow-soft" />
          )}
          <LaunchDialog open={launchOpen} onOpenChange={setLaunchOpen} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState onLaunch={() => setLaunchOpen(true)} />
      ) : view === "table" ? (
        <InstanceTable instances={filtered} onSelect={handleSelect} />
      ) : (
        <InstanceGrid instances={filtered} onSelect={handleSelect} />
      )}
    </div>
  );
}
