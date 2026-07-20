/**
 * Model detail view — header section.
 */

"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { FamilyBadge } from "./models-badges";
import { fmtBytes } from "@/lib/llama-store";
import type { LlamaModel } from "@/lib/llama-store";
import { ArrowLeft, Boxes, Cpu, HardDrive } from "lucide-react";

export function ModelDetailHeader({
  model, onBack,
}: {
  model: LlamaModel; onBack: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumbs items={[{ label: "Models", onClick: onBack }, { label: model.name }]} />
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5 size-3.5" /> Back
        </Button>
      </div>

      <Card className="shadow-none">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted">
                <Boxes className="size-6 text-foreground/70" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{model.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px] font-semibold">{model.builder}</Badge>
                  <FamilyBadge family={model.family} />
                  <Badge variant="secondary" className="gap-1 text-[10px] font-semibold">
                    <Cpu className="size-2.5" /> {model.quant}
                  </Badge>
                  <Badge variant="secondary" className="gap-1 text-[10px] font-semibold">
                    <HardDrive className="size-2.5" /> {fmtBytes(model.sizeGb)}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{model.description}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
