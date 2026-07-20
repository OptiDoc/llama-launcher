"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Download,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { useLlamaStore, type LlamaRelease } from "@/lib/llama-store";
import { InstalledBadge } from "./release-badge";

// ---------- Animated install progress ----------

function InstallFillBar({
  progress,
  className,
}: {
  progress: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div
      className={cn(
        "relative h-6 w-full overflow-hidden rounded bg-emerald-500/10",
        className,
      )}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Downloading release"
    >
      <div
        className="absolute inset-y-0 left-0 bg-emerald-500/80"
        style={{ width: `${pct}%`, transition: "width 180ms linear" }}
      />
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-emerald-900 dark:text-emerald-50">
        {pct}%
      </div>
    </div>
  );
}

// ---------- Status cell (table + grid) ----------

export function StatusCell({ release }: { release: LlamaRelease }) {
  if (release.installing) {
    const pct = Math.max(0, Math.min(100, Math.round(release.installProgress ?? 0)));
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
          Installing… {pct}%
        </span>
        <div className="relative h-1.5 w-28 overflow-hidden rounded-full bg-emerald-500/15">
          <div
            className="absolute inset-y-0 left-0 bg-emerald-500"
            style={{ width: `${pct}%`, transition: "width 180ms linear" }}
          />
        </div>
      </div>
    );
  }
  if (release.installed) return <InstalledBadge />;
  return (
    <Badge variant="secondary" className="bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
      Available
    </Badge>
  );
}

// ---------- Action control (button / progress / installed+uninstall) ----------

export function ActionControl({
  release,
  compact = false,
}: {
  release: LlamaRelease;
  compact?: boolean;
}) {
  const startReleaseDownload = useLlamaStore((s) => s.startReleaseDownload);
  const uninstallRelease = useLlamaStore((s) => s.uninstallRelease);

  if (release.installing) {
    return (
      <div className="flex h-6 w-28 items-center">
        <InstallFillBar progress={release.installProgress ?? 0} className="h-6 w-full" />
      </div>
    );
  }

  if (release.installed) {
    return (
      <div className="flex h-6 items-center gap-1">
        <InstalledBadge />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground"
              aria-label="Release actions"
            >
              <MoreHorizontal className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              variant="destructive"
              onClick={() => uninstallRelease(release.id)}
            >
              <Trash2 className="size-3.5" />
              Uninstall
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="flex h-6 items-center">
      <Button
        variant="ghost"
        size="icon"
        className="size-6 text-muted-foreground hover:bg-primary/10 hover:text-primary"
        onClick={() => startReleaseDownload(release.id)}
        aria-label={`Download and install ${release.tag} (${release.variant})`}
        title="Download & install"
      >
        <Download className="size-3.5" />
      </Button>
    </div>
  );
}
