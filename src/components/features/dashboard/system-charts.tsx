"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { CartesianGrid, XAxis, YAxis, Area, AreaChart, Line, LineChart } from "recharts";
import { useLlamaStore } from "@/lib/llama-store";
import { cpuChartConfig, tpsChartConfig } from "@/components/features/dashboard/dashboard-charts";

export function SystemCharts() {
  const instances = useLlamaStore((s) => s.instances);
  const metrics = useLlamaStore((s) => s.metrics);

  const running = instances.filter((i) => i.status === "running" || i.status === "starting");
  const totalTps = running.reduce((sum, i) => sum + i.tokensPerSec, 0);

  return (
    <>
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
              <Area
                type="monotone"
                dataKey="cpu"
                stroke="var(--color-cpu)"
                strokeWidth={1.5}
                fill="url(#cpuGrad)"
                isAnimationActive={false}
              />
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
              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="tps"
                stroke="var(--color-tps)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </>
  );
}
