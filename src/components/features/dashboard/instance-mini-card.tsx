"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Server } from "lucide-react";
import { useLlamaStore, uptimeString } from "@/lib/llama-store";

function InstanceMiniCard({
  instance,
  onOpen,
}: {
  instance: ReturnType<typeof useLlamaStore.getState>["instances"][number];
  onOpen: () => void;
}) {
  const statusVariant =
    instance.status === "running" ? "default" : instance.status === "starting" ? "secondary" : "outline";

  const memPercent =
    instance.status === "running" ? Math.min(100, (instance.memoryMb / (instance.ctxSize * 0.5 + 1200)) * 100) : 0;

  return (
    <Card className="py-4 transition-shadow hover:shadow-md">
      <CardContent className="px-4">
        <div className="flex items-start justify-between">
          <div className={cn("grid size-8 place-items-center rounded-lg", `card-${instance.color}`)}>
            <Server className="size-4" />
          </div>
          <Badge variant={statusVariant} className="text-[10px] uppercase">
            {instance.status}
          </Badge>
        </div>
        <h3 className="mt-2.5 text-sm font-semibold text-foreground">{instance.name}</h3>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{instance.model}</p>

        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Port :{instance.port}</span>
          <span className="font-mono text-muted-foreground">{uptimeString(instance.startedAt)}</span>
        </div>

        <Progress value={memPercent} className="mt-2 h-1.5" />

        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {instance.tokensPerSec.toFixed(1)} tok/s · {instance.requestsPerMin} req/min
          </div>
          <Button variant="secondary" size="sm" onClick={onOpen} className="px-2">
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export { InstanceMiniCard };
