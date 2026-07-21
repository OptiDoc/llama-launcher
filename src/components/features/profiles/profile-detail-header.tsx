/**
 * Profile detail view — header section.
 */

"use client";

import { cn } from "@/lib/utils";
import { useLlamaStore, type LlamaProfile } from "@/lib/llama-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScopeBadge, SharedBadge } from "./profiles-badges";
import { Cpu, ArrowLeft } from "lucide-react";

export function ProfileDetailHeader({ profile, onBack }: { profile: LlamaProfile; onBack: () => void }) {
  const models = useLlamaStore((s) => s.models);
  const boundModel = models.find((m) => m.id === profile.modelId);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1.5 size-3.5" /> Back
          </Button>
        </div>
      </div>

      <Card className="py-0">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <Cpu className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">{profile.name}</h2>
                <ScopeBadge scope={profile.scope} modelName={boundModel?.name} />
                {profile.shared && <SharedBadge />}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{profile.description}</p>
              {boundModel && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Bound model: <span className="font-medium text-foreground/80">{boundModel.name}</span>
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
