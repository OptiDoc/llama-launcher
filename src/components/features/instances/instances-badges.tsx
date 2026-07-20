"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Cpu, Hash, MemoryStick, Zap, Clock, TrendingUp } from "lucide-react";
import type { InstanceStatus, LlamaInstance } from "@/lib/llama-store";

// ---------- constants ----------

const STATUS_STYLE: Record<InstanceStatus, string> = {
  running: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  starting: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  stopping: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  error: "bg-red-500/15 text-red-700 dark:text-red-300",
  stopped: "bg-muted text-muted-foreground",
  crashed: "bg-red-700/15 text-red-800 dark:text-red-200",
};

const COLOR_DOT: Record<LlamaInstance["color"], string> = {
  green: "bg-emerald-400",
  orange: "bg-orange-400",
  blue: "bg-sky-400",
  pink: "bg-rose-400",
  purple: "bg-violet-400",
};

// ---------- helpers ----------

function fmtStartedAt(startedAt?: number): string {
  if (!startedAt) return "\u2014";
  return new Date(startedAt).toLocaleString();
}

// ---------- components ----------

function StatusBadge({ status }: { status: InstanceStatus }) {
  const pulsing = status === "starting" || status === "stopping";
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1.5 text-[10px] font-semibold uppercase tracking-wide",
        STATUS_STYLE[status],
      )}
    >
      <span
        className={cn("size-1.5 rounded-full bg-current", pulsing && "animate-pulse")}
      />
      {status}
    </Badge>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="py-4">
      <CardContent>
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-foreground/55">
          {icon}
          {label}
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
        {sub && (
          <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
        )}
      </CardContent>
    </Card>
  );
}

function MetaItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function CardStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="py-0">
      <CardContent className="flex items-center gap-2 px-2.5 py-1.5">
        <span className="grid size-6 place-items-center rounded-md bg-card text-foreground/70">
          {icon}
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-[10px] font-medium uppercase tracking-wide text-foreground/55">
            {label}
          </div>
          <div className="truncate text-xs font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export {
  StatusBadge,
  StatTile,
  MetaItem,
  CardStat,
  fmtStartedAt,
  COLOR_DOT,
  STATUS_STYLE,
};
