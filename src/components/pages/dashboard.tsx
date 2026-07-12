"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
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
  Boxes,
  Download,
  CheckCircle2,
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
  RELEASE_VARIANTS,
} from "@/lib/llama-store";

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
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        {delta && (
          <span className={cn(
            "flex items-center gap-0.5 text-[10px] font-medium",
            deltaDir === "up" ? "text-emerald-600" : "text-red-500",
          )}>
            {deltaDir === "up" ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {delta}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>
        <span className={cn("grid size-7 place-items-center rounded-lg", `card-${color}`)}>
          {icon}
        </span>
      </div>
    </div>
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
    <div className="rounded-xl border border-border/60 bg-card p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={cn("grid size-8 place-items-center rounded-lg", `card-${instance.color}`)}>
          <Server className="size-4" />
        </div>
        <span className={cn("text-[10px] font-semibold uppercase tracking-wide", statusColor)}>
          {instance.status}
        </span>
      </div>
      <h3 className="mt-2.5 text-[13px] font-semibold text-foreground">{instance.name}</h3>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{instance.model}</p>

      <div className="mt-3 flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">Port :{instance.port}</span>
        <span className="font-mono text-muted-foreground">{uptimeString(instance.startedAt)}</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/60 transition-all duration-500"
          style={{ width: `${instance.status === "running" ? 60 + (instance.id.charCodeAt(4) % 35) : 0}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-1">
          {["A", "B", "C"].slice(0, instance.status === "running" ? 3 : 1).map((n) => (
            <div key={n} className="grid size-5 place-items-center rounded-full border-[1.5px] border-card bg-primary/80 text-[8px] font-semibold text-primary-foreground">
              {n}
            </div>
          ))}
        </div>
        <button onClick={onOpen} className="rounded-md bg-muted px-2.5 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-muted/80">
          View
        </button>
      </div>
    </div>
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
      <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function LiveMetricsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Radio className="size-4 text-primary" />
              System Load
            </h3>
            <p className="text-xs text-muted-foreground">Real-time telemetry</p>
          </div>
          <Badge variant="secondary" className="gap-1.5 bg-muted text-muted-foreground">
            <span className="size-1.5 rounded-full bg-muted-foreground/50" />
            Loading
          </Badge>
        </div>
        <div className="space-y-4 pt-0">
          <div className="grid gap-3">
            {["CPU", "Memory", "GPU VRAM", "GPU compute"].map((label) => (
              <div key={label} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
                  <span className="font-mono text-xs text-muted-foreground">--</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="pb-2">
          <h3 className="text-sm font-semibold">Utilisation</h3>
          <p className="text-xs text-muted-foreground">CPU · RAM · GPU last 60s</p>
        </div>
        <div className="pt-2">
          <div className="h-[120px] rounded-lg bg-muted/40" />
        </div>
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="pb-2">
          <h3 className="text-sm font-semibold">Throughput</h3>
          <p className="text-xs text-muted-foreground">Tokens / sec</p>
        </div>
        <div className="pt-2">
          <div className="h-[100px] rounded-lg bg-muted/40" />
        </div>
      </div>
    </div>
  );
}

function LiveMetricsColumn() {
  const metrics = useLlamaStore((s) => s.metrics);
  const instances = useLlamaStore((s) => s.instances);
  const appStatus = useLlamaStore((s) => s.appStatus);

  // Gate live data rendering behind a mount check to avoid SSR/CSR
  // hydration mismatch — the metrics store uses Date.now() and the
  // ticker pushes new values continuously, both of which would produce
  // different HTML on the server vs the client.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const chartData = React.useMemo(() => metrics.slice(-40).map((m) => ({
    time: fmtClock(m.t).slice(3), // mm:ss
    cpu: Math.round(m.cpu),
    ram: Math.round(m.ram),
    gpu: Math.round(m.gpu),
    tps: Number(m.tps.toFixed(1)),
    req: m.reqPerMin,
  })), [metrics]);

  const latest = metrics[metrics.length - 1];
  const running = instances.filter((i) => i.status === "running");

  if (!mounted) {
    return <LiveMetricsSkeleton />;
  }

  const isLive = appStatus === "active";

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Radio className="size-4 text-primary" />
              System Load
            </h3>
            <p className="text-xs text-muted-foreground">Real-time telemetry</p>
          </div>
          <LiveIndicator label={isLive ? "Live" : appStatus} />
        </div>
        <div className="space-y-4 pt-0">
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
        </div>
      </div>

      {/* Live multi-line chart */}
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="pb-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Gauge className="size-4 text-primary" />
            Utilisation
          </h3>
          <p className="text-xs text-muted-foreground">CPU · RAM · GPU last 60s</p>
        </div>
        <div className="pt-2">
          <div className="h-[120px]">
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
                  cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1, strokeDasharray: "3 3" }}
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
        </div>
      </div>

      {/* Tokens/sec area chart */}
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Throughput</h3>
              <p className="text-xs text-muted-foreground">Tokens / sec</p>
            </div>
            <span className="font-mono text-lg font-bold text-primary">
              {(latest?.tps ?? 0).toFixed(1)}
            </span>
          </div>
        </div>
        <div className="pt-2">
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
                  cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1, strokeDasharray: "3 3" }}
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
        </div>
      </div>

      {/* Per-instance mini meters */}
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="pb-2">
          <h3 className="text-sm font-semibold">Per-instance</h3>
          <p className="text-xs text-muted-foreground">{running.length} active</p>
        </div>
        <div className="pt-2">
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
        </div>
      </div>
    </div>
  );
}

// ============ Dashboard ============

export function Dashboard() {
  const instances = useLlamaStore((s) => s.instances);
  const models = useLlamaStore((s) => s.models);
  const releases = useLlamaStore((s) => s.releases);
  const metrics = useLlamaStore((s) => s.metrics);
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
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Monitor running llama.cpp servers, GPU utilisation and request throughput.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="flex h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 text-[11px] font-medium text-foreground transition-colors hover:bg-accent">
            <Activity className="size-3" />
            Refresh
          </button>
          <button className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            <Plus className="size-3" />
            New Instance
          </button>
        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {/* Stat cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Running Instances"
              value={String(running.length)}
              delta="+2"
              deltaDir="up"
              icon={<Server className="size-4" />}
              color="green"
            />
            <StatCard
              label="Tokens / sec"
              value={totalTps.toFixed(1)}
              delta="+12%"
              deltaDir="up"
              icon={<Zap className="size-4" />}
              color="orange"
            />
            <StatCard
              label="GPU Memory"
              value={`${(totalMem / 1024).toFixed(1)} / 12 GB`}
              delta="-3%"
              deltaDir="down"
              icon={<MemoryStick className="size-4" />}
              color="blue"
            />
            <StatCard
              label="Requests / min"
              value={String(totalReq)}
              delta="+8%"
              deltaDir="up"
              icon={<Activity className="size-4" />}
              color="pink"
            />
          </div>

          {/* Active instances */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-foreground">Active Instances</h2>
              <button className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">View all</button>
            </div>
            {running.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-card p-8 text-center">
                <div className="mx-auto grid size-10 place-items-center rounded-xl bg-muted/50">
                  <Server className="size-5 text-muted-foreground/50" />
                </div>
                <p className="mt-2 text-[12px] font-medium text-foreground">No running instances</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Start a llama-server from the Instances page.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {running.slice(0, 3).map((inst) => (
                  <InstanceMiniCard key={inst.id} instance={inst} onOpen={() => openConsole(inst.id)} />
                ))}
              </div>
            )}
          </div>

          {/* Charts */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {/* CPU history */}
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-semibold text-foreground">CPU History</h3>
                  <p className="text-[10px] text-muted-foreground">Last 60s</p>
                </div>
                <span className="rounded-md bg-primary/8 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  {metrics.length > 0 ? `${Math.round(metrics[metrics.length - 1].cpu)}%` : "--"}
                </span>
              </div>
              <div className="mt-3 h-[130px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.slice(-40).map((m) => ({ time: new Date(m.t).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }), cpu: Math.round(m.cpu) }))} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.003 250)" vertical={false} />
                      <XAxis dataKey="time" tick={{ fontSize: 9, fill: "oklch(0.55 0.01 250)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={30} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "oklch(0.55 0.01 250)" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ stroke: "oklch(0.91 0.003 250)", strokeWidth: 1, strokeDasharray: "3 3" }}
                        contentStyle={{ backgroundColor: "oklch(1 0 0)", border: "1px solid oklch(0.91 0.003 250)", borderRadius: 8, fontSize: 11 }}
                      />
                      <Area type="monotone" dataKey="cpu" stroke="var(--chart-4)" strokeWidth={1.5} fill="url(#cpuGrad)" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
            </div>

            {/* Throughput history */}
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-semibold text-foreground">Throughput</h3>
                  <p className="text-[10px] text-muted-foreground">Tokens/sec · last 60s</p>
                </div>
                <span className="rounded-md bg-primary/8 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{totalTps.toFixed(1)}</span>
              </div>
              <div className="mt-3 h-[130px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics.slice(-40).map((m) => ({ time: new Date(m.t).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }), tps: Number(m.tps.toFixed(1)) }))} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.003 250)" vertical={false} />
                      <XAxis dataKey="time" tick={{ fontSize: 9, fill: "oklch(0.55 0.01 250)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={30} />
                      <YAxis tick={{ fontSize: 9, fill: "oklch(0.55 0.01 250)" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ stroke: "oklch(0.91 0.003 250)", strokeWidth: 1, strokeDasharray: "3 3" }}
                        contentStyle={{ backgroundColor: "oklch(1 0 0)", border: "1px solid oklch(0.91 0.003 250)", borderRadius: 8, fontSize: 11 }}
                      />
                      <Line type="monotone" dataKey="tps" stroke="var(--chart-2)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
            </div>

            {/* Instance summary */}
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-semibold text-foreground">Instances</h3>
                  <p className="text-[10px] text-muted-foreground">Running servers</p>
                </div>
                <span className="rounded-md bg-primary/8 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{running.length}</span>
              </div>
              <div className="mt-3 max-h-[130px] overflow-y-auto">
                {running.length === 0 ? (
                  <div className="flex h-full items-center justify-center py-6 text-[11px] text-muted-foreground">No running instances</div>
                ) : (
                  <div className="space-y-1.5">
                    {running.map((inst) => (
                      <div key={inst.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-medium text-foreground">{inst.name}</div>
                          <div className="text-[9px] text-muted-foreground">:{inst.port} · {inst.tokensPerSec.toFixed(1)} tok/s</div>
                        </div>
                        <div className="ml-2 text-right">
                          <div className="font-mono text-[11px] font-semibold text-foreground">{Math.round(inst.memoryMb)} MB</div>
                          <div className="text-[9px] text-muted-foreground">{inst.requestsPerMin} req/min</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Downloaded models */}
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <h3 className="text-[13px] font-semibold text-foreground">Downloaded Models</h3>
            <p className="text-[10px] text-muted-foreground">{models.filter((m) => m.downloaded).length} of {models.length} ready</p>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {models.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5 text-[11px]">
                  <span className="truncate font-medium text-foreground">{m.name}</span>
                  <span className={cn("ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium", m.downloaded ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground")}>
                    {m.downloaded ? "Ready" : "Missing"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* llama.cpp builds */}
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                  <Boxes className="size-3.5 text-primary" />
                  llama.cpp Builds
                </h3>
                <p className="text-[10px] text-muted-foreground">Available release variants</p>
              </div>
              <span className="rounded-md bg-primary/8 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{releases.filter((r) => r.installed).length} installed</span>
            </div>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {RELEASE_VARIANTS.map((v) => {
                const variantReleases = releases.filter((r) => r.variant === v.id);
                const installed = variantReleases.some((r) => r.installed);
                return (
                  <div key={v.id} className={cn("rounded-lg border p-2.5", v.priority ? "border-primary/20 bg-primary/5" : "border-border/40 bg-muted/20")}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-foreground">{v.label}</span>
                      {installed ? (
                        <CheckCircle2 className="size-3 text-emerald-500" />
                      ) : v.priority ? (
                        <span className="rounded bg-primary/10 px-1 py-px text-[8px] font-medium text-primary">Priority</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[9px] text-muted-foreground">{v.note}</p>
                    <div className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground">
                      <Download className="size-2" />
                      {variantReleases.length} builds
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column: live metrics */}
        <div className="xl:sticky xl:top-0 xl:self-start">
          <LiveMetricsColumn />
        </div>
      </div>
    </div>
  );
}
