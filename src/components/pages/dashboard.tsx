"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Radio,
  Gauge,
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
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  useLlamaStore,
  uptimeString,
  type MetricSample,
} from "@/lib/llama-store";

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
    <Card className={cn("overflow-hidden border shadow-soft", `card-${color}`)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="grid size-10 place-items-center rounded-xl bg-white/70 text-foreground shadow-sm dark:bg-black/25 dark:text-white">
            {icon}
          </div>
          {delta && (
            <Badge
              variant="secondary"
              className={cn(
                "gap-1 bg-white/70 text-xs font-medium dark:bg-black/25",
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
    <Card className={cn("border shadow-soft", `card-${instance.color}`)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="grid size-10 place-items-center rounded-xl bg-white/70 dark:bg-black/25">
            <Server className="size-5" />
          </div>
          <Badge
            variant="secondary"
            className={cn("bg-white/70 text-[10px] font-semibold uppercase dark:bg-black/25", statusColor)}
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
            className="h-7 bg-white/70 text-xs dark:bg-black/25"
            onClick={onOpen}
          >
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ Right column: live system load infographics ============

function fmtClock(t: number) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
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
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span style={{ color }}>{icon}</span>
          {label}
        </span>
        <span className="font-mono text-xs font-semibold">{display}</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function LiveMetricsColumn() {
  const metrics = useLlamaStore((s) => s.metrics);
  const instances = useLlamaStore((s) => s.instances);
  const appStatus = useLlamaStore((s) => s.appStatus);

  const latest = metrics[metrics.length - 1];
  const running = instances.filter((i) => i.status === "running");
  const chartData = metrics.slice(-40).map((m) => ({
    time: fmtClock(m.t).slice(3), // mm:ss
    cpu: Math.round(m.cpu),
    ram: Math.round(m.ram),
    gpu: Math.round(m.gpu),
    tps: Number(m.tps.toFixed(1)),
    req: m.reqPerMin,
  }));

  const isLive = appStatus === "active";

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card className="border shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Radio className="size-4 text-primary" />
              System Load
            </CardTitle>
            <p className="text-xs text-muted-foreground">Real-time telemetry</p>
          </div>
          <LiveIndicator label={isLive ? "Live" : appStatus} />
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="grid gap-3">
            <MetricGauge
              icon={<Cpu className="size-3.5" />}
              label="CPU"
              value={latest?.cpu ?? 0}
              display={`${Math.round(latest?.cpu ?? 0)}%`}
              color="var(--chart-4)"
            />
            <MetricGauge
              icon={<MemoryStick className="size-3.5" />}
              label="Memory"
              value={latest?.ram ?? 0}
              display={`${Math.round(latest?.ram ?? 0)}% · ${(32 + (latest?.ram ?? 0) * 0.3).toFixed(0)} GB`}
              color="var(--chart-3)"
            />
            <MetricGauge
              icon={<HardDrive className="size-3.5" />}
              label="GPU VRAM"
              value={latest?.gpuMem ?? 0}
              display={`${Math.round(latest?.gpuMem ?? 0)}% · ${((latest?.gpuMem ?? 0) * 0.12).toFixed(1)} GB`}
              color="var(--chart-2)"
            />
            <MetricGauge
              icon={<Activity className="size-3.5" />}
              label="GPU compute"
              value={latest?.gpu ?? 0}
              display={`${Math.round(latest?.gpu ?? 0)}%`}
              color="var(--chart-1)"
            />
          </div>
        </CardContent>
      </Card>

      {/* Live multi-line chart */}
      <Card className="border shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Gauge className="size-4 text-primary" />
            Utilisation
          </CardTitle>
          <p className="text-xs text-muted-foreground">CPU · RAM · GPU last 60s</p>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={30}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
                <Line type="monotone" dataKey="cpu" stroke="var(--chart-4)" strokeWidth={1.5} dot={false} isAnimationActive={false} name="CPU" />
                <Line type="monotone" dataKey="ram" stroke="var(--chart-3)" strokeWidth={1.5} dot={false} isAnimationActive={false} name="RAM" />
                <Line type="monotone" dataKey="gpu" stroke="var(--chart-1)" strokeWidth={1.5} dot={false} isAnimationActive={false} name="GPU" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center justify-center gap-4 text-[10px]">
            <span className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ backgroundColor: "var(--chart-4)" }} />CPU</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ backgroundColor: "var(--chart-3)" }} />RAM</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ backgroundColor: "var(--chart-1)" }} />GPU</span>
          </div>
        </CardContent>
      </Card>

      {/* Tokens/sec area chart */}
      <Card className="border shadow-soft">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Throughput</CardTitle>
              <p className="text-xs text-muted-foreground">Tokens / sec</p>
            </div>
            <span className="font-mono text-lg font-bold text-primary">
              {(latest?.tps ?? 0).toFixed(1)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-[100px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="tpsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={30}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="tps"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  fill="url(#tpsGrad)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Per-instance mini meters */}
      <Card className="border shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Per-instance</CardTitle>
          <p className="text-xs text-muted-foreground">{running.length} active</p>
        </CardHeader>
        <CardContent className="pt-2">
          {running.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No active instances</p>
          ) : (
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2.5 pr-2">
                {running.map((inst) => (
                  <div key={inst.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="truncate font-medium">{inst.name}</span>
                      <span className="font-mono text-muted-foreground">{inst.tokensPerSec.toFixed(1)} tok/s</span>
                    </div>
                    <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${Math.min(100, inst.tokensPerSec * 2.5)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============ Dashboard ============

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

      {/* 2-column layout: main (left) + live metrics sidebar (right) */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* ===== Left column: stat cards, instances, charts ===== */}
        <div className="space-y-6">
          {/* Stat cards */}
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

          {/* Active instances */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Active Instances</h2>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                View all
              </Button>
            </div>
            {running.length === 0 ? (
              <Card className="border-dashed shadow-soft">
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {running.slice(0, 3).map((inst) => (
                  <InstanceMiniCard key={inst.id} instance={inst} onOpen={() => openConsole(inst.id)} />
                ))}
              </div>
            )}
          </div>

          {/* Charts: bar + line + donut */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card className="border shadow-soft">
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
                <div className="h-[180px]">
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

            <Card className="border shadow-soft">
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
                <div className="h-[180px]">
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

            <Card className="border shadow-soft md:col-span-2 xl:col-span-1">
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
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={taskDistribution}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={68}
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
                        height={20}
                        iconType="circle"
                        formatter={(v) => <span className="text-[10px] text-muted-foreground">{v}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Downloaded models */}
          <Card className="border shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Downloaded Models</CardTitle>
              <p className="text-xs text-muted-foreground">{models.filter((m) => m.downloaded).length} of {models.length} ready</p>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="grid gap-2 sm:grid-cols-2">
                {models.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                    <span className="truncate font-medium">{m.name}</span>
                    <Badge variant={m.downloaded ? "secondary" : "outline"} className="ml-2 shrink-0 text-[10px]">
                      {m.downloaded ? "Ready" : "Missing"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== Right column: live system load infographics ===== */}
        <div className="xl:sticky xl:top-0 xl:self-start">
          <LiveMetricsColumn />
        </div>
      </div>
    </div>
  );
}
