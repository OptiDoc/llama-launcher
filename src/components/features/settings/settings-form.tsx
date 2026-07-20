"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useLlamaStore, type Workspace, type WorkspaceSettings } from "@/lib/llama-store";
import { ColorSwatchPicker } from "@/components/features/settings/settings-section";

const DEFAULT_WS_SETTINGS: WorkspaceSettings = {
  hibernate_after_sec: 0, default_gpu_layers: 99, default_threads: 8,
  auto_calibrate: true, max_concurrent_instances: 4,
};

function fmtHibernation(sec: number) {
  if (sec <= 0) return "Disabled";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60); const s = sec % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

export function NewWorkspaceDialog({ open, onOpenChange }: {
  open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const addWorkspace = useLlamaStore((s) => s.addWorkspace);
  const setActiveWorkspace = useLlamaStore((s) => s.setActiveWorkspace);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [color, setColor] = React.useState<Workspace["color"]>("green");

  React.useEffect(() => {
    if (open) { setName(""); setDescription(""); setColor("green"); }
  }, [open]);

  const submit = () => {
    if (!name.trim()) return;
    const id = addWorkspace({ name: name.trim(), description, color });
    setActiveWorkspace(id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a new workspace</DialogTitle>
          <DialogDescription>
            Workspaces isolate instances, models, profiles and releases.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-ws-name">Name</Label>
            <Input id="new-ws-name" autoFocus placeholder="e.g. Research Lab" value={name}
              className="h-8"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-ws-desc">Description</Label>
            <Textarea id="new-ws-desc" rows={2} placeholder="Optional — what is this workspace for?"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <ColorSwatchPicker value={color} onChange={setColor} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={!name.trim()}>
            <Plus className="mr-1.5 size-3.5" />Create workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { DEFAULT_WS_SETTINGS, fmtHibernation };
