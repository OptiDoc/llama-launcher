"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Zap, Hash, MemoryStick, Clock } from "lucide-react";
import { uptimeString, type LlamaInstance } from "@/lib/llama-store";
import { MetaItem, STATUS_STYLE } from "./instances-badges";

function InstanceStatusLive({ instance }: { instance: LlamaInstance }) {
  return (
    <Card className="py-0">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-foreground">
            Live status
          </h3>
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px] uppercase",
              STATUS_STYLE[instance.status],
            )}
          >
            {instance.status}
          </Badge>
        </div>
        <Separator className="mb-2" />
        <MetaItem
          label="Throughput"
          value={
            <span className="flex items-center gap-1 font-mono">
              <Zap className="size-3" />{" "}
              {instance.tokensPerSec.toFixed(1)} tok/s
            </span>
          }
        />
        <MetaItem
          label="Requests / min"
          value={
            <span className="flex items-center gap-1 font-mono">
              <Hash className="size-3" /> {instance.requestsPerMin}
            </span>
          }
        />
        <MetaItem
          label="Memory"
          value={
            <span className="flex items-center gap-1 font-mono">
              <MemoryStick className="size-3" />{" "}
              {instance.memoryMb > 0
                ? `${instance.memoryMb} MB`
                : "\u2014"}
            </span>
          }
        />
        <MetaItem
          label="Uptime"
          value={
            <span className="flex items-center gap-1 font-mono">
              <Clock className="size-3" />{" "}
              {uptimeString(instance.startedAt)}
            </span>
          }
        />
      </CardContent>
    </Card>
  );
}

export { InstanceStatusLive };
