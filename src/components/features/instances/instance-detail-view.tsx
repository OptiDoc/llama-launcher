"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  useLlamaStore,
  uptimeString,
  type LlamaInstance,
} from "@/lib/llama-store";
import {
  Server,
  ArrowLeft,
  Clock,
  TrendingUp,
  Cpu,
  Zap,
  MemoryStick,
} from "lucide-react";
import { StatusBadge, StatTile } from "./instances-badges";
import { InstanceActionsCard } from "./instance-actions-card";
import { InstanceStatusLive } from "./instance-status-live";
import { InstanceConfigMeta } from "./instance-config-meta";
import { ThroughputChart } from "./throughput-chart";

function InstanceDetailView({
  instance,
  onBack,
}: {
  instance: LlamaInstance;
  onBack: () => void;
}) {
  const removeInstance = useLlamaStore((s) => s.removeInstance);
  const [confirmRemove, setConfirmRemove] = React.useState(false);

  const isRunning =
    instance.status === "running" || instance.status === "starting";
  const isStopped = instance.status === "stopped";
  const avgMemory = instance.memoryMb;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumbs
          items={[
            { label: "Instances", onClick: onBack },
            { label: instance.name },
          ]}
        />
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5 size-3.5" />
          Back
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <Card className={cn("py-0", `card-${instance.color}`)}>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-12 place-items-center rounded-xl bg-card">
                    <Server className="size-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold tracking-tight text-foreground">
                        {instance.name}
                      </h2>
                      <StatusBadge status={instance.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-foreground/70">
                      {instance.model}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/70">
                  <span className="font-mono">
                    {instance.host}:{instance.port}
                  </span>
                  <span>\u00b7</span>
                  <span>{instance.gpu}</span>
                  <span>\u00b7</span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />{" "}
                    {uptimeString(instance.startedAt)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h3 className="text-[13px] font-semibold text-foreground">
              Usage statistics
            </h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                icon={<TrendingUp className="size-3.5" />}
                label="Tokens generated"
                value={instance.generatedTokens.toLocaleString()}
                sub={`${instance.promptTokens.toLocaleString()} prompt`}
              />
              <StatTile
                icon={<Cpu className="size-3.5" />}
                label="Total requests"
                value={instance.totalRequests.toLocaleString()}
                sub={`${instance.errorCount} errors`}
              />
              <StatTile
                icon={<Zap className="size-3.5" />}
                label="Peak tok/s"
                value={instance.peakTokensPerSec.toFixed(1)}
                sub={`${instance.tokensPerSec.toFixed(1)} current`}
              />
              <StatTile
                icon={<MemoryStick className="size-3.5" />}
                label="Avg memory"
                value={`${avgMemory} MB`}
                sub={`${instance.ctxSize} ctx`}
              />
            </div>
          </div>

          <ThroughputChart instance={instance} />

          <InstanceConfigMeta instance={instance} />
        </div>

        <div className="space-y-5">
          <InstanceActionsCard
            instance={instance}
            isRunning={isRunning}
            isStopped={isStopped}
            onRemoveClick={() => setConfirmRemove(true)}
          />

          <InstanceStatusLive instance={instance} />

          {isStopped && (
            <p className="px-1 text-[11px] text-muted-foreground">
              Instance is stopped. Historical stats are preserved; live values
              are from the last run.
            </p>
          )}
        </div>
      </div>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove instance?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              <span className="font-semibold">{instance.name}</span> and its
              console log. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                removeInstance(instance.id);
                setConfirmRemove(false);
                onBack();
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { InstanceDetailView };
