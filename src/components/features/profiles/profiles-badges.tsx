"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Globe, Boxes, Share2, Cpu } from "lucide-react";
import type { ProfileScope } from "@/lib/llama-store";

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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

function ScopeOption({
  active,
  onClick,
  icon,
  label,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-accent",
      )}
    >
      <div className="flex items-center gap-1.5 text-sm font-medium">
        {icon} {label}
      </div>
      <span className="text-[11px] text-muted-foreground">{desc}</span>
    </button>
  );
}

function DetailCard({
  title,
  action,
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 py-5">
      {(title || action) && (
        <CardHeader className="px-5 pt-0 pb-3">
          {title && <CardTitle className="text-[13px]">{title}</CardTitle>}
          {action}
        </CardHeader>
      )}
      <CardContent className="px-5 pt-0">{children}</CardContent>
    </Card>
  );
}

function ParamTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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

export { StatPill, ScopeBadge, SharedBadge, ScopeOption, DetailCard, ParamTile, EmptyState };
