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
} from "lucide-react";
import { useLlamaStore, type LlamaProfile } from "@/lib/llama-store";

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
    <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5">
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

function ProfileCard({ profile }: { profile: LlamaProfile }) {
  const removeProfile = useLlamaStore((s) => s.removeProfile);

  return (
    <Card className="border shadow-sm">
      <CardContent className="flex flex-col gap-4 p-5">
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
          <div className="rounded-lg bg-muted/50 px-2.5 py-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <Terminal className="size-3" />
              Extra args
            </div>
            <p className="mt-0.5 truncate font-mono text-[11px] text-foreground/80">
              {profile.extraArgs}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NewProfileDialog() {
  const addProfile = useLlamaStore((s) => s.addProfile);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [ctxSize, setCtxSize] = React.useState("8192");
  const [threads, setThreads] = React.useState("8");
  const [gpuLayers, setGpuLayers] = React.useState("99");
  const [flashAttention, setFlashAttention] = React.useState(true);
  const [extraArgs, setExtraArgs] = React.useState("");

  const reset = () => {
    setName("");
    setDescription("");
    setCtxSize("8192");
    setThreads("8");
    setGpuLayers("99");
    setFlashAttention(true);
    setExtraArgs("");
  };

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
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 size-3.5" />
          New Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>New launch profile</DialogTitle>
          <DialogDescription>
            Preset llama-server arguments. Profiles are reusable across instances and models.
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
          <Button onClick={submit} disabled={!name.trim()}>
            Create profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProfilesPage() {
  const profiles = useLlamaStore((s) => s.profiles);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profiles</h1>
          <p className="text-sm text-muted-foreground">
            Reusable llama-server argument presets. {profiles.length} configured.
          </p>
        </div>
        <NewProfileDialog />
      </div>

      {profiles.length === 0 ? (
        <Card className="border-dashed shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-accent">
              <Cpu className="size-7 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">No profiles yet</p>
              <p className="text-xs text-muted-foreground">
                Create a launch profile to save reusable llama-server arguments.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((p) => (
            <ProfileCard key={p.id} profile={p} />
          ))}
        </div>
      )}
    </div>
  );
}
