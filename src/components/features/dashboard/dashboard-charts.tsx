"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Cpu, Activity, Gauge, Radio } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";

// ---------- Chart configs ----------

const cpuChartConfig = {
  cpu: {
    label: "CPU",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig;

const tpsChartConfig = {
  tps: {
    label: "Tokens/sec",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const utilChartConfig = {
  cpu: {
    label: "CPU",
    color: "hsl(var(--chart-4))",
  },
  ram: {
    label: "RAM",
    color: "hsl(var(--chart-3))",
  },
  gpu: {
    label: "GPU",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

// ---------- Utility ----------

function fmtClock(t: number) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

// ---------- Small components ----------

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "green" | "orange" | "blue" | "pink" | "purple";
}) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center justify-between px-4">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn("grid size-7 place-items-center rounded-lg", `card-${color}`)}>
          {icon}
        </span>
      </CardContent>
      <CardHeader className="px-4 pt-1 pb-0">
        <CardTitle className="text-2xl font-bold tracking-tight">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function LiveIndicator({ label }: { label: string }) {
  return (
    <Badge variant="secondary" className="gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
      </span>
      {label}
    </Badge>
  );
}

function MetricGauge({
  icon,
  label,
  value,
  display,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  display: string;
  color: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span style={{ color }}>{icon}</span>
          {label}
        </span>
        <span className="font-mono text-xs font-semibold">{display}</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}

export {
  cpuChartConfig,
  tpsChartConfig,
  utilChartConfig,
  fmtClock,
  StatCard,
  LiveIndicator,
  MetricGauge,
};
