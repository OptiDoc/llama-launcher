"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, LineChart, Line } from "recharts";
import { useLlamaStore } from "@/lib/llama-store";

export function SystemCharts() {
  const instances = useLlamaStore((s) => s.instances);
  const metrics = useLlamaStore((s) => s.metrics);

  const running = instances.filter((i) => i.status === "running" || i.status === "starting");
  const totalTps = running.reduce((sum, i) => sum + i.tokensPerSec, 0);

  const tooltipStyle = {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 11,
  };

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
          <div className="h-[130px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={metrics.slice(-40).map((m) => ({
                  time: new Date(m.t).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
                  cpu: Math.round(m.cpu),
                }))}
                margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-4))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--chart-4))" stopOpacity={0} />
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
                <Tooltip
                  cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1, strokeDasharray: "3 3" }}
                  contentStyle={tooltipStyle}
                />
                <Area
                  type="monotone"
                  dataKey="cpu"
                  stroke="hsl(var(--chart-4))"
                  strokeWidth={1.5}
                  fill="url(#cpuGrad)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
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
          <div className="h-[130px]">
            <ResponsiveContainer width="100%" height="100%">
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
                <Tooltip
                  cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1, strokeDasharray: "3 3" }}
                  contentStyle={tooltipStyle}
                />
                <Line
                  type="monotone"
                  dataKey="tps"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
