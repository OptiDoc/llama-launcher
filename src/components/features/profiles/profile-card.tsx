"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useLlamaStore, type LlamaProfile } from "@/lib/llama-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Cpu, Gauge, Zap, Layers, Flashlight, Terminal, Sparkles, Wand2, Link2, Check } from "lucide-react";
import { ScopeBadge, SharedBadge, StatPill } from "./profiles-badges";

function ProfileCard({ profile, onSelect }: { profile: LlamaProfile; onSelect: (id: string) => void }) {
  const shareProfile = useLlamaStore((s) => s.shareProfile);
  const calibrateProfile = useLlamaStore((s) => s.calibrateProfile);
  const models = useLlamaStore((s) => s.models);
  const [calibrating, setCalibrating] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const boundModel = models.find((m) => m.id === profile.modelId);

  const onCalibrate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCalibrating(true);
    setTimeout(() => {
      calibrateProfile(profile.id);
      setCalibrating(false);
    }, 1400);
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
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(profile.id);
        }
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
          <StatPill
            icon={<Flashlight className="size-3.5" />}
            label="Flash attn"
            value={profile.flashAttention ? "Yes" : "No"}
          />
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
              <span className="flex items-center gap-1">
                <Sparkles className="size-3" /> Auto-calibration
              </span>
              <span className="font-mono font-semibold">{profile.calibrationScore}/100</span>
            </div>
            <Progress value={profile.calibrationScore} className="h-1.5" />
          </div>
        )}

        <div className="flex items-center gap-2 pt-1" onClick={stop}>
          <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={onCalibrate} disabled={calibrating}>
            <Wand2 className={cn("size-3.5", calibrating && "animate-spin")} />
            {calibrating ? "Calibrating…" : "Auto-calibrate"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={onShare}
            title={profile.shared ? `Share ID: ${profile.shareId}` : "Share profile"}
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Link2 className="size-3.5" />}
            {copied ? "Copied" : "Share"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export { ProfileCard };
