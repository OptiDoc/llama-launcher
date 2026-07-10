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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
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
  Cpu,
  Plus,
  Trash2,
  Layers,
  Zap,
  Flashlight,
  Terminal,
  Gauge,
  Globe,
  Link2,
  Share2,
  Sparkles,
  Wand2,
  Boxes,
  Copy,
  Check,
} from "lucide-react";
import {
  useLlamaStore,
  type LlamaProfile,
  type ProfileScope,
} from "@/lib/llama-store";

function StatPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-2.5 py-1.5">
      <span className="grid size-6 place-items-center rounded-md bg-background text-primary">
        {icon}
      </span>
      <div className="leading-tight">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="text-xs font-semibold">{value}</div>
      </div>
    </div>
  );
}

function ScopeBadge({ scope, modelName }: { scope: ProfileScope; modelName?: string }) {
  if (scope === "global") {
    return (
      <Badge variant="secondary" className="gap-1 bg-sky-500/10 text-sky-600 dark:text-sky-400">
        <Globe className="size-3" />
        Global
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 bg-violet-500/10 text-violet-600 dark:text-violet-400">
      <Boxes className="size-3" />
      {modelName ?? "Model"}
    </Badge>
  );
}

function ProfileCard({ profile }: { profile: LlamaProfile }) {
  const removeProfile = useLlamaStore((s) => s.removeProfile);
  const shareProfile = useLlamaStore((s) => s.shareProfile);
  const calibrateProfile = useLlamaStore((s) => s.calibrateProfile);
  const models = useLlamaStore((s) => s.models);
  const [calibrating, setCalibrating] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const boundModel = models.find((m) => m.id === profile.modelId);

  const onCalibrate = () => {
    setCalibrating(true);
    setTimeout(() => {
      calibrateProfile(profile.id);
      setCalibrating(false);
    }, 1400);
  };

  const onCopyShare = () => {
    if (!profile.shared) shareProfile(profile.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Card className="border shadow-soft">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Cpu className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{profile.name}</h3>
              <p className="truncate text-xs text-muted-foreground">{profile.description}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => removeProfile(profile.id)}
            title="Delete profile"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ScopeBadge scope={profile.scope} modelName={boundModel?.name} />
          {profile.shared && (
            <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Share2 className="size-3" />
              Shared
            </Badge>
          )}
          {typeof profile.calibrationScore === "number" && (
            <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Sparkles className="size-3" />
              Calib {profile.calibrationScore}
            </Badge>
          )}
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-2">
          <StatPill
            icon={<Gauge className="size-3.5" />}
            label="Ctx size"
            value={profile.ctxSize.toLocaleString()}
          />
          <StatPill
            icon={<Zap className="size-3.5" />}
            label="Threads"
            value={String(profile.threads)}
          />
          <StatPill
            icon={<Layers className="size-3.5" />}
            label="GPU layers"
            value={String(profile.gpuLayers)}
          />
          <StatPill
            icon={<Flashlight className="size-3.5" />}
            label="Flash attn"
            value={profile.flashAttention ? "Yes" : "No"}
          />
        </div>

        {profile.extraArgs && (
          <div className="rounded-lg border bg-muted/40 px-2.5 py-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <Terminal className="size-3" />
              Extra args
            </div>
            <p className="mt-0.5 truncate font-mono text-[11px] text-foreground/80">
              {profile.extraArgs}
            </p>
          </div>
        )}

        {/* Calibration progress bar */}
        {typeof profile.calibrationScore === "number" && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Sparkles className="size-3" />
                Auto-calibration score
              </span>
              <span className="font-mono font-semibold">{profile.calibrationScore}/100</span>
            </div>
            <Progress value={profile.calibrationScore} className="h-1.5" />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 flex-1 gap-1.5 text-xs"
            onClick={onCalibrate}
            disabled={calibrating}
          >
            <Wand2 className={cn("size-3.5", calibrating && "animate-spin")} />
            {calibrating ? "Calibrating…" : "Auto-calibrate"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={onCopyShare}
            title={profile.shared ? `Share ID: ${profile.shareId}` : "Share profile"}
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Link2 className="size-3.5" />}
            {copied ? "Copied" : "Share"}
          </Button>
        </div>
        {profile.shared && profile.shareId && (
          <div className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 font-mono text-[10px] text-muted-foreground">
            <Copy className="size-3" />
            <span className="truncate">{profile.shareId}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NewProfileDialog() {
  const addProfile = useLlamaStore((s) => s.addProfile);
  const models = useLlamaStore((s) => s.models);
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

  const reset = () => {
    setName("");
    setDescription("");
    setScope("global");
    setModelId(models[0]?.id ?? "");
    setCtxSize("8192");
    setThreads("8");
    setGpuLayers("99");
    setFlashAttention(true);
    setExtraArgs("");
  };

  React.useEffect(() => {
    if (open) reset();
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
      calibrationScore: 70 + Math.floor(Math.random() * 15),
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 size-3.5" />
          New Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>New launch profile</DialogTitle>
          <DialogDescription>
            Profiles can be global (reusable across models) or bound to a specific model for tuning and sharing.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="prof-name">Name</Label>
            <Input
              id="prof-name"
              placeholder="e.g. Balanced"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="prof-desc">Description</Label>
            <Input
              id="prof-desc"
              placeholder="Short note about this profile"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Scope selector */}
          <div className="grid gap-2">
            <Label>Scope</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope("global")}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                  scope === "global"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-accent",
                )}
              >
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Globe className="size-3.5 text-sky-500" />
                  Global
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Reusable across all models
                </span>
              </button>
              <button
                type="button"
                onClick={() => setScope("model")}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                  scope === "model"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-accent",
                )}
              >
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Boxes className="size-3.5 text-violet-500" />
                  Model-bound
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Tuned for one model, shareable
                </span>
              </button>
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
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="prof-ctx">Context size</Label>
              <Input
                id="prof-ctx"
                type="number"
                value={ctxSize}
                onChange={(e) => setCtxSize(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prof-threads">Threads</Label>
              <Input
                id="prof-threads"
                type="number"
                value={threads}
                onChange={(e) => setThreads(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prof-ngl">GPU layers</Label>
              <Input
                id="prof-ngl"
                type="number"
                value={gpuLayers}
                onChange={(e) => setGpuLayers(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
            <div>
              <Label htmlFor="prof-fa" className="text-sm font-medium">
                Flash Attention
              </Label>
              <p className="text-xs text-muted-foreground">
                Reduce KV cache memory for long contexts.
              </p>
            </div>
            <Switch id="prof-fa" checked={flashAttention} onCheckedChange={setFlashAttention} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="prof-args">Extra args</Label>
            <Input
              id="prof-args"
              placeholder="--parallel 4 --cont-batching"
              value={extraArgs}
              onChange={(e) => setExtraArgs(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || (scope === "model" && !modelId)}>
            Create profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProfilesPage() {
  const profiles = useLlamaStore((s) => s.profiles);
  const models = useLlamaStore((s) => s.models);

  const globalProfiles = profiles.filter((p) => p.scope === "global");
  const modelProfiles = profiles.filter((p) => p.scope === "model");
  const sharedCount = profiles.filter((p) => p.shared).length;

  // group model-bound profiles by model
  const byModel = models
    .map((m) => ({
      model: m,
      profiles: modelProfiles.filter((p) => p.modelId === m.id),
    }))
    .filter((g) => g.profiles.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profiles</h1>
          <p className="text-sm text-muted-foreground">
            Reusable llama-server argument presets · {profiles.length} total ({globalProfiles.length} global, {modelProfiles.length} model-bound, {sharedCount} shared)
          </p>
        </div>
        <NewProfileDialog />
      </div>

      <Tabs defaultValue="global">
        <TabsList>
          <TabsTrigger value="global" className="gap-1.5">
            <Globe className="size-3.5" />
            Global
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
              {globalProfiles.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="model" className="gap-1.5">
            <Boxes className="size-3.5" />
            Model-bound
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
              {modelProfiles.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5">
            <Cpu className="size-3.5" />
            All
          </TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="mt-4">
          {globalProfiles.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {globalProfiles.map((p) => (
                <ProfileCard key={p.id} profile={p} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="model" className="mt-4 space-y-6">
          {byModel.length === 0 ? (
            <EmptyState />
          ) : (
            byModel.map(({ model, profiles: plist }) => (
              <div key={model.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="grid size-7 place-items-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <Boxes className="size-4" />
                  </div>
                  <h2 className="text-sm font-semibold">{model.name}</h2>
                  <Badge variant="outline" className="text-[10px]">
                    {plist.length} {plist.length === 1 ? "profile" : "profiles"}
                  </Badge>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {plist.map((p) => (
                    <ProfileCard key={p.id} profile={p} />
                  ))}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          {profiles.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profiles.map((p) => (
                <ProfileCard key={p.id} profile={p} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed shadow-soft">
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
