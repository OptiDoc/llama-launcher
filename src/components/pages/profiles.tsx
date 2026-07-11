"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ViewToggle } from "@/components/ui/view-toggle";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  Cpu, Plus, Trash2, Layers, Zap, Flashlight, Terminal, Gauge, Globe,
  Link2, Share2, Sparkles, Wand2, Boxes, Copy, Check, ArrowLeft,
  Pencil, Files, Activity,
} from "lucide-react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import {
  useLlamaStore, type LlamaProfile, type ProfileScope, type ViewMode,
} from "@/lib/llama-store";

const VIEW_STORAGE_KEY = "ll-profiles-view";

/** Deterministic 32-bit FNV-1a hash — SSR safe (no Math.random). */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h | 0);
}

/** Deterministic calibration radar data derived from profile id hash. */
function deriveCalibration(id: string) {
  const h = hashStr(id);
  const dims = ["speed", "memory", "quality", "stability", "throughput"] as const;
  return dims.map((dim, i) => {
    const v = 40 + ((h >> (i * 4)) & 0x3f); // 40..103
    return { dim, value: Math.min(100, v) };
  });
}

// ---------- small bits ----------

function StatPill({ icon, label, value }: {
  icon: React.ReactNode; label: string; value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-2.5 py-1.5">
      <span className="grid size-6 place-items-center rounded-md bg-background text-primary">{icon}</span>
      <div className="leading-tight">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-xs font-semibold">{value}</div>
      </div>
    </div>
  );
}

function ScopeBadge({ scope, modelName }: { scope: ProfileScope; modelName?: string }) {
  if (scope === "global") {
    return (
      <Badge variant="secondary" className="gap-1 bg-sky-500/10 text-sky-600 dark:text-sky-400">
        <Globe className="size-3" /> Global
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 bg-violet-500/10 text-violet-600 dark:text-violet-400">
      <Boxes className="size-3" /> {modelName ?? "Model"}
    </Badge>
  );
}

function SharedBadge() {
  return (
    <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
      <Share2 className="size-3" /> Shared
    </Badge>
  );
}

function ScopeOption({ active, onClick, icon, label, desc }: {
  active: boolean; onClick: () => void;
  icon: React.ReactNode; label: string; desc: string;
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-accent",
      )}>
      <div className="flex items-center gap-1.5 text-sm font-medium">{icon} {label}</div>
      <span className="text-[11px] text-muted-foreground">{desc}</span>
    </button>
  );
}

// ---------- grid card ----------

function ProfileCard({ profile, onSelect }: {
  profile: LlamaProfile; onSelect: (id: string) => void;
}) {
  const shareProfile = useLlamaStore((s) => s.shareProfile);
  const calibrateProfile = useLlamaStore((s) => s.calibrateProfile);
  const models = useLlamaStore((s) => s.models);
  const [calibrating, setCalibrating] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const boundModel = models.find((m) => m.id === profile.modelId);

  const onCalibrate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCalibrating(true);
    setTimeout(() => { calibrateProfile(profile.id); setCalibrating(false); }, 1400);
  };
  const onShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile.shared) shareProfile(profile.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const hasCalib = typeof profile.calibrationScore === "number";

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onSelect(profile.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(profile.id); }
      }}
      className="group cursor-pointer border shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Cpu className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold">{profile.name}</h3>
            <p className="truncate text-xs text-muted-foreground">{profile.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ScopeBadge scope={profile.scope} modelName={boundModel?.name} />
          {profile.shared && <SharedBadge />}
          {hasCalib && (
            <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Sparkles className="size-3" /> Calib {profile.calibrationScore}
            </Badge>
          )}
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-2">
          <StatPill icon={<Gauge className="size-3.5" />} label="Ctx size" value={profile.ctxSize.toLocaleString()} />
          <StatPill icon={<Zap className="size-3.5" />} label="Threads" value={String(profile.threads)} />
          <StatPill icon={<Layers className="size-3.5" />} label="GPU layers" value={String(profile.gpuLayers)} />
          <StatPill icon={<Flashlight className="size-3.5" />} label="Flash attn" value={profile.flashAttention ? "Yes" : "No"} />
        </div>

        {profile.extraArgs && (
          <div className="rounded-lg border bg-muted/40 px-2.5 py-1.5" onClick={stop}>
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <Terminal className="size-3" /> Extra args
            </div>
            <p className="mt-0.5 truncate font-mono text-[11px] text-foreground/80">{profile.extraArgs}</p>
          </div>
        )}

        {hasCalib && (
          <div className="space-y-1" onClick={stop}>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><Sparkles className="size-3" /> Auto-calibration</span>
              <span className="font-mono font-semibold">{profile.calibrationScore}/100</span>
            </div>
            <Progress value={profile.calibrationScore} className="h-1.5" />
          </div>
        )}

        <div className="flex items-center gap-2 pt-1" onClick={stop}>
          <Button size="sm" variant="outline" className="h-7 flex-1 gap-1.5 text-xs"
            onClick={onCalibrate} disabled={calibrating}>
            <Wand2 className={cn("size-3.5", calibrating && "animate-spin")} />
            {calibrating ? "Calibrating…" : "Auto-calibrate"}
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
            onClick={onShare}
            title={profile.shared ? `Share ID: ${profile.shareId}` : "Share profile"}>
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Link2 className="size-3.5" />}
            {copied ? "Copied" : "Share"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- table view ----------

function ProfileTable({ profiles, onSelect }: {
  profiles: LlamaProfile[]; onSelect: (id: string) => void;
}) {
  const models = useLlamaStore((s) => s.models);
  const shareProfile = useLlamaStore((s) => s.shareProfile);
  const calibrateProfile = useLlamaStore((s) => s.calibrateProfile);
  const [busy, setBusy] = React.useState<string | null>(null);
  const modelName = (p: LlamaProfile) => models.find((m) => m.id === p.modelId)?.name;

  const onCalib = (e: React.MouseEvent, p: LlamaProfile) => {
    e.stopPropagation();
    setBusy(p.id);
    setTimeout(() => { calibrateProfile(p.id); setBusy(null); }, 1200);
  };
  const onShare = (e: React.MouseEvent, p: LlamaProfile) => {
    e.stopPropagation();
    if (!p.shared) shareProfile(p.id);
  };

  return (
    <Card className="border shadow-soft">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60">
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead className="text-right">Ctx</TableHead>
              <TableHead className="text-right">Threads</TableHead>
              <TableHead className="text-right">GPU layers</TableHead>
              <TableHead className="text-center">Calibration</TableHead>
              <TableHead className="text-center">Shared</TableHead>
              <TableHead className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p) => (
              <TableRow key={p.id} onClick={() => onSelect(p.id)} className="cursor-pointer border-border/60">
                <TableCell className="pl-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium">{p.name}</span>
                    <span className="max-w-[280px] truncate text-xs text-muted-foreground">{p.description}</span>
                  </div>
                </TableCell>
                <TableCell className="py-3"><ScopeBadge scope={p.scope} modelName={modelName(p)} /></TableCell>
                <TableCell className="py-3 text-right font-mono text-xs">{p.ctxSize.toLocaleString()}</TableCell>
                <TableCell className="py-3 text-right font-mono text-xs">{p.threads}</TableCell>
                <TableCell className="py-3 text-right font-mono text-xs">{p.gpuLayers}</TableCell>
                <TableCell className="py-3 text-center">
                  {typeof p.calibrationScore === "number" ? (
                    <div className="flex items-center justify-center gap-1.5">
                      <Progress value={p.calibrationScore} className="h-1.5 w-12" />
                      <span className="font-mono text-[10px] text-muted-foreground">{p.calibrationScore}</span>
                    </div>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="py-3 text-center">
                  {p.shared ? (
                    <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Check className="size-3" />
                    </Badge>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="pr-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                      onClick={(e) => onCalib(e, p)} disabled={busy === p.id}>
                      <Wand2 className={cn("mr-1 size-3", busy === p.id && "animate-spin")} />
                      Calib
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={(e) => onShare(e, p)}>
                      <Share2 className="size-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ---------- detail view ----------

function DetailCard({ title, action, children }: {
  title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Card className="border shadow-soft">
      <CardContent className="p-5">
        {(title || action) && (
          <div className="mb-3 flex items-center justify-between">
            {title && <h3 className="text-sm font-semibold text-foreground/80">{title}</h3>}
            {action}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

function ParamTile({ icon, label, value }: {
  icon: React.ReactNode; label: string; value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}

function ProfileDetailView({ profile, onBack }: {
  profile: LlamaProfile; onBack: () => void;
}) {
  const models = useLlamaStore((s) => s.models);
  const instances = useLlamaStore((s) => s.instances);
  const shareProfile = useLlamaStore((s) => s.shareProfile);
  const calibrateProfile = useLlamaStore((s) => s.calibrateProfile);
  const removeProfile = useLlamaStore((s) => s.removeProfile);
  const [calibrating, setCalibrating] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const boundModel = models.find((m) => m.id === profile.modelId);
  const radarData = React.useMemo(() => deriveCalibration(profile.id), [profile.id]);
  const usageCount = React.useMemo(
    () => instances.filter((i) => i.profile === profile.name).length,
    [instances, profile.name],
  );
  const hasCalib = typeof profile.calibrationScore === "number";

  const onCalibrate = () => {
    setCalibrating(true);
    setTimeout(() => { calibrateProfile(profile.id); setCalibrating(false); }, 1400);
  };
  const onShare = () => { if (!profile.shared) shareProfile(profile.id); };
  const onCopy = () => {
    if (profile.shareId) {
      try { navigator.clipboard?.writeText(profile.shareId); } catch { /* clipboard unavailable */ }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const onDelete = () => { removeProfile(profile.id); onBack(); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumbs items={[
          { label: "Profiles", onClick: onBack },
          { label: profile.name },
        ]} />
        <Button variant="ghost" size="sm" className="text-xs" onClick={onBack}>
          <ArrowLeft className="mr-1.5 size-3.5" /> Back
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* ---------- main column ---------- */}
        <div className="space-y-5">
          {/* Header */}
          <Card className="border shadow-soft">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Cpu className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold tracking-tight">{profile.name}</h2>
                    <ScopeBadge scope={profile.scope} modelName={boundModel?.name} />
                    {profile.shared && <SharedBadge />}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{profile.description}</p>
                  {boundModel && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Bound model:{" "}
                      <span className="font-medium text-foreground/80">{boundModel.name}</span>
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parameters */}
          <DetailCard title="Parameters">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <ParamTile icon={<Gauge className="size-3.5" />} label="Context size" value={profile.ctxSize.toLocaleString()} />
              <ParamTile icon={<Zap className="size-3.5" />} label="Threads" value={String(profile.threads)} />
              <ParamTile icon={<Layers className="size-3.5" />} label="GPU layers" value={String(profile.gpuLayers)} />
              <ParamTile icon={<Flashlight className="size-3.5" />} label="Flash attention" value={profile.flashAttention ? "Enabled" : "Disabled"} />
            </div>
            {profile.extraArgs && (
              <div className="mt-4 rounded-lg border bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Terminal className="size-3" /> Extra args
                </div>
                <p className="mt-1 font-mono text-xs text-foreground/80">{profile.extraArgs}</p>
              </div>
            )}
          </DetailCard>

          {/* Calibration */}
          <DetailCard title="Calibration" action={hasCalib ? (
            <span className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
              {profile.calibrationScore}/100
            </span>
          ) : undefined}>
            {hasCalib ? (
              <>
                <Progress value={profile.calibrationScore} className="mb-4 h-1.5" />
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} outerRadius="70%">
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="dim"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]}
                        tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                      <Radar dataKey="value" stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))" fillOpacity={0.25} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Not calibrated yet — run auto-calibration to compute scores.
              </p>
            )}
          </DetailCard>
        </div>

        {/* ---------- side column ---------- */}
        <div className="space-y-5">
          {/* Actions */}
          <DetailCard title="Actions">
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2" disabled title="Visual only">
                <Pencil className="size-3.5" /> Edit
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2" disabled title="Visual only">
                <Files className="size-3.5" /> Duplicate
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={onShare}>
                <Share2 className="size-3.5" /> {profile.shared ? "Already shared" : "Share"}
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2"
                onClick={onCalibrate} disabled={calibrating}>
                <Wand2 className={cn("size-3.5", calibrating && "animate-spin")} />
                {calibrating ? "Calibrating…" : "Auto-calibrate"}
              </Button>
              <Separator />
              <Button variant="outline"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                onClick={onDelete}>
                <Trash2 className="size-3.5" /> Delete
              </Button>
            </div>
          </DetailCard>

          {/* Sharing */}
          <DetailCard title="Sharing">
            {profile.shared && profile.shareId ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Share ID</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md border bg-muted/40 px-2 py-1.5 font-mono text-xs">
                    {profile.shareId}
                  </code>
                  <Button size="icon" variant="outline" className="size-8"
                    onClick={onCopy} title="Copy share ID">
                    {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Profile is private. Use Share to generate a shareable ID.
              </p>
            )}
          </DetailCard>

          {/* Usage */}
          <DetailCard title={(
            <span className="flex items-center gap-2">
              <Activity className="size-4 text-primary" /> Usage
            </span>
          )}>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{usageCount}</span>
              <span className="text-xs text-muted-foreground">
                {usageCount === 1 ? "instance" : "instances"} using this profile
              </span>
            </div>
          </DetailCard>
        </div>
      </div>
    </div>
  );
}

// ---------- new profile dialog ----------

function NewProfileDialog() {
  const addProfile = useLlamaStore((s) => s.addProfile);
  const models = useLlamaStore((s) => s.models);
  const activeWorkspaceId = useLlamaStore((s) => s.activeWorkspaceId);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [scope, setScope] = React.useState<ProfileScope>("global");
  const [modelId, setModelId] = React.useState("");
  const [ctxSize, setCtxSize] = React.useState("8192");
  const [threads, setThreads] = React.useState("8");
  const [gpuLayers, setGpuLayers] = React.useState("99");
  const [flashAttention, setFlashAttention] = React.useState(true);
  const [extraArgs, setExtraArgs] = React.useState("");

  // Reset all fields when the dialog opens. Deps intentionally limited to
  // `[open]` so we only reset on open transitions (not on every model list
  // change), and pick up the latest models[0] at open-time.
  React.useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setScope("global");
    setModelId(models[0]?.id ?? "");
    setCtxSize("8192");
    setThreads("8");
    setGpuLayers("99");
    setFlashAttention(true);
    setExtraArgs("");
  }, [open]);

  const submit = () => {
    if (!name.trim()) return;
    addProfile({
      name: name.trim(),
      description: description.trim() || "Custom profile",
      ctxSize: Number(ctxSize) || 4096,
      threads: Number(threads) || 4,
      gpuLayers: Number(gpuLayers) || 0,
      flashAttention,
      extraArgs: extraArgs.trim(),
      scope,
      modelId: scope === "model" ? modelId : undefined,
      calibrationScore: 70 + ((hashStr(name) & 0xf) % 15),
      workspaceId: scope === "global" ? null : activeWorkspaceId,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 size-3.5" /> New Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>New launch profile</DialogTitle>
          <DialogDescription>
            Profiles can be global (reusable across models) or bound to a
            specific model for tuning and sharing.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="prof-name">Name</Label>
            <Input id="prof-name" placeholder="e.g. Balanced" value={name}
              onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="prof-desc">Description</Label>
            <Input id="prof-desc" placeholder="Short note about this profile"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label>Scope</Label>
            <div className="grid grid-cols-2 gap-2">
              <ScopeOption active={scope === "global"} onClick={() => setScope("global")}
                icon={<Globe className="size-3.5 text-sky-500" />} label="Global"
                desc="Reusable across all models" />
              <ScopeOption active={scope === "model"} onClick={() => setScope("model")}
                icon={<Boxes className="size-3.5 text-violet-500" />} label="Model-bound"
                desc="Tuned for one model, shareable" />
            </div>
          </div>

          {scope === "model" && (
            <div className="grid gap-2">
              <Label>Bound model</Label>
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="prof-ctx">Context size</Label>
              <Input id="prof-ctx" type="number" value={ctxSize}
                onChange={(e) => setCtxSize(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prof-threads">Threads</Label>
              <Input id="prof-threads" type="number" value={threads}
                onChange={(e) => setThreads(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prof-ngl">GPU layers</Label>
              <Input id="prof-ngl" type="number" value={gpuLayers}
                onChange={(e) => setGpuLayers(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
            <div>
              <Label htmlFor="prof-fa" className="text-sm font-medium">Flash Attention</Label>
              <p className="text-xs text-muted-foreground">Reduce KV cache memory for long contexts.</p>
            </div>
            <Switch id="prof-fa" checked={flashAttention} onCheckedChange={setFlashAttention} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="prof-args">Extra args</Label>
            <Input id="prof-args" placeholder="--parallel 4 --cont-batching"
              value={extraArgs} onChange={(e) => setExtraArgs(e.target.value)}
              className="font-mono text-xs" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit}
            disabled={!name.trim() || (scope === "model" && !modelId)}>
            Create profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- empty state ----------

function EmptyState() {
  return (
    <Card className="border-dashed border-2 shadow-soft">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-accent">
          <Cpu className="size-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">No profiles here</p>
          <p className="text-xs text-muted-foreground">
            Create a launch profile — global or bound to a specific model.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- main page ----------

export function ProfilesPage() {
  const profiles = useLlamaStore((s) => s.profiles);
  const activeWorkspaceId = useLlamaStore((s) => s.activeWorkspaceId);
  const [mounted, setMounted] = React.useState(false);
  const [view, setView] = React.useState<ViewMode>("grid");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<"global" | "model" | "all">("global");

  // Hydrate view mode from localStorage after mount (SSR-safe).
  React.useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "grid" || saved === "table") setView(saved);
    } catch { /* localStorage unavailable */ }
  }, []);

  // Persist view mode (only after mount to avoid SSR write).
  React.useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem(VIEW_STORAGE_KEY, view); } catch { /* ignore */ }
  }, [mounted, view]);

  // Workspace filter: visible if global (null) or in active workspace.
  const visibleProfiles = React.useMemo(
    () => profiles.filter(
      (p) => p.workspaceId === null || p.workspaceId === activeWorkspaceId,
    ),
    [profiles, activeWorkspaceId],
  );
  const globalProfiles = React.useMemo(
    () => visibleProfiles.filter((p) => p.scope === "global"),
    [visibleProfiles],
  );
  const modelProfiles = React.useMemo(
    () => visibleProfiles.filter((p) => p.scope === "model"),
    [visibleProfiles],
  );
  const sharedCount = React.useMemo(
    () => visibleProfiles.filter((p) => p.shared).length,
    [visibleProfiles],
  );

  const currentList = tab === "global"
    ? globalProfiles
    : tab === "model" ? modelProfiles : visibleProfiles;

  const selectedProfile = selectedId
    ? visibleProfiles.find((p) => p.id === selectedId) ?? null
    : null;

  // Clear selection if it points to a removed profile.
  React.useEffect(() => {
    if (selectedId && !selectedProfile) setSelectedId(null);
  }, [selectedId, selectedProfile]);

  const handleSelect = (id: string) => setSelectedId(id);
  const handleBack = () => setSelectedId(null);

  if (selectedProfile) {
    return <ProfileDetailView profile={selectedProfile} onBack={handleBack} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profiles</h1>
          <p className="text-sm text-muted-foreground">
            Reusable llama-server argument presets · {visibleProfiles.length} total (
            {globalProfiles.length} global, {modelProfiles.length} model-bound, {sharedCount} shared)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mounted ? (
            <ViewToggle value={view} onChange={setView} />
          ) : (
            <div className="h-8 w-[112px] rounded-lg border bg-card shadow-soft" />
          )}
          <NewProfileDialog />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="global" className="gap-1.5">
            <Globe className="size-3.5" /> Global
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
              {globalProfiles.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="model" className="gap-1.5">
            <Boxes className="size-3.5" /> Model-bound
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
              {modelProfiles.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5">
            <Cpu className="size-3.5" /> All
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {currentList.length === 0 ? (
            <EmptyState />
          ) : view === "table" ? (
            <ProfileTable profiles={currentList} onSelect={handleSelect} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {currentList.map((p) => (
                <ProfileCard key={p.id} profile={p} onSelect={handleSelect} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
