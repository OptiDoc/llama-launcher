"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import type { Workspace } from "@/lib/llama-store";

const WORKSPACE_COLORS: Workspace["color"][] = ["green", "orange", "blue", "pink", "purple"];
const WS_DOT: Record<Workspace["color"], string> = {
  green: "bg-emerald-500", orange: "bg-amber-500", blue: "bg-sky-500", pink: "bg-rose-500", purple: "bg-violet-500",
};
const WS_RING: Record<Workspace["color"], string> = {
  green: "ring-emerald-500", orange: "ring-amber-500", blue: "ring-sky-500", pink: "ring-rose-500", purple: "ring-violet-500",
};

export function FieldRow({ id, label, hint, children }: {
  id: string; label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[220px_1fr] sm:items-center sm:gap-4">
      <div>
        <Label htmlFor={id} className="text-[13px] font-medium text-foreground">{label}</Label>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
}

export function ToggleRow({ id, label, hint, checked, onChange, disabled }: {
  id: string; label: string; hint: string; checked: boolean;
  onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-[13px] font-medium text-foreground">{label}</Label>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

export function ColorSwatchPicker({ value, onChange }: {
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

export function ResourceStat({ icon, label, value, hint }: {
  icon: React.ReactNode; label: string; value: number; hint?: string;
}) {
  return (
    <Card className="p-3">
      <CardContent className="px-0">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {icon}{label}
        </div>
        <div className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{value}</div>
        {hint && <div className="text-[10px] text-muted-foreground/80">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export { WORKSPACE_COLORS, WS_DOT, WS_RING };
