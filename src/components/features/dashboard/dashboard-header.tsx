"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Activity, Plus } from "lucide-react";

export function DashboardHeader() {
  return (
    <div className="flex items-end justify-between">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Monitor running llama.cpp servers, GPU utilisation and request throughput.
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm">
          <Activity className="size-3" />
          Refresh
        </Button>
        <Button size="sm">
          <Plus className="size-3" />
          New Instance
        </Button>
      </div>
    </div>
  );
}
