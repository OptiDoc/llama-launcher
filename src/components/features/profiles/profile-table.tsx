"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useLlamaStore, type LlamaProfile } from "@/lib/llama-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Wand2, Share2, Check } from "lucide-react";
import { ScopeBadge } from "./profiles-badges";

function ProfileTable({ profiles, onSelect }: {
  profiles: LlamaProfile[]; onSelect: (id: string) => void;
}) {
  const models = useLlamaStore((s) => s.models);
  const shareProfile = useLlamaStore((s) => s.shareProfile);
  const calibrateProfile = useLlamaStore((s) => s.calibrateProfile);
  const [busy, setBusy] = React.useState<string | null>(null);
  const modelName = (p: LlamaProfile) => models.find((m) => m.id === p.modelId)?.name;

  const onCalib = (e: React.MouseEvent, p: LlamaProfile) => {
    e.stopPropagation();
    setBusy(p.id);
    setTimeout(() => { calibrateProfile(p.id); setBusy(null); }, 1200);
  };
  const onShare = (e: React.MouseEvent, p: LlamaProfile) => {
    e.stopPropagation();
    if (!p.shared) shareProfile(p.id);
  };

  return (
    <Card className="p-0">
      <Table>
        <TableHeader>
          <TableRow className="border-border/60">
            <TableHead className="pl-4">Name</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead className="text-right">Ctx</TableHead>
            <TableHead className="text-right">Threads</TableHead>
            <TableHead className="text-right">GPU layers</TableHead>
            <TableHead className="text-center">Calibration</TableHead>
            <TableHead className="text-center">Shared</TableHead>
            <TableHead className="pr-4 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((p) => (
            <TableRow key={p.id} onClick={() => onSelect(p.id)} className="cursor-pointer border-border/60">
              <TableCell className="pl-4 py-3">
                <div className="flex flex-col">
                  <span className="font-medium">{p.name}</span>
                  <span className="max-w-[280px] truncate text-xs text-muted-foreground">{p.description}</span>
                </div>
              </TableCell>
              <TableCell className="py-3"><ScopeBadge scope={p.scope} modelName={modelName(p)} /></TableCell>
              <TableCell className="py-3 text-right font-mono text-xs">{p.ctxSize.toLocaleString()}</TableCell>
              <TableCell className="py-3 text-right font-mono text-xs">{p.threads}</TableCell>
              <TableCell className="py-3 text-right font-mono text-xs">{p.gpuLayers}</TableCell>
              <TableCell className="py-3 text-center">
                {typeof p.calibrationScore === "number" ? (
                  <div className="flex items-center justify-center gap-1.5">
                    <Progress value={p.calibrationScore} className="h-1.5 w-12" />
                    <span className="font-mono text-[10px] text-muted-foreground">{p.calibrationScore}</span>
                  </div>
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="py-3 text-center">
                {p.shared ? (
                  <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Check className="size-3" />
                  </Badge>
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="pr-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1">
                  <Button size="sm" variant="ghost" className="px-2"
                    onClick={(e) => onCalib(e, p)} disabled={busy === p.id}>
                    <Wand2 className={cn("mr-1 size-3", busy === p.id && "animate-spin")} />
                    Calib
                  </Button>
                  <Button size="sm" variant="ghost" className="px-2" onClick={(e) => onShare(e, p)}>
                    <Share2 className="size-3" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export { ProfileTable };
