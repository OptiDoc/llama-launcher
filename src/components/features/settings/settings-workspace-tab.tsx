"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useLlamaStore, type WorkspaceSettings } from "@/lib/llama-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Plus, Cpu, Boxes } from "lucide-react";
import { FieldRow, ToggleRow, ColorSwatchPicker, WS_DOT } from "@/components/features/settings/settings-section";
import { NewWorkspaceDialog, DEFAULT_WS_SETTINGS } from "@/components/features/settings/settings-form";
import { DangerZoneCard } from "@/components/features/settings/settings-danger-zone";
import { WorkspaceResourcesGrid } from "@/components/features/settings/settings-resources-grid";
import { HibernationCard } from "@/components/features/settings/settings-hibernation-card";

export function WorkspaceSettingsTab() {
  const workspaces = useLlamaStore((s) => s.workspaces);
  const activeId = useLlamaStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useLlamaStore((s) => s.setActiveWorkspace);
  const wsSettingsMap = useLlamaStore((s) => s.workspaceSettings);
  const updateWorkspace = useLlamaStore((s) => s.updateWorkspace);
  const updateWorkspaceSettings = useLlamaStore((s) => s.updateWorkspaceSettings);
  const removeWorkspace = useLlamaStore((s) => s.removeWorkspace);
  const instances = useLlamaStore((s) => s.instances);
  const profiles = useLlamaStore((s) => s.profiles);
  const models = useLlamaStore((s) => s.models);
  const releases = useLlamaStore((s) => s.releases);

  const [newWsOpen, setNewWsOpen] = React.useState(false);
  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];
  const wsSettings: WorkspaceSettings = wsSettingsMap[active?.id] ?? DEFAULT_WS_SETTINGS;

  if (!active) {
    return (
      <Card>
        <CardContent>
          <div className="py-10 text-center text-sm text-muted-foreground">No workspaces available.</div>
        </CardContent>
      </Card>
    );
  }

  const instanceCount = instances.filter((i) => i.workspaceId === active.id).length;
  const modelCount = models.filter((m) => m.workspaceId === active.id).length;
  const profileCount = profiles.filter((p) => p.workspaceId === active.id || p.workspaceId === null).length;
  const releaseCount = releases.filter(
    (r) => (r.workspaceId === active.id || r.workspaceId === null) && r.installed,
  ).length;
  const isLastWorkspace = workspaces.length <= 1;

  const setWsNum = (key: keyof WorkspaceSettings, raw: string) => {
    const n = Number(raw);
    updateWorkspaceSettings(active.id, { [key]: Number.isFinite(n) ? n : 0 } as Partial<WorkspaceSettings>);
  };

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={active.id} onValueChange={setActiveWorkspace}>
              <SelectTrigger className="w-full sm:w-72 h-8">
                <span className="flex items-center gap-2">
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    <span className="flex items-center gap-2">
                      <span className={cn("size-2 rounded-full", WS_DOT[w.color])} />
                      {w.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {active.description && (
              <span className="line-clamp-1 text-xs text-muted-foreground">{active.description}</span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setNewWsOpen(true)}>
            <Plus className="mr-1.5 size-3.5" />
            New workspace
          </Button>
        </div>
      </Card>

      <NewWorkspaceDialog open={newWsOpen} onOpenChange={setNewWsOpen} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <CardHeader className="p-0 mb-3">
            <CardTitle className="flex items-center gap-2 text-[13px]">
              <span className="text-primary">
                <SettingsIcon className="size-4" />
              </span>
              Workspace identity
            </CardTitle>
            <CardDescription>Editing: {active.name}</CardDescription>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            <FieldRow id="ws-name" label="Name" hint="Display name in the sidebar">
              <Input
                id="ws-name"
                value={active.name}
                className="h-8"
                onChange={(e) => updateWorkspace(active.id, { name: e.target.value })}
              />
            </FieldRow>
            <div className="space-y-1.5">
              <Label htmlFor="ws-desc" className="text-sm font-medium">
                Description
              </Label>
              <Textarea
                id="ws-desc"
                rows={2}
                placeholder="What is this workspace for?"
                value={active.description ?? ""}
                onChange={(e) => updateWorkspace(active.id, { description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Color</Label>
              <ColorSwatchPicker value={active.color} onChange={(c) => updateWorkspace(active.id, { color: c })} />
            </div>
          </CardContent>
        </Card>

        <HibernationCard
          wsSettings={wsSettings}
          onSetNum={setWsNum}
          onChange={(v) => updateWorkspaceSettings(active.id, v)}
        />

        <Card className="p-4">
          <CardHeader className="p-0 mb-3">
            <CardTitle className="flex items-center gap-2 text-[13px]">
              <span className="text-primary">
                <Cpu className="size-4" />
              </span>
              Defaults
            </CardTitle>
            <CardDescription>Applied when creating new instances in this workspace.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow id="ws-gpu-layers" label="GPU layers" hint="Default -ngl">
                <Input
                  id="ws-gpu-layers"
                  type="number"
                  min={0}
                  value={wsSettings.default_gpu_layers}
                  onChange={(e) => setWsNum("default_gpu_layers", e.target.value)}
                  className="font-mono text-sm h-8"
                />
              </FieldRow>
              <FieldRow id="ws-threads" label="Threads" hint="Default -t">
                <Input
                  id="ws-threads"
                  type="number"
                  min={1}
                  value={wsSettings.default_threads}
                  onChange={(e) => setWsNum("default_threads", e.target.value)}
                  className="font-mono text-sm h-8"
                />
              </FieldRow>
            </div>
            <FieldRow id="ws-max-instances" label="Max concurrent instances" hint="Upper bound for running instances">
              <Input
                id="ws-max-instances"
                type="number"
                min={1}
                value={wsSettings.max_concurrent_instances}
                onChange={(e) => setWsNum("max_concurrent_instances", e.target.value)}
                className="font-mono text-sm h-8"
              />
            </FieldRow>
            <ToggleRow
              id="ws-auto-calibrate"
              label="Auto-calibrate profiles"
              hint="Run a short benchmark to score new profiles."
              checked={wsSettings.auto_calibrate}
              onChange={(v) => updateWorkspaceSettings(active.id, { auto_calibrate: v })}
            />
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardHeader className="p-0 mb-3">
            <CardTitle className="flex items-center gap-2 text-[13px]">
              <span className="text-primary">
                <Boxes className="size-4" />
              </span>
              Workspace resources
            </CardTitle>
            <CardDescription>Read-only counts derived from the store for the active workspace.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <WorkspaceResourcesGrid
              instanceCount={instanceCount}
              profileCount={profileCount}
              modelCount={modelCount}
              releaseCount={releaseCount}
            />
          </CardContent>
        </Card>
      </div>

      <DangerZoneCard
        workspaceName={active.name}
        isLastWorkspace={isLastWorkspace}
        instanceCount={instanceCount}
        modelCount={modelCount}
        onDelete={() => removeWorkspace(active.id)}
      />
    </div>
  );
}
