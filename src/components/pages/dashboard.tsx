"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
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
} from "recharts";
import {
  useLlamaStore,
  uptimeString,
  RELEASE_VARIANTS,
} from "@/lib/llama-store";

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

function InstanceMiniCard({
  instance,
  onOpen,
}: {
  instance: ReturnType<typeof useLlamaStore.getState>["instances"][number];
  onOpen: () => void;
}) {
  const statusVariant =
    instance.status === "running"
      ? "default"
      : instance.status === "starting"
        ? "secondary"
        : "outline";

  const memPercent = instance.status === "running"
    ? Math.min(100, (instance.memoryMb / (instance.ctxSize * 0.5 + 1200)) * 100)
    : 0;

  return (
    <Card className="py-4 transition-shadow hover:shadow-md">
      <CardContent className="px-4">
        <div className="flex items-start justify-between">
          <div className={cn("grid size-8 place-items-center rounded-lg", `card-${instance.color}`)}>
            <Server className="size-4" />
          </div>
          <Badge variant={statusVariant} className="text-[10px] uppercase">
            {instance.status}
          </Badge>
        </div>
        <h3 className="mt-2.5 text-sm font-semibold text-foreground">{instance.name}</h3>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{instance.model}</p>

        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Port :{instance.port}</span>
          <span className="font-mono text-muted-foreground">{uptimeString(instance.startedAt)}</span>
        </div>

        <Progress value={memPercent} className="mt-2 h-1.5" />

        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {instance.tokensPerSec.toFixed(1)} tok/s · {instance.requestsPerMin} req/min
          </div>
          <Button variant="secondary" size="sm" onClick={onOpen} className="px-2">
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Right column: live system load infographics ----------

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

function LiveMetricsSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Radio className="size-4 text-primary" />
                System Load
              </CardTitle>
              <CardDescription>Real-time telemetry</CardDescription>
            </div>
            <Badge variant="secondary" className="gap-1.5">
              <span className="size-1.5 rounded-full bg-muted-foreground/50" />
              Loading
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {["CPU", "Memory", "GPU VRAM", "GPU compute"].map((label) => (
              <div key={label} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                  <span className="font-mono text-xs text-muted-foreground">--</span>
                </div>
                <Skeleton className="h-1.5 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Utilisation</CardTitle>
          <CardDescription>CPU · RAM · GPU last 60s</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[120px] w-full rounded-lg" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Throughput</CardTitle>
          <CardDescription>Tokens / sec</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[100px] w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}

function LiveMetricsColumn() {
  const metrics = useLlamaStore((s) => s.metrics);
  const instances = useLlamaStore((s) => s.instances);
  const appStatus = useLlamaStore((s) => s.appStatus);
  const systemCapabilities = useLlamaStore((s) => s.systemCapabilities);

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const chartData = React.useMemo(
    () =>
      metrics.slice(-40).map((m) => ({
        time: fmtClock(m.t).slice(3),
        cpu: Math.round(m.cpu),
        ram: Math.round(m.ram),
        gpu: Math.round(m.gpu),
        tps: Number(m.tps.toFixed(1)),
        req: m.reqPerMin,
      })),
    [metrics],
  );

  const latest = metrics[metrics.length - 1];
  const running = instances.filter((i) => i.status === "running");

  if (!mounted) {
    return <LiveMetricsSkeleton />;
  }

  const isLive = appStatus === "active";
  const ramGb = systemCapabilities.ramGb;
  const vramGb = systemCapabilities.gpuVramGb;

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Radio className="size-4 text-primary" />
                System Load
              </CardTitle>
              <CardDescription>Real-time telemetry</CardDescription>
            </div>
            <LiveIndicator label={isLive ? "Live" : appStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
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
            display={
              ramGb > 0
                ? `${Math.round(latest?.ram ?? 0)}% · ${((latest?.ram ?? 0) / 100 * ramGb).toFixed(0)} / ${ramGb} GB`
                : `${Math.round(latest?.ram ?? 0)}%`
            }
            color="var(--chart-3)"
          />
          <MetricGauge
            icon={<HardDrive className="size-3.5" />}
            label="GPU VRAM"
            value={latest?.gpuMem ?? 0}
            display={
              vramGb > 0
                ? `${Math.round(latest?.gpuMem ?? 0)}% · ${((latest?.gpuMem ?? 0) / 100 * vramGb).toFixed(1)} / ${vramGb} GB`
                : `${Math.round(latest?.gpuMem ?? 0)}%`
            }
            color="var(--chart-2)"
          />
          <MetricGauge
            icon={<Activity className="size-3.5" />}
            label="GPU compute"
            value={latest?.gpu ?? 0}
            display={`${Math.round(latest?.gpu ?? 0)}%`}
            color="var(--chart-1)"
          />
        </CardContent>
      </Card>

      {/* Live multi-line chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Gauge className="size-4 text-primary" />
            Utilisation
          </CardTitle>
          <CardDescription>CPU · RAM · GPU last 60s</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={utilChartConfig} className="h-[120px]">
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
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="cpu" stroke="var(--color-cpu)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="ram" stroke="var(--color-ram)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="gpu" stroke="var(--color-gpu)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Tokens/sec area chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Throughput</CardTitle>
              <CardDescription>Tokens / sec</CardDescription>
            </div>
            <span className="font-mono text-lg font-bold text-primary">
              {(latest?.tps ?? 0).toFixed(1)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={tpsChartConfig} className="h-[100px]">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="tpsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-tps)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-tps)" stopOpacity={0} />
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
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="tps"
                stroke="var(--color-tps)"
                strokeWidth={2}
                fill="url(#tpsGrad)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Per-instance mini meters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Per-instance</CardTitle>
          <CardDescription>{running.length} active</CardDescription>
        </CardHeader>
        <CardContent>
          {running.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No active instances</p>
          ) : (
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2.5 pr-2">
                {running.map((inst) => (
                  <div key={inst.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate font-medium">{inst.name}</span>
                      <span className="font-mono text-muted-foreground">{inst.tokensPerSec.toFixed(1)} tok/s</span>
                    </div>
                    <Progress value={Math.min(100, inst.tokensPerSec * 2.5)} className="h-1.5" />
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
  const releases = useLlamaStore((s) => s.releases);
  const metrics = useLlamaStore((s) => s.metrics);
  const systemCapabilities = useLlamaStore((s) => s.systemCapabilities);
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
          <Button variant="outline" size="sm">
            <Activity className="size-3" />
            Refresh
          </Button>
          <Button size="sm">
            <Plus className="size-3" />
            New Instance
          </Button>
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
              icon={<Server className="size-4" />}
              color="green"
            />
            <StatCard
              label="Tokens / sec"
              value={totalTps.toFixed(1)}
              icon={<Zap className="size-4" />}
              color="orange"
            />
            <StatCard
              label="GPU Memory"
              value={
                systemCapabilities.gpuVramGb > 0
                  ? `${(totalMem / 1024).toFixed(1)} / ${systemCapabilities.gpuVramGb.toFixed(0)} GB`
                  : `${(totalMem / 1024).toFixed(1)} GB`
              }
              icon={<MemoryStick className="size-4" />}
              color="blue"
            />
            <StatCard
              label="Requests / min"
              value={String(totalReq)}
              icon={<Activity className="size-4" />}
              color="pink"
            />
          </div>

          {/* Active instances */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Active Instances</CardTitle>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  View all
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {running.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <div className="mx-auto grid size-10 place-items-center rounded-xl bg-muted/50">
                    <Server className="size-5 text-muted-foreground/50" />
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">No running instances</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Start a llama-server from the Instances page.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {running.slice(0, 3).map((inst) => (
                    <InstanceMiniCard key={inst.id} instance={inst} onOpen={() => openConsole(inst.id)} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {/* CPU history */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">CPU History</CardTitle>
                    <CardDescription>Last 60s</CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {metrics.length > 0 ? `${Math.round(metrics[metrics.length - 1].cpu)}%` : "--"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer config={cpuChartConfig} className="h-[130px]">
                  <AreaChart
                    data={metrics.slice(-40).map((m) => ({
                      time: new Date(m.t).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
                      cpu: Math.round(m.cpu),
                    }))}
                    margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-cpu)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--color-cpu)" stopOpacity={0} />
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
                      domain={[0, 100]}
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="cpu" stroke="var(--color-cpu)" strokeWidth={1.5} fill="url(#cpuGrad)" isAnimationActive={false} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Throughput history */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">Throughput</CardTitle>
                    <CardDescription>Tokens/sec · last 60s</CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {totalTps.toFixed(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer config={tpsChartConfig} className="h-[130px]">
                  <LineChart
                    data={metrics.slice(-40).map((m) => ({
                      time: new Date(m.t).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
                      tps: Number(m.tps.toFixed(1)),
                    }))}
                    margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                  >
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
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="tps" stroke="var(--color-tps)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Instance summary */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">Instances</CardTitle>
                    <CardDescription>Running servers</CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs">{running.length}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-[130px] overflow-y-auto">
                  {running.length === 0 ? (
                    <div className="flex h-full items-center justify-center py-6 text-xs text-muted-foreground">
                      No running instances
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {running.map((inst) => (
                        <div key={inst.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium text-foreground">{inst.name}</div>
                            <div className="text-[10px] text-muted-foreground">:{inst.port} · {inst.tokensPerSec.toFixed(1)} tok/s</div>
                          </div>
                          <div className="ml-2 text-right">
                            <div className="font-mono text-xs font-semibold text-foreground">{Math.round(inst.memoryMb)} MB</div>
                            <div className="text-[10px] text-muted-foreground">{inst.requestsPerMin} req/min</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Downloaded models */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Downloaded Models</CardTitle>
              <CardDescription>{models.filter((m) => m.downloaded).length} of {models.length} ready</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {models.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5 text-xs">
                    <span className="truncate font-medium text-foreground">{m.name}</span>
                    <Badge
                      variant={m.downloaded ? "default" : "secondary"}
                      className={cn("ml-2 shrink-0 text-[10px]", m.downloaded ? "bg-emerald-500/10 text-emerald-600" : "")}
                    >
                      {m.downloaded ? "Ready" : "Missing"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* llama.cpp builds */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <Boxes className="size-3.5 text-primary" />
                    llama.cpp Builds
                  </CardTitle>
                  <CardDescription>Available release variants</CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">{releases.filter((r) => r.installed).length} installed</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {RELEASE_VARIANTS.map((v) => {
                  const variantReleases = releases.filter((r) => r.variant === v.id);
                  const installed = variantReleases.some((r) => r.installed);
                  return (
                    <div key={v.id} className={cn("rounded-lg border p-2.5", v.priority ? "border-primary/20 bg-primary/5" : "border-border/40 bg-muted/20")}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">{v.label}</span>
                        {installed ? (
                          <CheckCircle2 className="size-3 text-emerald-500" />
                        ) : v.priority ? (
                          <Badge variant="secondary" className="text-[10px]">Priority</Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{v.note}</p>
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Download className="size-2" />
                        {variantReleases.length} builds
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: live metrics */}
        <div className="xl:sticky xl:top-0 xl:self-start">
          <LiveMetricsColumn />
        </div>
      </div>
    </div>
  );
}
