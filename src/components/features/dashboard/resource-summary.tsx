"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useLlamaStore } from "@/lib/llama-store";

export function InstanceSummary() {
  const instances = useLlamaStore((s) => s.instances);

  const running = instances.filter((i) => i.status === "running" || i.status === "starting");

  return (
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
  );
}

export function DownloadedModels() {
  const models = useLlamaStore((s) => s.models);

  return (
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
  );
}
