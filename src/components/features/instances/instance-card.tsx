"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLlamaStore, uptimeString, type LlamaInstance } from "@/lib/llama-store";
import {
  Server,
  Play,
  Square,
  Trash2,
  TerminalSquare,
  Cpu,
  MemoryStick,
  Clock,
  Network,
  Zap,
} from "lucide-react";
import { StatusBadge, CardStat } from "./instances-badges";

function InstanceCard({
  instance,
  onSelect,
}: {
  instance: LlamaInstance;
  onSelect: (id: string) => void;
}) {
  const stopInstance = useLlamaStore((s) => s.stopInstance);
  const startInstance = useLlamaStore((s) => s.startInstance);
  const removeInstance = useLlamaStore((s) => s.removeInstance);
  const setActiveConsole = useLlamaStore((s) => s.setActiveConsole);

  const isRunning =
    instance.status === "running" || instance.status === "starting";
  const isStopped = instance.status === "stopped";

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(instance.id);
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onSelect(instance.id)}
      onKeyDown={handleKey}
      className={cn(
        `card-${instance.color}`,
        "cursor-pointer transition-all duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 py-0",
      )}
    >
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-card">
              <Server className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{instance.name}</h3>
              <p className="truncate text-xs text-foreground/70">
                {instance.model}
              </p>
            </div>
          </div>
          <StatusBadge status={instance.status} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <CardStat
            icon={<Network className="size-3.5" />}
            label="Port"
            value={`:${instance.port}`}
          />
          <CardStat
            icon={<Clock className="size-3.5" />}
            label="Uptime"
            value={uptimeString(instance.startedAt)}
          />
          <CardStat
            icon={<Zap className="size-3.5" />}
            label="Tok/s"
            value={instance.tokensPerSec.toFixed(1)}
          />
          <CardStat
            icon={<Cpu className="size-3.5" />}
            label="Req/min"
            value={String(instance.requestsPerMin)}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11px]">
          <span className="flex items-center gap-1.5 text-foreground/70">
            <MemoryStick className="size-3.5" />
            Memory
          </span>
          <span className="font-mono font-semibold">
            {instance.memoryMb > 0 ? `${instance.memoryMb} MB` : "\u2014"}
          </span>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 text-xs"
            onClick={() => setActiveConsole(instance.id)}
          >
            <TerminalSquare className="mr-1.5 size-3.5" />
            Console
          </Button>
          {isRunning ? (
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 text-xs text-red-600 dark:text-red-300"
              onClick={() => stopInstance(instance.id)}
            >
              <Square className="mr-1.5 size-3.5" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              className="flex-1 text-xs"
              disabled={instance.status === "stopping"}
              onClick={() =>
                startInstance({
                  name: instance.name,
                  model: instance.model,
                  profile: instance.profile,
                  port: instance.port,
                  host: instance.host,
                  gpu: instance.gpu,
                })
              }
            >
              <Play className="mr-1.5 size-3.5" />
              Start
            </Button>
          )}
          {isStopped && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="px-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => removeInstance(instance.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove instance</TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export { InstanceCard };
