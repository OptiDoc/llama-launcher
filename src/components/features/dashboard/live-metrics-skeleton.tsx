/**
 * Live metrics skeleton component.
 */

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Radio } from "lucide-react";

function LiveMetricsSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Radio className="size-4 text-primary" />
                System Load
              </CardTitle>
              <CardDescription>Real-time telemetry</CardDescription>
            </div>
            <Badge variant="secondary" className="gap-1.5">
              <span className="size-1.5 rounded-full bg-muted-foreground/50" />
              Loading
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {["CPU", "Memory", "GPU VRAM", "GPU compute"].map((label) => (
              <div key={label} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                  <span className="font-mono text-xs text-muted-foreground">--</span>
                </div>
                <Skeleton className="h-1.5 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Utilisation</CardTitle>
          <CardDescription>CPU · RAM · GPU last 60s</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[120px] w-full rounded-lg" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Throughput</CardTitle>
          <CardDescription>Tokens / sec</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[100px] w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}

export { LiveMetricsSkeleton };
