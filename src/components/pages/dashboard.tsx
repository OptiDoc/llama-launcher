"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Server,
  Cpu,
  MemoryStick,
  HardDrive,
  Zap,
  Activity,
  Play,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useLlamaStore, uptimeString } from "@/lib/llama-store";

const monthlyData = [
  { name: "Jan", value: 4200 },
  { name: "Feb", value: 5100 },
  { name: "Mar", value: 4800 },
  { name: "Apr", value: 6200 },
  { name: "May", value: 7400 },
  { name: "Jun", value: 6900 },
  { name: "Jul", value: 8200 },
  { name: "Aug", value: 7600 },
  { name: "Sep", value: 9100 },
  { name: "Oct", value: 8800 },
  { name: "Nov", value: 9600 },
  { name: "Dec", value: 10200 },
];

const weeklyData = [
  { name: "Mon", views: 240 },
  { name: "Tue", views: 310 },
  { name: "Wed", views: 280 },
  { name: "Thu", views: 420 },
  { name: "Fri", views: 380 },
  { name: "Sat", views: 180 },
  { name: "Sun", views: 140 },
];

const taskDistribution = [
  { name: "Completions", value: 45, color: "var(--chart-1)" },
  { name: "Embeddings", value: 18, color: "var(--chart-2)" },
  { name: "Chat", value: 28, color: "var(--chart-3)" },
  { name: "Other", value: 9, color: "var(--chart-4)" },
];

function StatCard({
  label,
  value,
  delta,
  deltaDir,
  icon,
  color,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaDir?: "up" | "down";
  icon: React.ReactNode;
  color: "green" | "orange" | "blue" | "pink" | "purple";
}) {
  return (
    <Card className={cn("overflow-hidden border-0 shadow-sm", `card-${color}`)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="grid size-10 place-items-center rounded-xl bg-white/60 text-foreground dark:bg-black/20 dark:text-white">
            {icon}
          </div>
          {delta && (
            <Badge
              variant="secondary"
              className={cn(
                "gap-1 bg-white/60 text-xs font-medium dark:bg-black/20",
                deltaDir === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
              )}
            >
              {deltaDir === "up" ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {delta}
            </Badge>
          )}
        </div>
        <div className="mt-4">
          <div className="text-2xl font-bold tracking-tight">{value}</div>
          <div className="text-xs font-medium text-foreground/70">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function InstanceMiniCard({
  instance,
  onOpen,
}: {
  instance: ReturnType<typeof useLlamaStore.getState>["instances"][number];
  onOpen: () => void;
}) {
  const statusColor =
    instance.status === "running"
      ? "text-emerald-600 dark:text-emerald-400"
      : instance.status === "starting"
        ? "text-amber-600 dark:text-amber-400"
        : instance.status === "stopping"
          ? "text-orange-600 dark:text-orange-400"
          : "text-muted-foreground";

  return (
    <Card className={cn("border-0 shadow-sm", `card-${instance.color}`)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="grid size-10 place-items-center rounded-xl bg-white/60 dark:bg-black/20">
            <Server className="size-5" />
          </div>
          <Badge
            variant="secondary"
            className={cn("bg-white/60 text-[10px] font-semibold uppercase dark:bg-black/20", statusColor)}
          >
            {instance.status}
          </Badge>
        </div>
        <h3 className="mt-3 text-sm font-semibold">{instance.name}</h3>
        <p className="truncate text-xs text-foreground/70">{instance.model}</p>

        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-foreground/70">Port :{instance.port}</span>
            <span className="font-mono">{uptimeString(instance.startedAt)}</span>
          </div>
          <Progress
            value={instance.status === "running" ? 60 + (instance.id.charCodeAt(4) % 35) : 0}
            className="h-1.5 bg-white/40 dark:bg-black/20"
          />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex -space-x-2">
            {["A", "B", "C"].slice(0, instance.status === "running" ? 3 : 1).map((n, i) => (
              <div
                key={n}
                className="grid size-6 place-items-center rounded-full border-2 border-card bg-primary/80 text-[10px] font-semibold text-primary-foreground"
              >
                {n}
              </div>
            ))}
            {instance.status === "running" && (
              <div className="grid size-6 place-items-center rounded-full border-2 border-card bg-white/60 text-[10px] font-semibold dark:bg-black/30">
                +{instance.requestsPerMin}
              </div>
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 bg-white/60 text-xs dark:bg-black/20"
            onClick={onOpen}
          >
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const instances = useLlamaStore((s) => s.instances);
  const models = useLlamaStore((s) => s.models);
  const setActiveConsole = useLlamaStore((s) => s.setActiveConsole);
  const setConsoleOpen = useLlamaStore((s) => s.setConsoleOpen);

  const running = instances.filter((i) => i.status === "running" || i.status === "starting");
  const totalTps = running.reduce((sum, i) => sum + i.tokensPerSec, 0);
  const totalMem = running.reduce((sum, i) => sum + i.memoryMb, 0);
  const totalReq = running.reduce((sum, i) => sum + i.requestsPerMin, 0);

  const openConsole = (id: string) => {
    setActiveConsole(id);
    setConsoleOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor running llama.cpp servers, GPU utilisation and request throughput.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Activity className="mr-1.5 size-3.5" />
            Refresh
          </Button>
          <Button size="sm">
            <Plus className="mr-1.5 size-3.5" />
            New Instance
          </Button>
        </div>
      </div>

      {/* Stat cards (colored like reference) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Running Instances"
          value={String(running.length)}
          delta="+2"
          deltaDir="up"
          icon={<Server className="size-5" />}
          color="green"
        />
        <StatCard
          label="Tokens / sec"
          value={totalTps.toFixed(1)}
          delta="+12%"
          deltaDir="up"
          icon={<Zap className="size-5" />}
          color="orange"
        />
        <StatCard
          label="GPU Memory"
          value={`${(totalMem / 1024).toFixed(1)} / 12 GB`}
          delta="-3%"
          deltaDir="down"
          icon={<MemoryStick className="size-5" />}
          color="blue"
        />
        <StatCard
          label="Requests / min"
          value={String(totalReq)}
          delta="+8%"
          deltaDir="up"
          icon={<Activity className="size-5" />}
          color="pink"
        />
      </div>

      {/* Instance cards row (colored cards like reference) */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Active Instances</h2>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
            View all
          </Button>
        </div>
        {running.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-accent">
                <Server className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No running instances</p>
                <p className="text-xs text-muted-foreground">
                  Head to the Instances page and start a llama-server to see it here.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {running.slice(0, 4).map((inst) => (
              <InstanceMiniCard key={inst.id} instance={inst} onOpen={() => openConsole(inst.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Charts row (bar + line + donut like reference) */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Bar chart */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-semibold">Monthly Tokens</CardTitle>
              <p className="text-xs text-muted-foreground">Total generated per month</p>
            </div>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              <TrendingUp className="mr-1 size-3" /> 64,318
            </Badge>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    cursor={{ fill: "hsl(var(--accent))" }}
                  />
                  <Bar dataKey="value" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Line chart */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-semibold">Weekly Request Views</CardTitle>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </div>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              <Activity className="mr-1 size-3" /> 401
            </Badge>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="views"
                    stroke="var(--chart-1)"
                    strokeWidth={2.5}
                    dot={{ fill: "var(--chart-1)", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Donut chart */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-semibold">Request Mix</CardTitle>
              <p className="text-xs text-muted-foreground">Distribution by endpoint</p>
            </div>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              <Clock className="mr-1 size-3" /> 36 pending
            </Badge>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {taskDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={24}
                    iconType="circle"
                    formatter={(v) => <span className="text-[10px] text-muted-foreground">{v}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System resources */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">System Resources</CardTitle>
            <p className="text-xs text-muted-foreground">Real-time host utilisation</p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid gap-4 sm:grid-cols-3">
              <ResourceBar icon={<Cpu className="size-4" />} label="CPU" value={12} display="12%" />
              <ResourceBar icon={<MemoryStick className="size-4" />} label="RAM" value={53} display="34 / 64 GB" />
              <ResourceBar icon={<HardDrive className="size-4" />} label="GPU VRAM" value={Math.min(100, Math.round((totalMem / 12288) * 100))} display={`${(totalMem / 1024).toFixed(1)} / 12 GB`} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Downloaded Models</CardTitle>
            <p className="text-xs text-muted-foreground">{models.filter((m) => m.downloaded).length} of {models.length} ready</p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-2">
              {models.slice(0, 4).map((m) => (
                <div key={m.id} className="flex items-center justify-between text-xs">
                  <span className="truncate font-medium">{m.name}</span>
                  <Badge variant={m.downloaded ? "secondary" : "outline"} className="ml-2 text-[10px]">
                    {m.downloaded ? "Ready" : "Missing"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ResourceBar({
  icon,
  label,
  value,
  display,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  display: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="font-mono">{display}</span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
}
