/**
 * Live metrics column component.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from "recharts";
import { Cpu, MemoryStick, HardDrive, Activity, Radio, Gauge } from "lucide-react";
import { useLlamaStore } from "@/lib/llama-store";
import { utilChartConfig, tpsChartConfig, fmtClock, LiveIndicator, MetricGauge } from "./dashboard-charts";
import { LiveMetricsSkeleton } from "./live-metrics-skeleton";
import { LiveMetricsHeader } from "./live-metrics-header";

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
  const ramGb = systemCapabilities.ram_gb;
  const vramGb = systemCapabilities.gpu_vram_gb;

  return (
    <div className="space-y-4">
      <LiveMetricsHeader isLive={isLive} appStatus={appStatus} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Cpu className="size-4 text-primary" /> CPU
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MetricGauge
              icon={<Cpu className="size-4 text-primary" />}
              label="CPU"
              value={latest?.cpu ?? 0}
              display={`${Math.round(latest?.cpu ?? 0)}%`}
              color="blue"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <MemoryStick className="size-4 text-primary" /> RAM
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MetricGauge
              icon={<MemoryStick className="size-4 text-primary" />}
              label="RAM"
              value={latest?.ram ?? 0}
              display={`${Math.round(latest?.ram ?? 0)}%`}
              color="green"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <HardDrive className="size-4 text-primary" /> VRAM
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MetricGauge
              icon={<HardDrive className="size-4 text-primary" />}
              label="VRAM"
              value={latest?.gpu ?? 0}
              display={`${Math.round(latest?.gpu ?? 0)}%`}
              color="purple"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Activity className="size-4 text-primary" /> TPS
          </CardTitle>
          <CardDescription>Tokens per second</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ChartContainer config={tpsChartConfig}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="tps"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { LiveMetricsColumn };
