"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  useLlamaStore,
  type GlobalSettings,
  type Workspace,
  type WorkspaceSettings,
} from "@/lib/llama-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Settings as SettingsIcon, FolderOpen, Network, Bell, Info, Github, ExternalLink,
  Cpu, Moon, Trash2, Plus, Server, Layers, Package, AlertTriangle, Clock, Boxes,
} from "lucide-react";

// ---------- Workspace color helpers ----------
const WORKSPACE_COLORS: Workspace["color"][] = ["green", "orange", "blue", "pink", "purple"];
const WS_DOT: Record<Workspace["color"], string> = {
  green: "bg-emerald-500", orange: "bg-amber-500", blue: "bg-sky-500", pink: "bg-rose-500", purple: "bg-violet-500",
};
const WS_RING: Record<Workspace["color"], string> = {
  green: "ring-emerald-500", orange: "ring-amber-500", blue: "ring-sky-500", pink: "ring-rose-500", purple: "ring-violet-500",
};

// ---------- Reusable bits ----------
function FieldRow({ id, label, hint, children }: {
  id: string; label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[220px_1fr] sm:items-center sm:gap-4">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
}

function ToggleRow({ id, label, hint, checked, onChange, disabled }: {
  id: string; label: string; hint: string; checked: boolean;
  onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 px-3 py-2.5">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

function SectionCard({ icon, title, description, children, className }: {
  icon: React.ReactNode; title: string; description?: string;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border/60 bg-card", className)}>
      <div className="pb-3">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
          <span className="text-primary">{icon}</span>
          {title}
        </h3>
        {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ColorSwatchPicker({ value, onChange }: {
  value: Workspace["color"]; onChange: (c: Workspace["color"]) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {WORKSPACE_COLORS.map((c) => (
        <button
          key={c} type="button" aria-label={c} onClick={() => onChange(c)}
          className={cn(
            "size-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-4",
            WS_DOT[c], value === c ? WS_RING[c] : "ring-transparent",
          )}
        />
      ))}
    </div>
  );
}

function ResourceStat({ icon, label, value, hint }: {
  icon: React.ReactNode; label: string; value: number; hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground/80">{hint}</div>}
    </div>
  );
}

// ---------- Global settings tab ----------
function GlobalSettingsTab() {
  const g = useLlamaStore((s) => s.globalSettings);
  const update = useLlamaStore((s) => s.updateGlobalSettings);
  const setNum = (key: keyof GlobalSettings, raw: string) => {
    const n = Number(raw);
    update({ [key]: Number.isFinite(n) ? n : 0 } as Partial<GlobalSettings>);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionCard icon={<FolderOpen className="size-4" />} title="Paths"
        description="Where LlamaLauncher looks for binaries, models and CUDA libraries.">
        <FieldRow id="g-llama-cpp-path" label="llama.cpp binary" hint="Path to the llama-server executable">
          <Input id="g-llama-cpp-path" value={g.llamaCppPath}
            onChange={(e) => update({ llamaCppPath: e.target.value })} className="font-mono text-xs" />
        </FieldRow>
        <FieldRow id="g-models-dir" label="Models directory" hint="Where to look for .gguf files">
          <Input id="g-models-dir" value={g.modelsDir}
            onChange={(e) => update({ modelsDir: e.target.value })} className="font-mono text-xs" />
        </FieldRow>
        <FieldRow id="g-cuda-libs" label="CUDA libraries"
          hint="Used to copy CUDA libs into downloaded CUDA release builds">
          <Input id="g-cuda-libs" value={g.cudaLibsDir}
            onChange={(e) => update({ cudaLibsDir: e.target.value })} className="font-mono text-xs" />
        </FieldRow>
      </SectionCard>

      <SectionCard icon={<Network className="size-4" />} title="Network"
        description="Default bind address and port range for new llama-server instances.">
        <FieldRow id="g-host" label="Default host" hint="Bind address for new instances">
          <Input id="g-host" value={g.defaultHost}
            onChange={(e) => update({ defaultHost: e.target.value })} className="font-mono text-xs" />
        </FieldRow>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow id="g-port-start" label="Port range start" hint="Auto-allocated from">
            <Input id="g-port-start" type="number" value={g.portRangeStart}
              onChange={(e) => setNum("portRangeStart", e.target.value)} className="font-mono text-xs" />
          </FieldRow>
          <FieldRow id="g-port-end" label="Port range end" hint="Inclusive upper bound">
            <Input id="g-port-end" type="number" value={g.portRangeEnd}
              onChange={(e) => setNum("portRangeEnd", e.target.value)} className="font-mono text-xs" />
          </FieldRow>
        </div>
        <div className="rounded-lg bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          OpenAI-compatible endpoints are exposed at{" "}
          <code className="font-mono text-foreground">{g.defaultHost}:&lt;port&gt;/v1/chat/completions</code>.
        </div>
      </SectionCard>

      <SectionCard icon={<Bell className="size-4" />} title="Updates & notifications"
        description="Control release tracking and desktop alerts." className="lg:col-span-2">
        <div className="grid gap-3 md:grid-cols-2">
          <ToggleRow id="g-check-releases" label="Check for new llama.cpp releases on GitHub"
            hint="Poll the ggerganov/llama.cpp releases feed."
            checked={g.checkForReleases} onChange={(v) => update({ checkForReleases: v })} />
          <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center sm:gap-4">
            <div>
              <Label className="text-sm font-medium">Release channel</Label>
              <p className="text-xs text-muted-foreground">Which release tags to surface.</p>
            </div>
            <Select value={g.releaseChannel}
              onValueChange={(v) => update({ releaseChannel: v as GlobalSettings["releaseChannel"] })}>
              <SelectTrigger id="g-release-channel" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="stable">stable</SelectItem>
                <SelectItem value="pre-release">pre-release</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ToggleRow id="g-notify-release" label="Notify on new release"
            hint="Desktop notification when a new release is available."
            checked={g.notifyOnNewRelease} onChange={(v) => update({ notifyOnNewRelease: v })}
            disabled={!g.checkForReleases} />
          <ToggleRow id="g-notify-crash" label="Notify on instance crash"
            hint="Alert when a server exits unexpectedly."
            checked={g.notifyOnCrash} onChange={(v) => update({ notifyOnCrash: v })} />
          <ToggleRow id="g-notify-mem" label="Notify on high memory usage"
            hint="Alert when VRAM usage exceeds 90%."
            checked={g.notifyOnHighMemory} onChange={(v) => update({ notifyOnHighMemory: v })} />
        </div>
      </SectionCard>

      <SectionCard icon={<Info className="size-4" />} title="About" className="lg:col-span-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
              <span className="text-base font-bold">L</span>
            </div>
            <div>
              <div className="text-[13px] font-semibold text-foreground">LlamaLauncher</div>
              <div className="text-xs text-muted-foreground">Version 0.4.2 · llama.cpp build b4402</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="https://github.com/ggerganov/llama.cpp" target="_blank" rel="noreferrer">
                <Github className="mr-1.5 size-3.5" />llama.cpp<ExternalLink className="ml-1.5 size-3" />
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="https://github.com/ggerganov/llama.cpp/blob/master/docs/server.md" target="_blank" rel="noreferrer">
                Server docs<ExternalLink className="ml-1.5 size-3" />
              </a>
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ---------- New workspace dialog ----------
function NewWorkspaceDialog({ open, onOpenChange }: {
  open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const addWorkspace = useLlamaStore((s) => s.addWorkspace);
  const setActiveWorkspace = useLlamaStore((s) => s.setActiveWorkspace);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [color, setColor] = React.useState<Workspace["color"]>("green");

  React.useEffect(() => {
    if (open) { setName(""); setDescription(""); setColor("green"); }
  }, [open]);

  const submit = () => {
    if (!name.trim()) return;
    const id = addWorkspace({ name: name.trim(), description, color });
    setActiveWorkspace(id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a new workspace</DialogTitle>
          <DialogDescription>
            Workspaces isolate instances, models, profiles and releases.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-ws-name">Name</Label>
            <Input id="new-ws-name" autoFocus placeholder="e.g. Research Lab" value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-ws-desc">Description</Label>
            <Textarea id="new-ws-desc" rows={2} placeholder="Optional — what is this workspace for?"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <ColorSwatchPicker value={color} onChange={setColor} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!name.trim()}>
            <Plus className="mr-1.5 size-3.5" />Create workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const DEFAULT_WS_SETTINGS: WorkspaceSettings = {
  hibernateAfterSec: 0, defaultGpuLayers: 99, defaultThreads: 8,
  autoCalibrate: true, maxConcurrentInstances: 4,
};

function fmtHibernation(sec: number) {
  if (sec <= 0) return "Disabled";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60); const s = sec % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

// ---------- Workspace settings tab ----------
function WorkspaceSettingsTab() {
  const workspaces = useLlamaStore((s) => s.workspaces);
  const activeId = useLlamaStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useLlamaStore((s) => s.setActiveWorkspace);
  const wsSettingsMap = useLlamaStore((s) => s.workspaceSettings);
  const updateWorkspace = useLlamaStore((s) => s.updateWorkspace);
  const updateWorkspaceSettings = useLlamaStore((s) => s.updateWorkspaceSettings);
  const removeWorkspace = useLlamaStore((s) => s.removeWorkspace);
  const instances = useLlamaStore((s) => s.instances);
  const profiles = useLlamaStore((s) => s.profiles);
  const models = useLlamaStore((s) => s.models);
  const releases = useLlamaStore((s) => s.releases);

  const [newWsOpen, setNewWsOpen] = React.useState(false);
  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];
  const wsSettings: WorkspaceSettings = wsSettingsMap[active?.id] ?? DEFAULT_WS_SETTINGS;

  if (!active) {
    return (
      <div className="rounded-xl border border-border/60 bg-card">
        <div className="py-10 text-center text-sm text-muted-foreground">
          No workspaces available.
        </div>
      </div>
    );
  }

  const instanceCount = instances.filter((i) => i.workspaceId === active.id).length;
  const modelCount = models.filter((m) => m.workspaceId === active.id).length;
  const profileCount = profiles.filter((p) => p.workspaceId === active.id || p.workspaceId === null).length;
  const releaseCount = releases.filter((r) => (r.workspaceId === active.id || r.workspaceId === null) && r.installed).length;
  const isLastWorkspace = workspaces.length <= 1;

  const setWsNum = (key: keyof WorkspaceSettings, raw: string) => {
    const n = Number(raw);
    updateWorkspaceSettings(active.id, { [key]: Number.isFinite(n) ? n : 0 } as Partial<WorkspaceSettings>);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/60 bg-card">
        <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Editing</Label>
            <Select value={active.id} onValueChange={setActiveWorkspace}>
              <SelectTrigger className="w-full sm:w-72">
                <span className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", WS_DOT[active.color])} />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    <span className="flex items-center gap-2">
                      <span className={cn("size-2 rounded-full", WS_DOT[w.color])} />{w.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {active.description && (
              <span className="line-clamp-1 text-xs text-muted-foreground">{active.description}</span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setNewWsOpen(true)}>
            <Plus className="mr-1.5 size-3.5" />New workspace
          </Button>
        </div>
      </div>

      <NewWorkspaceDialog open={newWsOpen} onOpenChange={setNewWsOpen} />

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard icon={<SettingsIcon className="size-4" />} title="Workspace identity"
          description={`Editing: ${active.name}`}>
          <FieldRow id="ws-name" label="Name" hint="Display name in the sidebar">
            <Input id="ws-name" value={active.name}
              onChange={(e) => updateWorkspace(active.id, { name: e.target.value })} />
          </FieldRow>
          <div className="space-y-1.5">
            <Label htmlFor="ws-desc" className="text-sm font-medium">Description</Label>
            <Textarea id="ws-desc" rows={2} placeholder="What is this workspace for?"
              value={active.description ?? ""}
              onChange={(e) => updateWorkspace(active.id, { description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Color</Label>
            <ColorSwatchPicker value={active.color} onChange={(c) => updateWorkspace(active.id, { color: c })} />
          </div>
        </SectionCard>

        <SectionCard icon={<Moon className="size-4" />} title="Hibernation"
          description="Auto-unload idle models from VRAM; hot-reload on the next request.">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Hibernate after</div>
              <div className="text-3xl font-bold tabular-nums">{fmtHibernation(wsSettings.hibernateAfterSec)}</div>
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 font-mono text-[11px]">
              <Clock className="size-3" />{wsSettings.hibernateAfterSec}s
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-hib-input" className="text-xs text-muted-foreground">Seconds idle (0–600)</Label>
            <Input id="ws-hib-input" type="number" min={0} max={600} step={5}
              value={wsSettings.hibernateAfterSec}
              onChange={(e) => setWsNum("hibernateAfterSec", e.target.value)} className="font-mono text-sm" />
          </div>
          <Slider
            value={[Math.min(Math.max(wsSettings.hibernateAfterSec, 0), 600)]}
            min={0} max={600} step={5}
            onValueChange={(v) => updateWorkspaceSettings(active.id, { hibernateAfterSec: v[0] ?? 0 })}
          />
          <p className="text-xs text-muted-foreground">Set to 0 to disable auto-hibernation.</p>
          {wsSettings.hibernateAfterSec <= 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>Hibernation is disabled. Idle models stay loaded in VRAM until manually stopped.</span>
            </div>
          )}
        </SectionCard>

        <SectionCard icon={<Cpu className="size-4" />} title="Defaults"
          description="Applied when creating new instances in this workspace.">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow id="ws-gpu-layers" label="GPU layers" hint="Default -ngl">
              <Input id="ws-gpu-layers" type="number" min={0}
                value={wsSettings.defaultGpuLayers}
                onChange={(e) => setWsNum("defaultGpuLayers", e.target.value)} className="font-mono text-sm" />
            </FieldRow>
            <FieldRow id="ws-threads" label="Threads" hint="Default -t">
              <Input id="ws-threads" type="number" min={1}
                value={wsSettings.defaultThreads}
                onChange={(e) => setWsNum("defaultThreads", e.target.value)} className="font-mono text-sm" />
            </FieldRow>
          </div>
          <FieldRow id="ws-max-instances" label="Max concurrent instances" hint="Upper bound for running instances">
            <Input id="ws-max-instances" type="number" min={1}
              value={wsSettings.maxConcurrentInstances}
              onChange={(e) => setWsNum("maxConcurrentInstances", e.target.value)} className="font-mono text-sm" />
          </FieldRow>
          <ToggleRow id="ws-auto-calibrate" label="Auto-calibrate profiles"
            hint="Run a short benchmark to score new profiles."
            checked={wsSettings.autoCalibrate}
            onChange={(v) => updateWorkspaceSettings(active.id, { autoCalibrate: v })} />
        </SectionCard>

        <SectionCard icon={<Boxes className="size-4" />} title="Workspace resources"
          description="Read-only counts derived from the store for the active workspace.">
          <div className="grid grid-cols-2 gap-3">
            <ResourceStat icon={<Server className="size-3.5" />} label="Instances" value={instanceCount} />
            <ResourceStat icon={<Layers className="size-3.5" />} label="Profiles" value={profileCount} hint="includes global" />
            <ResourceStat icon={<Package className="size-3.5" />} label="Models" value={modelCount} />
            <ResourceStat icon={<Package className="size-3.5" />} label="Installed releases" value={releaseCount} hint="includes global" />
          </div>
        </SectionCard>
      </div>

      <div className="rounded-xl border border-red-200/70 bg-card dark:border-red-900/40">
        <div className="pb-3">
          <h3 className="flex items-center gap-2 text-[13px] font-semibold text-red-600 dark:text-red-400">
            <AlertTriangle className="size-4" />Danger zone
          </h3>
          <p className="text-[11px] text-muted-foreground">Irreversible actions affecting this workspace.</p>
        </div>
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium">Delete this workspace</div>
              <p className="text-xs text-muted-foreground">
                Removes the workspace and all of its instances and models. This cannot be undone.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isLastWorkspace}
                  title={isLastWorkspace ? "You must keep at least one workspace." : undefined}>
                  <Trash2 className="mr-1.5 size-3.5" />Delete workspace
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete &quot;{active.name}&quot;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove the workspace along with {instanceCount} instance{instanceCount === 1 ? "" : "s"} and {modelCount} model{modelCount === 1 ? "" : "s"}. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                    onClick={() => removeWorkspace(active.id)}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Page ----------
export function SettingsPage() {
  const [tab, setTab] = React.useState<"global" | "workspace">("global");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-[12px] text-muted-foreground">
          Global paths, updates and notifications — plus per-workspace defaults and hibernation.
        </p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as "global" | "workspace")}>
        <TabsList>
          <TabsTrigger value="global"><SettingsIcon className="size-3.5" />Global</TabsTrigger>
          <TabsTrigger value="workspace"><Boxes className="size-3.5" />Workspace</TabsTrigger>
        </TabsList>
        <TabsContent value="global" className="mt-6 outline-none"><GlobalSettingsTab /></TabsContent>
        <TabsContent value="workspace" className="mt-6 outline-none"><WorkspaceSettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
