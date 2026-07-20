"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useLlamaStore, type LlamaInstance } from "@/lib/llama-store";
import { MetaItem, fmtStartedAt, COLOR_DOT } from "./instances-badges";

function InstanceConfigMeta({ instance }: { instance: LlamaInstance }) {
  const profiles = useLlamaStore((s) => s.profiles);
  const profile = profiles.find((p) => p.name === instance.profile);

  return (
    <Card className="py-0">
      <CardContent className="p-5">
        <h3 className="mb-3 text-[13px] font-semibold text-foreground">
          Configuration
        </h3>
        <Separator className="mb-2" />
        <MetaItem
          label="Context size"
          value={<span className="font-mono">{instance.ctxSize}</span>}
        />
        <MetaItem
          label="Threads"
          value={<span className="font-mono">{instance.threads}</span>}
        />
        <MetaItem
          label="GPU layers"
          value={
            <span className="font-mono">{profile?.gpuLayers ?? "\u2014"}</span>
          }
        />
        <MetaItem
          label="Card color"
          value={
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-2.5 rounded-full",
                  COLOR_DOT[instance.color],
                )}
              />
              {instance.color}
            </span>
          }
        />
        <MetaItem
          label="Started at"
          value={
            <span className="font-mono text-[11px]">
              {fmtStartedAt(instance.startedAt)}
            </span>
          }
        />
      </CardContent>
    </Card>
  );
}

export { InstanceConfigMeta };
