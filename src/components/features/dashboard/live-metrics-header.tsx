/**
 * Live metrics column — header section.
 */

"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { LiveIndicator } from "./dashboard-charts";
import { Radio } from "lucide-react";

interface LiveMetricsHeaderProps {
  isLive: boolean;
  appStatus: string;
}

export function LiveMetricsHeader({ isLive, appStatus }: LiveMetricsHeaderProps) {
  return (
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
          <LiveIndicator label={isLive ? "Live" : appStatus} />
        </div>
      </CardHeader>
    </Card>
  );
}
