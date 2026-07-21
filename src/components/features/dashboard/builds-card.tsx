"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Boxes, Download, CheckCircle2 } from "lucide-react";
import { useLlamaStore, RELEASE_VARIANTS } from "@/lib/llama-store";

export function BuildsCard() {
  const releases = useLlamaStore((s) => s.releases);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Boxes className="size-3.5 text-primary" />
              llama.cpp Builds
            </CardTitle>
            <CardDescription>Available release variants</CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">
            {releases.filter((r) => r.installed).length} installed
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {RELEASE_VARIANTS.map((v) => {
            const variantReleases = releases.filter((r) => r.variant === v.id);
            const installed = variantReleases.some((r) => r.installed);
            return (
              <div
                key={v.id}
                className={cn(
                  "rounded-lg border p-2.5",
                  v.priority ? "border-primary/20 bg-primary/5" : "border-border/40 bg-muted/20",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">{v.label}</span>
                  {installed ? (
                    <CheckCircle2 className="size-3 text-emerald-500" />
                  ) : v.priority ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Priority
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{v.note}</p>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Download className="size-2" />
                  {variantReleases.length} builds
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
