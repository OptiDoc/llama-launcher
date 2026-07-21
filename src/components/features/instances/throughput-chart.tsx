"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { useLlamaStore, type LlamaInstance } from "@/lib/llama-store";

function ThroughputChart({ instance }: { instance: LlamaInstance }) {
  const metrics = useLlamaStore((s) => s.metrics);
  const throughput = React.useMemo(
    () =>
      metrics.slice(-20).map((m, i) => ({
        idx: i + 1,
        tps: Number((m.tps || instance.tokensPerSec || 0).toFixed(1)),
      })),
    [metrics, instance.tokensPerSec],
  );

  return (
    <Card className="py-0">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-foreground">Request throughput</h3>
          <span className="text-[11px] text-muted-foreground">last 20 samples \u00b7 tok/s</span>
        </div>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={throughput} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="idx"
                tick={{
                  fontSize: 10,
                  fill: "hsl(var(--muted-foreground))",
                }}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                tick={{
                  fontSize: 10,
                  fill: "hsl(var(--muted-foreground))",
                }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <RTooltip
                cursor={{
                  stroke: "hsl(var(--border))",
                  strokeWidth: 1,
                  strokeDasharray: "3 3",
                }}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                labelFormatter={(l) => `sample ${l}`}
                formatter={(v: number) => [`${v.toFixed(1)} tok/s`, "throughput"]}
              />
              <Line
                type="monotone"
                dataKey="tps"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export { ThroughputChart };
