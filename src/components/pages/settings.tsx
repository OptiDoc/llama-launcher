"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Cpu,
  Network,
  Bell,
  Info,
  FolderOpen,
  Github,
  ExternalLink,
  HardDrive,
  Save,
} from "lucide-react";

function FieldRow({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[260px_1fr] sm:items-center sm:gap-4">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 px-3 py-2.5">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function SettingsPage() {
  const [binaryPath, setBinaryPath] = React.useState("/opt/llama.cpp/build/llama-server");
  const [modelsDir, setModelsDir] = React.useState("/models");
  const [device, setDevice] = React.useState("NVIDIA RTX 4070");
  const [gpuLayers, setGpuLayers] = React.useState("99");
  const [host, setHost] = React.useState("127.0.0.1");
  const [portRange, setPortRange] = React.useState("8080-8099");
  const [notifyCrash, setNotifyCrash] = React.useState(true);
  const [notifyMem, setNotifyMem] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure paths, defaults, GPU and notifications for LlamaLauncher.
          </p>
        </div>
        <Button size="sm" onClick={save}>
          <Save className="mr-1.5 size-3.5" />
          {saved ? "Saved" : "Save changes"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* General */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Settings className="size-4 text-primary" />
              General
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldRow
              id="binary-path"
              label="llama.cpp binary"
              hint="Path to the llama-server executable"
            >
              <Input
                id="binary-path"
                value={binaryPath}
                onChange={(e) => setBinaryPath(e.target.value)}
                className="font-mono text-xs"
              />
            </FieldRow>
            <FieldRow
              id="models-dir"
              label="Models directory"
              hint="Where to look for .gguf files"
            >
              <div className="flex gap-2">
                <Input
                  id="models-dir"
                  value={modelsDir}
                  onChange={(e) => setModelsDir(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="sm" className="shrink-0">
                  <FolderOpen className="size-3.5" />
                </Button>
              </div>
            </FieldRow>
            <Separator />
            <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5">
              <div>
                <Label className="text-sm font-medium">Theme</Label>
                <p className="text-xs text-muted-foreground">Follows system preference</p>
              </div>
              <Badge variant="secondary" className="text-[10px] font-semibold uppercase">
                Auto
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* GPU */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Cpu className="size-4 text-primary" />
              GPU
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldRow id="gpu-device" label="Device" hint="Active accelerator">
              <Select value={device} onValueChange={setDevice}>
                <SelectTrigger id="gpu-device" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NVIDIA RTX 4070">NVIDIA RTX 4070 (12 GB)</SelectItem>
                  <SelectItem value="NVIDIA RTX 3090">NVIDIA RTX 3090 (24 GB)</SelectItem>
                  <SelectItem value="Apple M2 Pro">Apple M2 Pro (16 GB unified)</SelectItem>
                  <SelectItem value="CPU">CPU only</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow
              id="gpu-layers"
              label="Default GPU layers"
              hint="Layers offloaded to GPU (-ngl)"
            >
              <Input
                id="gpu-layers"
                type="number"
                value={gpuLayers}
                onChange={(e) => setGpuLayers(e.target.value)}
              />
            </FieldRow>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/40 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <HardDrive className="size-3" />
                  VRAM
                </div>
                <div className="mt-0.5 text-sm font-semibold">12.0 GB</div>
              </div>
              <div className="rounded-lg bg-muted/40 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Cpu className="size-3" />
                  Compute
                </div>
                <div className="mt-0.5 text-sm font-semibold">CUDA 12.4</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Network */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Network className="size-4 text-primary" />
              Network
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldRow id="net-host" label="Default host" hint="Bind address for new instances">
              <Input
                id="net-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="font-mono text-xs"
              />
            </FieldRow>
            <FieldRow
              id="net-ports"
              label="Port range"
              hint="Auto-allocated from this range"
            >
              <Input
                id="net-ports"
                value={portRange}
                onChange={(e) => setPortRange(e.target.value)}
                className="font-mono text-xs"
              />
            </FieldRow>
            <Separator />
            <div className="rounded-lg bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
              OpenAI-compatible endpoints are exposed at{" "}
              <code className="font-mono text-foreground">
                {host}:&lt;port&gt;/v1/chat/completions
              </code>
              .
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Bell className="size-4 text-primary" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              id="notify-crash"
              label="Notify on instance crash"
              hint="Show a desktop notification when a server exits unexpectedly."
              checked={notifyCrash}
              onChange={setNotifyCrash}
            />
            <ToggleRow
              id="notify-mem"
              label="Notify on high memory"
              hint="Alert when VRAM usage exceeds 90% of capacity."
              checked={notifyMem}
              onChange={setNotifyMem}
            />
            <Separator />
            <div className="rounded-lg bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
              Notifications are delivered through the system tray and the in-app console.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* About */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Info className="size-4 text-primary" />
            About
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <span className="text-base font-bold">L</span>
              </div>
              <div>
                <div className="text-sm font-semibold">LlamaLauncher</div>
                <div className="text-xs text-muted-foreground">
                  Version 0.4.2 · llama.cpp build b4402
                </div>
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
                <a href="https://github.com/ggerganov/llama.cpp/blob/master/docs/server.md" target="_blank" rel="noreferrer">
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
