"use client";

import * as React from "react";
import { cn, fmtTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollText, Filter, TerminalSquare, Server, Eraser } from "lucide-react";
import {
  useLlamaStore,
  SYSTEM_CONSOLE,
  type LogKind,
  type ConsoleLine,
} from "@/lib/llama-store";

const KINDS: { value: LogKind | "all"; label: string }[] = [
  { value: "all", label: "All levels" },
  { value: "info", label: "Info" },
  { value: "success", label: "Success" },
  { value: "warn", label: "Warnings" },
  { value: "error", label: "Errors" },
  { value: "debug", label: "Debug" },
];

function instanceNameMap(instances: { id: string; name: string }[]) {
  const map = new Map<string, string>();
  map.set(SYSTEM_CONSOLE, "System");
  instances.forEach((i) => map.set(i.id, i.name));
  return map;
}

export function LogsPage() {
  const instances = useLlamaStore((s) => s.instances);
  const logs = useLlamaStore((s) => s.logs);
  const clearConsole = useLlamaStore((s) => s.clearConsole);

  const [instanceFilter, setInstanceFilter] = React.useState<string>("all");
  const [kindFilter, setKindFilter] = React.useState<string>("all");

  const nameMap = React.useMemo(() => instanceNameMap(instances), [instances]);

  const allLines: ConsoleLine[] = React.useMemo(() => {
    const flat: ConsoleLine[] = [];
    Object.entries(logs).forEach(([id, lines]) => {
      lines.forEach((l) => flat.push(l));
      // lines already reference id, but keep for safety
      void id;
    });
    flat.sort((a, b) => a.ts - b.ts);
    return flat;
  }, [logs]);

  const filtered = React.useMemo(() => {
    return allLines.filter((l) => {
      if (instanceFilter !== "all" && l.instanceId !== instanceFilter) return false;
      if (kindFilter !== "all" && l.kind !== kindFilter) return false;
      return true;
    });
  }, [allLines, instanceFilter, kindFilter]);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: allLines.length };
    KINDS.slice(1).forEach((k) => (c[k.value] = 0));
    allLines.forEach((l) => {
      c[l.kind] = (c[l.kind] ?? 0) + 1;
    });
    return c;
  }, [allLines]);

  const clearAll = () => {
    Object.keys(logs).forEach((id) => clearConsole(id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Logs</h1>
          <p className="text-[12px] text-muted-foreground">
            Aggregated log viewer across all instances. {allLines.length} lines total.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={clearAll} disabled={allLines.length === 0}>
          <Eraser className="mr-1.5 size-3.5" />
          Clear all
        </Button>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-border/60 bg-card">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Filter className="size-3.5" />
            Filters
          </div>

          <Select value={instanceFilter} onValueChange={setInstanceFilter}>
            <SelectTrigger size="sm" className="w-[200px]">
              <Server className="mr-1.5 size-3.5 text-muted-foreground" />
              <SelectValue placeholder="Instance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All instances</SelectItem>
              <SelectItem value={SYSTEM_CONSOLE}>
                <span className="flex items-center gap-1.5">
                  <TerminalSquare className="size-3" />
                  System
                </span>
              </SelectItem>
              {instances.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  <span className="flex items-center gap-1.5">
                    <Server className="size-3" />
                    {i.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger size="sm" className="w-[160px]">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {KINDS.slice(1).map((k) => (
              <Badge
                key={k.value}
                variant="secondary"
                className={cn(
                  "gap-1 text-[10px] font-semibold uppercase",
                  k.value === "info" && "bg-blue-500/10 text-blue-700 dark:text-blue-300",
                  k.value === "success" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                  k.value === "warn" && "bg-orange-500/10 text-orange-700 dark:text-orange-300",
                  k.value === "error" && "bg-red-500/10 text-red-700 dark:text-red-300",
                  k.value === "debug" && "bg-muted text-muted-foreground",
                )}
              >
                {k.label}
                <span className="font-mono">{counts[k.value] ?? 0}</span>
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Log output */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <div className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="grid size-14 place-items-center rounded-2xl bg-accent">
                <ScrollText className="size-7 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">No log lines match</p>
                <p className="text-xs text-muted-foreground">
                  Try adjusting your filters or start an instance to generate logs.
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[60vh] min-h-[320px]">
              <div className="console-output px-4 py-3" role="log" aria-live="polite">
                {filtered.map((l) => (
                  <div key={l.id} className={cn("log-line", `log-${l.kind}`)}>
                    <span className="log-time">{fmtTime(l.ts)}</span>
                    <span className="mr-2 inline-flex items-center rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-foreground/60">
                      {nameMap.get(l.instanceId) ?? l.instanceId}
                    </span>
                    <span>{l.text}</span>
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
