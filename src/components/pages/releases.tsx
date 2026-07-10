"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket, CheckCircle2, Download, GitCommit, Calendar, Sparkles } from "lucide-react";
import { useLlamaStore, type LlamaRelease } from "@/lib/llama-store";

function ReleaseRow({ release }: { release: LlamaRelease }) {
  const installRelease = useLlamaStore((s) => s.installRelease);
  const [installing, setInstalling] = React.useState(false);

  const install = () => {
    if (release.installed || installing) return;
    setInstalling(true);
    setTimeout(() => {
      installRelease(release.id);
      setInstalling(false);
    }, 700);
  };

  return (
    <Card className={cn("overflow-hidden border shadow-sm", release.installed && "bg-emerald-50/40 dark:bg-emerald-950/10")}>
      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-xl",
              release.installed
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-primary/10 text-primary",
            )}
          >
            <Rocket className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold">{release.tag}</span>
              {release.installed ? (
                <Badge
                  variant="secondary"
                  className="gap-1 bg-emerald-500/15 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300"
                >
                  <CheckCircle2 className="size-3" />
                  Installed
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="bg-muted text-[10px] font-semibold uppercase text-muted-foreground"
                >
                  Available
                </Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3" />
                {release.publishedAt}
              </span>
              <span className="flex items-center gap-1.5">
                <GitCommit className="size-3" />
                <span className="font-mono">{release.commit}</span>
              </span>
            </div>
            <p className="mt-1.5 text-xs text-foreground/70">{release.notes}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {release.installed ? (
            <Badge variant="outline" className="gap-1 text-xs">
              <Sparkles className="size-3 text-emerald-500" />
              Active build
            </Badge>
          ) : (
            <Button size="sm" onClick={install} disabled={installing}>
              <Download className="mr-1.5 size-3.5" />
              {installing ? "Installing…" : "Install"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ReleasesPage() {
  const releases = useLlamaStore((s) => s.releases);
  const installed = releases.find((r) => r.installed);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Releases</h1>
          <p className="text-sm text-muted-foreground">
            llama.cpp builds. Active build:{" "}
            <span className="font-mono font-semibold text-foreground">
              {installed?.tag ?? "none"}
            </span>
            .
          </p>
        </div>
        <Button size="sm" variant="outline">
          <Download className="mr-1.5 size-3.5" />
          Check for updates
        </Button>
      </div>

      <div className="space-y-3">
        {releases.map((r) => (
          <ReleaseRow key={r.id} release={r} />
        ))}
      </div>
    </div>
  );
}
