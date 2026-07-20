"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, GitCommit, Info, Package } from "lucide-react";
import { type LlamaRelease, type ReleaseVariant } from "@/lib/llama-store";
import { VariantBadge, VARIANT_LABEL, VARIANT_NOTE, isCuda, CUDA_NOTE } from "./release-badge";
import { StatusCell, ActionControl } from "./release-status";

// ---------- Grid view ----------

const ReleaseCard = React.memo(function ReleaseCard({ release }: { release: LlamaRelease }) {
  return (
    <Card className="overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lifted">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold">{release.tag}</span>
              {release.priority && (
                <Badge variant="secondary" className="bg-primary/10 text-[9px] font-semibold uppercase text-primary">
                  Priority
                </Badge>
              )}
            </div>
            <VariantBadge variant={release.variant as ReleaseVariant} withCudaNote />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground"
                aria-label="Release notes"
              >
                <Info className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 text-xs" align="end">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <Package className="size-3.5" />
                  {release.tag} · {VARIANT_LABEL[release.variant as ReleaseVariant]}
                </div>
                <p className="text-muted-foreground">{release.notes}</p>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <GitCommit className="size-3" />
                  <span className="font-mono">{release.commit}</span>
                </div>
                <div className="text-muted-foreground">{VARIANT_NOTE[release.variant as ReleaseVariant]}</div>
                {isCuda(release.variant as ReleaseVariant) && (
                  <div className="rounded-md bg-primary/5 p-2 text-[11px] text-primary/80">{CUDA_NOTE}</div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="size-3" />
            {release.publishedAt}
          </span>
          <span className="font-mono">{release.sizeMb} MB</span>
        </div>
        <div className="flex h-8 items-center justify-between gap-2 border-t pt-3">
          <StatusCell release={release} />
          <ActionControl release={release} compact />
        </div>
      </CardContent>
    </Card>
  );
});

export function GridView({ releases }: { releases: LlamaRelease[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {releases.map((r) => (
        <ReleaseCard key={r.id} release={r} />
      ))}
    </div>
  );
}
