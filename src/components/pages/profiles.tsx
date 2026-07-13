"use client";

import * as React from "react";
import { cn, hashStr } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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

/** Deterministic calibration radar data derived from profile id hash. */
function deriveCalibration(id: string) {
  const score = useLlamaStore.getState().profiles.find((p) => p.id === id)?.calibrationScore ?? 0;
  const dims = ["speed", "memory", "quality", "stability", "throughput"] as const;
  return dims.map((dim) => ({ dim, value: score }));
}

// ---------- small bits ----------

function StatPill({ icon, label, value }: {
  icon: React.ReactNode; label: string; value: string;
}) {
  return (
    <Card className="rounded-lg border bg-muted/40 p-0 shadow-none">
      <CardContent className="flex items-center gap-2 p-2.5">
        <span className="grid size-6 place-items-center rounded-md bg-background text-primary">{icon}</span>
        <div className="leading-tight">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-xs font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
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
      className="group cursor-pointer p-0 shadow-none transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Cpu className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[13px] font-semibold text-foreground">{profile.name}</h3>
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
          <Button size="sm" variant="outline" className="flex-1 gap-1.5"
            onClick={onCalibrate} disabled={calibrating}>
            <Wand2 className={cn("size-3.5", calibrating && "animate-spin")} />
            {calibrating ? "Calibrating…" : "Auto-calibrate"}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5"
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
    <Card className="p-0">
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
                  <Button size="sm" variant="ghost" className="px-2"
                    onClick={(e) => onCalib(e, p)} disabled={busy === p.id}>
                    <Wand2 className={cn("mr-1 size-3", busy === p.id && "animate-spin")} />
                    Calib
                  </Button>
                  <Button size="sm" variant="ghost" className="px-2" onClick={(e) => onShare(e, p)}>
                    <Share2 className="size-3" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ---------- detail view ----------

function DetailCard({ title, action, children }: {
  title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 py-5">
      {(title || action) && (
        <CardHeader className="px-5 pt-0 pb-3">
          {title && <CardTitle className="text-[13px]">{title}</CardTitle>}
          {action}
        </CardHeader>
      )}
      <CardContent className="px-5 pt-0">
        {children}
      </CardContent>
    </Card>
  );
}

function ParamTile({ icon, label, value }: {
  icon: React.ReactNode; label: string; value: string;
}) {
  return (
    <Card className="rounded-lg border bg-muted/30 p-0 shadow-none">
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {icon} {label}
        </div>
        <div className="mt-1 font-mono text-sm font-semibold">{value}</div>
      </CardContent>
    </Card>
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
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5 size-3.5" /> Back
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* ---------- main column ---------- */}
        <div className="space-y-5">
          {/* Header */}
          <Card className="py-0">
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
              <Card className="mt-4 rounded-lg border bg-muted/40 p-0 shadow-none">
                <CardContent className="px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    <Terminal className="size-3" /> Extra args
                  </div>
                  <p className="mt-1 font-mono text-xs text-foreground/80">{profile.extraArgs}</p>
                </CardContent>
              </Card>
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

  // Basic
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [scope, setScope] = React.useState<ProfileScope>("global");
  const [modelId, setModelId] = React.useState("");

  // Core
  const [ctxSize, setCtxSize] = React.useState("8192");
  const [threads, setThreads] = React.useState("8");
  const [gpuLayers, setGpuLayers] = React.useState("99");
  const [flashAttention, setFlashAttention] = React.useState(true);

  // Server
  const [port, setPort] = React.useState("8080");
  const [host, setHost] = React.useState("127.0.0.1");
  const [parallel, setParallel] = React.useState("-1");
  const [contBatching, setContBatching] = React.useState(true);
  const [nPredict, setNPredict] = React.useState("-1");
  const [timeout, setTimeout_] = React.useState("3600");
  const [metrics, setMetrics] = React.useState(false);
  const [apiKey, setApiKey] = React.useState("");

  // Performance
  const [threadsBatch, setThreadsBatch] = React.useState("-1");
  const [batchSize, setBatchSize] = React.useState("2048");
  const [ubatchSize, setUbatchSize] = React.useState("512");
  const [cacheTypeK, setCacheTypeK] = React.useState("f16");
  const [cacheTypeV, setCacheTypeV] = React.useState("f16");
  const [splitMode, setSplitMode] = React.useState("layer");
  const [tensorSplit, setTensorSplit] = React.useState("");
  const [mainGpu, setMainGpu] = React.useState("0");
  const [kvOffload, setKvOffload] = React.useState(true);
  const [fit, setFit] = React.useState(true);
  const [mmap, setMmap] = React.useState(true);
  const [mlock, setMlock] = React.useState(false);
  const [numa, setNuma] = React.useState(false);

  // Sampling
  const [temperature, setTemperature] = React.useState("0.8");
  const [topK, setTopK] = React.useState("40");
  const [topP, setTopP] = React.useState("0.95");
  const [minP, setMinP] = React.useState("0.05");
  const [repeatPenalty, setRepeatPenalty] = React.useState("1.1");
  const [repeatLastN, setRepeatLastN] = React.useState("64");
  const [presencePenalty, setPresencePenalty] = React.useState("0");
  const [frequencyPenalty, setFrequencyPenalty] = React.useState("0");
  const [seed, setSeed] = React.useState("-1");

  // Advanced
  const [lora, setLora] = React.useState("");
  const [mmproj, setMmproj] = React.useState("");
  const [jinja, setJinja] = React.useState(true);
  const [reasoningFormat, setReasoningFormat] = React.useState("auto");
  const [reasoningBudget, setReasoningBudget] = React.useState("-1");
  const [chatTemplate, setChatTemplate] = React.useState("");
  const [ropeScaling, setRopeScaling] = React.useState("");
  const [ropeScale, setRopeScale] = React.useState("0");
  const [ropeFreqBase, setRopeFreqBase] = React.useState("0");
  const [ropeFreqScale, setRopeFreqScale] = React.useState("0");
  const [grammar, setGrammar] = React.useState("");
  const [jsonSchema, setJsonSchema] = React.useState("");
  const [logLevel, setLogLevel] = React.useState("3");
  const [extraArgs, setExtraArgs] = React.useState("");

  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const toggleSection = (s: string) => setOpenSections((p) => ({ ...p, [s]: !p[s] }));

  const clearError = (k: string) => setErrors((p) => { const n = { ...p }; delete n[k]; return n; });

  React.useEffect(() => {
    if (!open) return;
    setName(""); setDescription(""); setScope("global"); setModelId(models[0]?.id ?? "");
    setCtxSize("8192"); setThreads("8"); setGpuLayers("99"); setFlashAttention(true);
    setPort("8080"); setHost("127.0.0.1"); setParallel("-1"); setContBatching(true);
    setNPredict("-1"); setTimeout_("3600"); setMetrics(false); setApiKey("");
    setThreadsBatch("-1"); setBatchSize("2048"); setUbatchSize("512");
    setCacheTypeK("f16"); setCacheTypeV("f16"); setSplitMode("layer"); setTensorSplit("");
    setMainGpu("0"); setKvOffload(true); setFit(true); setMmap(true); setMlock(false); setNuma(false);
    setTemperature("0.8"); setTopK("40"); setTopP("0.95"); setMinP("0.05");
    setRepeatPenalty("1.1"); setRepeatLastN("64"); setPresencePenalty("0"); setFrequencyPenalty("0"); setSeed("-1");
    setLora(""); setMmproj(""); setJinja(true); setReasoningFormat("auto"); setReasoningBudget("-1");
    setChatTemplate(""); setRopeScaling(""); setRopeScale("0"); setRopeFreqBase("0"); setRopeFreqScale("0");
    setGrammar(""); setJsonSchema(""); setLogLevel("3"); setExtraArgs("");
    setErrors({}); setOpenSections({});
  }, [open]);

  const v = {
    name: () => { if (!name.trim()) return "Required"; if (name.trim().length > 100) return "Max 100 chars"; return ""; },
    ctxSize: () => { const n = Number(ctxSize); if (!ctxSize || isNaN(n) || !Number.isInteger(n) || n < 512 || n > 1048576) return "512–1,048,576"; return ""; },
    threads: () => { const n = Number(threads); if (!threads || isNaN(n) || !Number.isInteger(n) || n < 1 || n > 128) return "1–128"; return ""; },
    gpuLayers: () => { const n = Number(gpuLayers); if (gpuLayers !== "" && (isNaN(n) || !Number.isInteger(n) || n < -1 || n > 128)) return "-1–128"; return ""; },
    port: () => { const n = Number(port); if (!port || isNaN(n) || !Number.isInteger(n) || n < 1024 || n > 65535) return "1024–65535"; return ""; },
    host: () => { if (!host.trim()) return "Required"; return ""; },
    parallel: () => { const n = Number(parallel); if (parallel !== "" && (isNaN(n) || !Number.isInteger(n) || n < -1 || n > 128)) return "-1–128"; return ""; },
    nPredict: () => { const n = Number(nPredict); if (nPredict !== "" && (isNaN(n) || !Number.isInteger(n) || n < -1 || n > 100000)) return "-1–100,000"; return ""; },
    timeout: () => { const n = Number(timeout); if (!timeout || isNaN(n) || n < 1 || n > 86400) return "1–86400"; return ""; },
    threadsBatch: () => { const n = Number(threadsBatch); if (threadsBatch !== "" && (isNaN(n) || !Number.isInteger(n) || n < -1 || n > 128)) return "-1–128"; return ""; },
    batchSize: () => { const n = Number(batchSize); if (!batchSize || isNaN(n) || !Number.isInteger(n) || n < 1 || n > 1048576) return "1–1,048,576"; return ""; },
    ubatchSize: () => { const n = Number(ubatchSize); if (!ubatchSize || isNaN(n) || !Number.isInteger(n) || n < 1 || n > 1048576) return "1–1,048,576"; return ""; },
    mainGpu: () => { const n = Number(mainGpu); if (mainGpu !== "" && (isNaN(n) || !Number.isInteger(n) || n < 0)) return "≥0"; return ""; },
    temperature: () => { const n = Number(temperature); if (temperature !== "" && (isNaN(n) || n < 0 || n > 2)) return "0–2"; return ""; },
    topK: () => { const n = Number(topK); if (topK !== "" && (isNaN(n) || !Number.isInteger(n) || n < 0 || n > 1000)) return "0–1000"; return ""; },
    topP: () => { const n = Number(topP); if (topP !== "" && (isNaN(n) || n < 0 || n > 1)) return "0–1"; return ""; },
    minP: () => { const n = Number(minP); if (minP !== "" && (isNaN(n) || n < 0 || n > 1)) return "0–1"; return ""; },
    repeatPenalty: () => { const n = Number(repeatPenalty); if (repeatPenalty !== "" && (isNaN(n) || n < 1 || n > 2)) return "1–2"; return ""; },
    repeatLastN: () => { const n = Number(repeatLastN); if (repeatLastN !== "" && (isNaN(n) || !Number.isInteger(n) || n < -1 || n > 1048576)) return "-1–1,048,576"; return ""; },
    presencePenalty: () => { const n = Number(presencePenalty); if (presencePenalty !== "" && (isNaN(n) || n < 0 || n > 2)) return "0–2"; return ""; },
    frequencyPenalty: () => { const n = Number(frequencyPenalty); if (frequencyPenalty !== "" && (isNaN(n) || n < 0 || n > 2)) return "0–2"; return ""; },
    seed: () => { const n = Number(seed); if (seed !== "" && (isNaN(n) || !Number.isInteger(n) || n < -1)) return "-1 = random"; return ""; },
    reasoningBudget: () => { const n = Number(reasoningBudget); if (reasoningBudget !== "" && (isNaN(n) || !Number.isInteger(n) || n < -1 || n > 100000)) return "-1–100,000"; return ""; },
    ropeScale: () => { const n = Number(ropeScale); if (ropeScale !== "" && (isNaN(n) || n < 0)) return "≥0"; return ""; },
    ropeFreqBase: () => { const n = Number(ropeFreqBase); if (ropeFreqBase !== "" && (isNaN(n) || n < 0)) return "≥0"; return ""; },
    ropeFreqScale: () => { const n = Number(ropeFreqScale); if (ropeFreqScale !== "" && (isNaN(n) || n < 0)) return "≥0"; return ""; },
    logLevel: () => { const n = Number(logLevel); if (logLevel !== "" && (isNaN(n) || !Number.isInteger(n) || n < 0 || n > 5)) return "0–5"; return ""; },
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    for (const [k, fn] of Object.entries(v)) { const e = fn(); if (e) errs[k] = e; }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    const num = (s: string, d: number) => { const n = Number(s); return isNaN(n) ? d : n; };
    addProfile({
      name: name.trim(), description: description.trim() || "Custom profile",
      ctxSize: num(ctxSize, 8192), threads: num(threads, 8), gpuLayers: num(gpuLayers, -1), flashAttention,
      port: num(port, 8080), host: host.trim() || "127.0.0.1",
      parallel: num(parallel, -1), contBatching, nPredict: num(nPredict, -1),
      timeout: num(timeout, 3600), metrics, apiKey: apiKey.trim(),
      threadsBatch: num(threadsBatch, -1), batchSize: num(batchSize, 2048), ubatchSize: num(ubatchSize, 512),
      cacheTypeK, cacheTypeV, splitMode, tensorSplit: tensorSplit.trim(),
      mainGpu: num(mainGpu, 0), kvOffload, fit, mmap, mlock, numa,
      temperature: num(temperature, 0.8), topK: num(topK, 40), topP: num(topP, 0.95), minP: num(minP, 0.05),
      repeatPenalty: num(repeatPenalty, 1.1), repeatLastN: num(repeatLastN, 64),
      presencePenalty: num(presencePenalty, 0), frequencyPenalty: num(frequencyPenalty, 0), seed: num(seed, -1),
      lora: lora.trim(), mmproj: mmproj.trim(), jinja,
      reasoningFormat, reasoningBudget: num(reasoningBudget, -1),
      chatTemplate: chatTemplate.trim(), ropeScaling, ropeScale: num(ropeScale, 0),
      ropeFreqBase: num(ropeFreqBase, 0), ropeFreqScale: num(ropeFreqScale, 0),
      grammar: grammar.trim(), jsonSchema: jsonSchema.trim(), logLevel: num(logLevel, 3),
      extraArgs: extraArgs.trim(), scope,
      modelId: scope === "model" ? modelId : undefined,
      calibrationScore: 70 + ((hashStr(name) & 0xf) % 15),
      workspaceId: scope === "global" ? null : activeWorkspaceId,
    });
    setOpen(false);
  };

  const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
    <div className="rounded-lg border">
      <button type="button" onClick={() => toggleSection(id)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50">
        {title}
        <span className="text-muted-foreground text-xs">{openSections[id] ? "▲" : "▼"}</span>
      </button>
      {openSections[id] && <div className="border-t px-3 py-3 space-y-3">{children}</div>}
    </div>
  );

  const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );

  const NumInput = ({ value, onChange, error, placeholder, ...props }: { value: string; onChange: (v: string) => void; error?: string; placeholder?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) => (
    <Input type="number" value={value} placeholder={placeholder}
      onChange={(e) => { onChange(e.target.value); }}
      className={cn("h-8 text-xs", error && "border-red-500")} {...props} />
  );

  const SW = ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) => (
    <Switch checked={checked} onCheckedChange={onCheckedChange} />
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1.5 size-3.5" /> New Profile</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New launch profile</DialogTitle>
          <DialogDescription>Configure all llama-server parameters. Unchanged fields use system defaults.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {/* Basic */}
          <div className="grid gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="prof-name">Name</Label>
              <Input id="prof-name" placeholder="e.g. Balanced" value={name}
                onChange={(e) => { setName(e.target.value); clearError("name"); }}
                className={cn("h-8 text-xs", errors.name && "border-red-500")} />
              {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="prof-desc">Description</Label>
              <Input id="prof-desc" placeholder="Short note" value={description}
                onChange={(e) => setDescription(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="grid gap-1.5">
              <Label>Scope</Label>
              <div className="grid grid-cols-2 gap-2">
                <ScopeOption active={scope === "global"} onClick={() => setScope("global")}
                  icon={<Globe className="size-3.5 text-sky-500" />} label="Global" desc="All models" />
                <ScopeOption active={scope === "model"} onClick={() => setScope("model")}
                  icon={<Boxes className="size-3.5 text-violet-500" />} label="Model-bound" desc="One model" />
              </div>
            </div>
            {scope === "model" && (
              <div className="grid gap-1.5">
                <Label>Bound model</Label>
                <Select value={modelId} onValueChange={setModelId}>
                  <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Separator />

          {/* Core */}
          <div className="grid grid-cols-4 gap-3">
            <Field label="Context size" error={errors.ctxSize}>
              <NumInput value={ctxSize} onChange={setCtxSize} error={errors.ctxSize} placeholder="8192" />
            </Field>
            <Field label="Threads" error={errors.threads}>
              <NumInput value={threads} onChange={setThreads} error={errors.threads} placeholder="8" />
            </Field>
            <Field label="GPU layers" error={errors.gpuLayers}>
              <NumInput value={gpuLayers} onChange={setGpuLayers} error={errors.gpuLayers} placeholder="-1" />
            </Field>
            <Field label="Flash attn">
              <div className="flex items-center h-8"><SW checked={flashAttention} onCheckedChange={setFlashAttention} /></div>
            </Field>
          </div>

          <Separator />

          {/* Server */}
          <Section id="server" title="Server">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Port" error={errors.port}>
                <NumInput value={port} onChange={setPort} error={errors.port} />
              </Field>
              <Field label="Host" error={errors.host}>
                <Input value={host} onChange={(e) => { setHost(e.target.value); clearError("host"); }}
                  className={cn("h-8 text-xs", errors.host && "border-red-500")} />
              </Field>
              <Field label="Parallel slots" error={errors.parallel}>
                <NumInput value={parallel} onChange={setParallel} error={errors.parallel} placeholder="-1 = auto" />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Max predict (-1=∞)" error={errors.nPredict}>
                <NumInput value={nPredict} onChange={setNPredict} error={errors.nPredict} />
              </Field>
              <Field label="Timeout (sec)" error={errors.timeout}>
                <NumInput value={timeout} onChange={(s) => setTimeout_(s)} error={errors.timeout} />
              </Field>
              <div className="grid gap-1.5">
                <Label className="text-xs">Options</Label>
                <div className="flex items-center gap-4 h-8">
                  <label className="flex items-center gap-1.5 text-xs"><SW checked={contBatching} onCheckedChange={setContBatching} /> Cont. batching</label>
                  <label className="flex items-center gap-1.5 text-xs"><SW checked={metrics} onCheckedChange={setMetrics} /> Metrics</label>
                </div>
              </div>
            </div>
            <Field label="API key">
              <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="optional" className="h-8 text-xs font-mono" />
            </Field>
          </Section>

          {/* Performance */}
          <Section id="perf" title="Performance & Memory">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Threads batch (-1=same)" error={errors.threadsBatch}>
                <NumInput value={threadsBatch} onChange={setThreadsBatch} error={errors.threadsBatch} />
              </Field>
              <Field label="Batch size" error={errors.batchSize}>
                <NumInput value={batchSize} onChange={setBatchSize} error={errors.batchSize} />
              </Field>
              <Field label="Ubatch size" error={errors.ubatchSize}>
                <NumInput value={ubatchSize} onChange={setUbatchSize} error={errors.ubatchSize} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Cache type K">
                <Select value={cacheTypeK} onValueChange={setCacheTypeK}>
                  <SelectTrigger className="w-full h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["f32","f16","bf16","q8_0","q4_0","q4_1","iq4_nl","q5_0","q5_1"].map((t) =>
                      <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Cache type V">
                <Select value={cacheTypeV} onValueChange={setCacheTypeV}>
                  <SelectTrigger className="w-full h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["f32","f16","bf16","q8_0","q4_0","q4_1","iq4_nl","q5_0","q5_1"].map((t) =>
                      <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Split mode">
                <Select value={splitMode} onValueChange={setSplitMode}>
                  <SelectTrigger className="w-full h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["layer","row","tensor","none"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Tensor split" error={errors.mainGpu}>
                <Input value={tensorSplit} onChange={(e) => setTensorSplit(e.target.value)} placeholder="e.g. 3,1" className="h-8 text-xs font-mono" />
              </Field>
              <Field label="Main GPU" error={errors.mainGpu}>
                <NumInput value={mainGpu} onChange={setMainGpu} error={errors.mainGpu} />
              </Field>
              <div className="grid gap-1.5">
                <Label className="text-xs">Flags</Label>
                <div className="flex flex-wrap items-center gap-3 h-8">
                  {([["KV offload", kvOffload, setKvOffload], ["Fit", fit, setFit], ["mmap", mmap, setMmap], ["mlock", mlock, setMlock], ["NUMA", numa, setNuma]] as const).map(([l, v, s]) =>
                    <label key={l} className="flex items-center gap-1.5 text-xs"><SW checked={v} onCheckedChange={s} /> {l}</label>)}
                </div>
              </div>
            </div>
          </Section>

          {/* Sampling */}
          <Section id="sampling" title="Sampling">
            <div className="grid grid-cols-4 gap-3">
              <Field label="Temperature" error={errors.temperature}>
                <NumInput value={temperature} onChange={setTemperature} error={errors.temperature} />
              </Field>
              <Field label="Top K" error={errors.topK}>
                <NumInput value={topK} onChange={setTopK} error={errors.topK} />
              </Field>
              <Field label="Top P" error={errors.topP}>
                <NumInput value={topP} onChange={setTopP} error={errors.topP} />
              </Field>
              <Field label="Min P" error={errors.minP}>
                <NumInput value={minP} onChange={setMinP} error={errors.minP} />
              </Field>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <Field label="Repeat penalty" error={errors.repeatPenalty}>
                <NumInput value={repeatPenalty} onChange={setRepeatPenalty} error={errors.repeatPenalty} />
              </Field>
              <Field label="Repeat last N" error={errors.repeatLastN}>
                <NumInput value={repeatLastN} onChange={setRepeatLastN} error={errors.repeatLastN} />
              </Field>
              <Field label="Presence penalty" error={errors.presencePenalty}>
                <NumInput value={presencePenalty} onChange={setPresencePenalty} error={errors.presencePenalty} />
              </Field>
              <Field label="Frequency penalty" error={errors.frequencyPenalty}>
                <NumInput value={frequencyPenalty} onChange={setFrequencyPenalty} error={errors.frequencyPenalty} />
              </Field>
            </div>
            <Field label="Seed (-1=random)" error={errors.seed}>
              <NumInput value={seed} onChange={setSeed} error={errors.seed} />
            </Field>
          </Section>

          {/* Advanced */}
          <Section id="advanced" title="Advanced">
            <div className="grid grid-cols-2 gap-3">
              <Field label="LoRA path">
                <Input value={lora} onChange={(e) => setLora(e.target.value)} placeholder="optional" className="h-8 text-xs font-mono" />
              </Field>
              <Field label="MMProj path">
                <Input value={mmproj} onChange={(e) => setMmproj(e.target.value)} placeholder="optional" className="h-8 text-xs font-mono" />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Reasoning format">
                <Select value={reasoningFormat} onValueChange={setReasoningFormat}>
                  <SelectTrigger className="w-full h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["auto","none","deepseek","deepseek-legacy"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Reasoning budget (-1=∞)" error={errors.reasoningBudget}>
                <NumInput value={reasoningBudget} onChange={setReasoningBudget} error={errors.reasoningBudget} />
              </Field>
              <Field label="Log level (0-5)" error={errors.logLevel}>
                <NumInput value={logLevel} onChange={setLogLevel} error={errors.logLevel} />
              </Field>
            </div>
            <Field label="Chat template">
              <Input value={chatTemplate} onChange={(e) => setChatTemplate(e.target.value)} placeholder="e.g. chatml, llama3" className="h-8 text-xs font-mono" />
            </Field>
            <div className="grid grid-cols-4 gap-3">
              <Field label="RoPE scaling">
                <Select value={ropeScaling} onValueChange={setRopeScaling}>
                  <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="default" /></SelectTrigger>
                  <SelectContent>
                    {["","none","linear","yarn"].map((t) => <SelectItem key={t} value={t}>{t || "default"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="RoPE scale" error={errors.ropeScale}>
                <NumInput value={ropeScale} onChange={setRopeScale} error={errors.ropeScale} />
              </Field>
              <Field label="RoPE freq base" error={errors.ropeFreqBase}>
                <NumInput value={ropeFreqBase} onChange={setRopeFreqBase} error={errors.ropeFreqBase} />
              </Field>
              <Field label="RoPE freq scale" error={errors.ropeFreqScale}>
                <NumInput value={ropeFreqScale} onChange={setRopeFreqScale} error={errors.ropeFreqScale} />
              </Field>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Jinja templates</Label>
              <div className="flex items-center h-8"><SW checked={jinja} onCheckedChange={setJinja} /></div>
            </div>
            <Field label="Grammar (BNF)">
              <Input value={grammar} onChange={(e) => setGrammar(e.target.value)} placeholder="optional BNF grammar" className="h-8 text-xs font-mono" />
            </Field>
            <Field label="JSON schema">
              <Input value={jsonSchema} onChange={(e) => setJsonSchema(e.target.value)} placeholder='{"type":"object",...}' className="h-8 text-xs font-mono" />
            </Field>
          </Section>

          {/* Extra args */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Extra args</Label>
            <Input value={extraArgs} onChange={(e) => setExtraArgs(e.target.value)}
              placeholder="--override-kv ... " className="h-8 text-xs font-mono" />
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
    <Card className="border-2 border-dashed border-border/60 py-0">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-accent">
          <Cpu className="size-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-[13px] font-semibold text-foreground">No profiles here</p>
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Profiles</h1>
          <p className="text-[12px] text-muted-foreground">
            Reusable llama-server argument presets · {visibleProfiles.length} total (
            {globalProfiles.length} global, {modelProfiles.length} model-bound, {sharedCount} shared)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NewProfileDialog />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <div className='flex w-full justify-between'>
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

        {mounted ? (
            <ViewToggle value={view} onChange={setView} />
        ) : (
            <div className="h-8 w-28 rounded-lg border border-border/60 bg-card" />
        )}
        </div>
        <TabsContent value={tab} className="mt-4">
          {currentList.length === 0 ? (
            <EmptyState />
          ) : view === "table" ? (
            <ProfileTable profiles={currentList} onSelect={handleSelect} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
