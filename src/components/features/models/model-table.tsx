"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useLlamaStore, fmtBytes } from "@/lib/llama-store";
import type { LlamaModel } from "@/lib/llama-store";
import { FamilyBadge, ArchBadge, MoeBadge } from "./models-badges";
import { StatusBadge } from "./status-badge";
import type { CardActions } from "./model-card";
import { AlertTriangle, Boxes, Download, Edit3, Loader2, Play, Trash2, XSquare } from "lucide-react";

export function ModelTable({
  models,
  actions,
  gpuVramGb,
}: {
  models: LlamaModel[];
  actions: CardActions;
  gpuVramGb: number;
}) {
  return (
    <Card className="shadow-none py-0">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60">
              <TableHead className="pl-4 text-xs uppercase tracking-wide text-muted-foreground">Name</TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Builder</TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Family</TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Arch</TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Type</TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Quant</TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Size</TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Status</TableHead>
              <TableHead className="pr-4 text-right text-xs uppercase tracking-wide text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((m) => {
              const isDownloading = m.downloading === true;
              const progress = Math.round(m.downloadProgress ?? 0);
              const overVram = gpuVramGb > 0 && m.sizeGb > gpuVramGb;
              return (
                <TableRow
                  key={m.id}
                  onClick={isDownloading ? undefined : () => actions.onSelect(m)}
                  className={cn(
                    isDownloading ? "cursor-default opacity-90" : "cursor-pointer",
                    m.missing && "opacity-60",
                  )}
                >
                  <TableCell className="pl-4 py-3">
                    <div className="flex items-center gap-2">
                      <Boxes className="size-4 shrink-0 text-foreground/50" />
                      <span className="text-sm font-medium">{m.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-xs text-muted-foreground">{m.builder}</TableCell>
                  <TableCell className="py-3">
                    <FamilyBadge family={m.family} />
                  </TableCell>
                  <TableCell className="py-3">
                    <ArchBadge architecture={m.architecture} />
                  </TableCell>
                  <TableCell className="py-3">
                    <MoeBadge isMoe={m.isMoe} expertCount={m.expertCount} />
                  </TableCell>
                  <TableCell className="py-3 text-xs font-mono text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {m.quant}
                      {overVram && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertTriangle className="size-3 text-amber-600 dark:text-amber-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Model size ({m.sizeGb} GB) exceeds GPU VRAM ({gpuVramGb} GB). May require CPU offloading or
                            fail to load.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 text-xs text-muted-foreground">{fmtBytes(m.sizeGb)}</TableCell>
                  <TableCell className="py-3">
                    <StatusBadge model={m} />
                  </TableCell>
                  <TableCell className="pr-4 py-3">
                    {isDownloading ? (
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-muted/60">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-[width] duration-200 ease-linear"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">{progress}%</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            useLlamaStore.getState().cancelDownload(m.downloadId ?? "");
                          }}
                        >
                          <XSquare className="size-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        {m.downloaded && !m.missing && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  actions.onLoad(m);
                                }}
                              >
                                <Play className="size-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Launch instance</TooltipContent>
                          </Tooltip>
                        )}
                        {!m.downloaded && !m.missing && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  actions.onDownload(m);
                                }}
                              >
                                <Download className="size-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                actions.onEdit(m);
                              }}
                            >
                              <Edit3 className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                actions.onEdit(m);
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete (in edit dialog)</TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
