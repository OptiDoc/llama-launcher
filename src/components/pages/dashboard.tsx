"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Server, Zap, MemoryStick, Activity } from "lucide-react";
import { useLlamaStore } from "@/lib/llama-store";
import { StatCard } from "@/components/features/dashboard/dashboard-charts";
import { InstanceMiniCard } from "@/components/features/dashboard/instance-mini-card";
import { LiveMetricsColumn } from "@/components/features/dashboard/live-metrics-column";
import { DashboardHeader } from "@/components/features/dashboard/dashboard-header";
import { SystemCharts } from "@/components/features/dashboard/system-charts";
import { InstanceSummary, DownloadedModels } from "@/components/features/dashboard/resource-summary";
import { BuildsCard } from "@/components/features/dashboard/builds-card";

export function Dashboard() {
  const instances = useLlamaStore((s) => s.instances);
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
      <DashboardHeader />

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
                systemCapabilities.gpu_vram_gb > 0
                  ? `${(totalMem / 1024).toFixed(1)} / ${systemCapabilities.gpu_vram_gb.toFixed(0)} GB`
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

          {/* Charts + Instance Summary */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SystemCharts />
            <InstanceSummary />
          </div>

          <DownloadedModels />
          <BuildsCard />
        </div>

        <div className="xl:sticky xl:top-0 xl:self-start">
          <LiveMetricsColumn />
        </div>
      </div>
    </div>
  );
}
