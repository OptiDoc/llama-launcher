"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CARD_COLORS } from "./model-card";
import { fmtBytes } from "@/lib/llama-store";
import { FolderOpen } from "lucide-react";

export function ExternalModelCard({ dir, index }: { dir: any; index: number }) {
  const color = CARD_COLORS[index % CARD_COLORS.length];

  return (
    <Card className={cn("overflow-hidden p-0 shadow-none", `card-${color}`)}>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/60 dark:bg-black/20">
              <FolderOpen className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{dir.display_name}</h3>
              <p className="text-xs text-foreground/70">
                {dir.model_count} model{dir.model_count !== 1 && 's'} • {fmtBytes(dir.total_size_mb * 1024 * 1024)}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0 bg-white/60 text-[10px] font-semibold dark:bg-black/20">
            {dir.source}
          </Badge>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground truncate font-mono">{dir.path}</p>

          {dir.files.length > 0 && (
            <div className="space-y-1">
              {dir.files.slice(0, 3).map((file: any) => (
                <div key={file.id} className="flex items-center justify-between text-[10px]">
                  <span className="truncate text-muted-foreground font-mono">{file.filename}</span>
                  <span className="text-muted-foreground">{fmtBytes(file.size_mb * 1024 * 1024)}</span>
                </div>
              ))}
              {dir.files.length > 3 && (
                <div className="text-[10px] text-muted-foreground">
                  +{dir.files.length - 3} more file{dir.files.length > 4 && 's'}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
