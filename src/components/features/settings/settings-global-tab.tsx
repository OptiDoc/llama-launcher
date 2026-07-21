"use client";

import * as React from "react";
import { useLlamaStore, type GlobalSettings } from "@/lib/llama-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderOpen, Network, Bell, Info, Github, ExternalLink } from "lucide-react";
import { FieldRow, ToggleRow } from "@/components/features/settings/settings-section";

export function GlobalSettingsTab() {
  const g = useLlamaStore((s) => s.globalSettings);
  const update = useLlamaStore((s) => s.updateGlobalSettings);
  const setNum = (key: keyof GlobalSettings, raw: string) => {
    const n = Number(raw);
    update({ [key]: Number.isFinite(n) ? n : 0 } as Partial<GlobalSettings>);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-4">
        <CardHeader className="p-0 mb-3">
          <CardTitle className="flex items-center gap-2 text-[13px]">
            <span className="text-primary">
              <FolderOpen className="size-4" />
            </span>
            Paths
          </CardTitle>
          <CardDescription>Where LlamaLauncher looks for binaries, models and CUDA libraries.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 space-y-3">
          <FieldRow id="g-llama-cpp-path" label="llama.cpp binary" hint="Path to the llama-server executable">
            <Input
              id="g-llama-cpp-path"
              value={g.llamaCppPath}
              onChange={(e) => update({ llamaCppPath: e.target.value })}
              className="font-mono text-xs h-8"
            />
          </FieldRow>
          <FieldRow id="g-models-dir" label="Models directory" hint="Where to look for .gguf files">
            <Input
              id="g-models-dir"
              value={g.modelsDir}
              onChange={(e) => update({ modelsDir: e.target.value })}
              className="font-mono text-xs h-8"
            />
          </FieldRow>
          <FieldRow
            id="g-cuda-libs"
            label="CUDA libraries"
            hint="Used to copy CUDA libs into downloaded CUDA release builds"
          >
            <Input
              id="g-cuda-libs"
              value={g.cudaLibsDir}
              onChange={(e) => update({ cudaLibsDir: e.target.value })}
              className="font-mono text-xs h-8"
            />
          </FieldRow>
        </CardContent>
      </Card>

      <Card className="p-4">
        <CardHeader className="p-0 mb-3">
          <CardTitle className="flex items-center gap-2 text-[13px]">
            <span className="text-primary">
              <Network className="size-4" />
            </span>
            Network
          </CardTitle>
          <CardDescription>Default bind address and port range for new llama-server instances.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 space-y-3">
          <FieldRow id="g-host" label="Default host" hint="Bind address for new instances">
            <Input
              id="g-host"
              value={g.defaultHost}
              onChange={(e) => update({ defaultHost: e.target.value })}
              className="font-mono text-xs h-8"
            />
          </FieldRow>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow id="g-port-start" label="Port range start" hint="Auto-allocated from">
              <Input
                id="g-port-start"
                type="number"
                value={g.portRangeStart}
                onChange={(e) => setNum("portRangeStart", e.target.value)}
                className="font-mono text-xs h-8"
              />
            </FieldRow>
            <FieldRow id="g-port-end" label="Port range end" hint="Inclusive upper bound">
              <Input
                id="g-port-end"
                type="number"
                value={g.portRangeEnd}
                onChange={(e) => setNum("portRangeEnd", e.target.value)}
                className="font-mono text-xs h-8"
              />
            </FieldRow>
          </div>
          <div className="rounded-lg bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
            OpenAI-compatible endpoints are exposed at{" "}
            <code className="font-mono text-foreground">{g.defaultHost}:&lt;port&gt;/v1/chat/completions</code>.
          </div>
        </CardContent>
      </Card>

      <Card className="p-4 lg:col-span-2">
        <CardHeader className="p-0 mb-3">
          <CardTitle className="flex items-center gap-2 text-[13px]">
            <span className="text-primary">
              <Bell className="size-4" />
            </span>
            Updates & notifications
          </CardTitle>
          <CardDescription>Control release tracking and desktop alerts.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <ToggleRow
              id="g-check-releases"
              label="Check for new llama.cpp releases on GitHub"
              hint="Poll the ggerganov/llama.cpp releases feed."
              checked={!!g.checkForReleases}
              onChange={(v) => update({ checkForReleases: v })}
            />
            <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center sm:gap-4">
              <div>
                <Label className="text-sm font-medium">Release channel</Label>
                <p className="text-xs text-muted-foreground">Which release tags to surface.</p>
              </div>
              <Select
                value={g.releaseChannel}
                onValueChange={(v) => update({ releaseChannel: v as GlobalSettings["releaseChannel"] })}
              >
                <SelectTrigger id="g-release-channel" className="w-full h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stable">stable</SelectItem>
                  <SelectItem value="pre-release">pre-release</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ToggleRow
              id="g-notify-release"
              label="Notify on new release"
              hint="Desktop notification when a new release is available."
              checked={!!g.notifyOnNewRelease}
              onChange={(v) => update({ notifyOnNewRelease: v })}
              disabled={!g.checkForReleases}
            />
            <ToggleRow
              id="g-notify-crash"
              label="Notify on instance crash"
              hint="Alert when a server exits unexpectedly."
              checked={!!g.notifyOnCrash}
              onChange={(v) => update({ notifyOnCrash: v })}
            />
            <ToggleRow
              id="g-notify-mem"
              label="Notify on high memory usage"
              hint="Alert when VRAM usage exceeds 90%."
              checked={!!g.notifyOnHighMemory}
              onChange={(v) => update({ notifyOnHighMemory: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="p-4 lg:col-span-2">
        <CardHeader className="p-0 mb-3">
          <CardTitle className="flex items-center gap-2 text-[13px]">
            <span className="text-primary">
              <Info className="size-4" />
            </span>
            About
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
                <span className="text-base font-bold">L</span>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-foreground">LlamaLauncher</div>
                <div className="text-xs text-muted-foreground">Version 0.4.2 · llama.cpp build b4402</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="https://github.com/ggerganov/llama.cpp" target="_blank" rel="noreferrer">
                  <Github className="mr-1.5 size-3.5" />
                  llama.cpp
                  <ExternalLink className="ml-1.5 size-3" />
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://github.com/ggerganov/llama.cpp/blob/master/docs/server.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  Server docs
                  <ExternalLink className="ml-1.5 size-3" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
