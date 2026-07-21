"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLlamaStore, uptimeString, type LlamaInstance } from "@/lib/llama-store";
import { TerminalSquare, Play, Square, Trash2 } from "lucide-react";
import { StatusBadge, COLOR_DOT } from "./instances-badges";

function TableActions({ instance }: { instance: LlamaInstance }) {
  const stopInstance = useLlamaStore((s) => s.stopInstance);
  const startInstance = useLlamaStore((s) => s.startInstance);
  const removeInstance = useLlamaStore((s) => s.removeInstance);
  const setActiveConsole = useLlamaStore((s) => s.setActiveConsole);
  const isRunning = instance.status === "running" || instance.status === "starting";
  const isStopped = instance.status === "stopped";

  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="ghost" className="px-2" onClick={() => setActiveConsole(instance.id)}>
            <TerminalSquare className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open console</TooltipContent>
      </Tooltip>
      {isRunning ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-red-600 hover:text-red-700"
              onClick={() => stopInstance(instance.id)}
            >
              <Square className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Stop</TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="px-2"
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
              <Play className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Start</TooltipContent>
        </Tooltip>
      )}
      {isStopped && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-muted-foreground hover:text-destructive"
              onClick={() => removeInstance(instance.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Remove</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function InstanceTable({ instances, onSelect }: { instances: LlamaInstance[]; onSelect: (id: string) => void }) {
  return (
    <Card className="py-0">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60">
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Port</TableHead>
              <TableHead>Uptime</TableHead>
              <TableHead className="text-right">Tok/s</TableHead>
              <TableHead className="text-right">Req/min</TableHead>
              <TableHead className="text-right">Mem</TableHead>
              <TableHead className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {instances.map((inst) => (
              <TableRow key={inst.id} onClick={() => onSelect(inst.id)} className="cursor-pointer border-border/60">
                <TableCell className="pl-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className={cn("size-2 rounded-full", COLOR_DOT[inst.color])} />
                    <span className="font-medium">{inst.name}</span>
                  </div>
                </TableCell>
                <TableCell className="max-w-[220px] truncate py-3 text-foreground/70">{inst.model}</TableCell>
                <TableCell className="py-3">
                  <StatusBadge status={inst.status} />
                </TableCell>
                <TableCell className="py-3 font-mono text-xs">:{inst.port}</TableCell>
                <TableCell className="py-3 text-xs text-foreground/70">{uptimeString(inst.startedAt)}</TableCell>
                <TableCell className="py-3 text-right font-mono text-xs">{inst.tokensPerSec.toFixed(1)}</TableCell>
                <TableCell className="py-3 text-right font-mono text-xs">{inst.requestsPerMin}</TableCell>
                <TableCell className="py-3 text-right font-mono text-xs">
                  {inst.memoryMb > 0 ? `${inst.memoryMb} MB` : "\u2014"}
                </TableCell>
                <TableCell className="pr-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <TableActions instance={inst} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export { InstanceTable, TableActions };
