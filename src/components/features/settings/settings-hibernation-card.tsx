"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Moon, Clock, AlertTriangle } from "lucide-react";
import { type WorkspaceSettings } from "@/lib/llama-store";
import { fmtHibernation } from "@/components/features/settings/settings-form";

export function HibernationCard({
  wsSettings, onSetNum, onChange,
}: {
  wsSettings: WorkspaceSettings;
  onSetNum: (key: keyof WorkspaceSettings, raw: string) => void;
  onChange: (settings: Partial<WorkspaceSettings>) => void;
}) {
  return (
    <Card className="p-4">
      <CardHeader className="p-0 mb-3">
        <CardTitle className="flex items-center gap-2 text-[13px]">
          <span className="text-primary"><Moon className="size-4" /></span>
          Hibernation
        </CardTitle>
        <CardDescription>Auto-unload idle models from VRAM; hot-reload on the next request.</CardDescription>
      </CardHeader>
      <CardContent className="p-0 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Hibernate after</div>
            <div className="text-3xl font-bold tabular-nums">{fmtHibernation(wsSettings.hibernate_after_sec)}</div>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 font-mono text-[11px]">
            <Clock className="size-3" />{wsSettings.hibernate_after_sec}s
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ws-hib-input" className="text-xs text-muted-foreground">Seconds idle (0–600)</Label>
          <Input id="ws-hib-input" type="number" min={0} max={600} step={5}
            value={wsSettings.hibernate_after_sec}
            onChange={(e) => onSetNum("hibernate_after_sec", e.target.value)} className="font-mono text-sm h-8" />
        </div>
        <Slider
          value={[Math.min(Math.max(wsSettings.hibernate_after_sec, 0), 600)]}
          min={0} max={600} step={5}
          onValueChange={(v) => onChange({ hibernate_after_sec: v[0] ?? 0 })}
        />
        <p className="text-xs text-muted-foreground">Set to 0 to disable auto-hibernation.</p>
        {wsSettings.hibernate_after_sec <= 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>Hibernation is disabled. Idle models stay loaded in VRAM until manually stopped.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
