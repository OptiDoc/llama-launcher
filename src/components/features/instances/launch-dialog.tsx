/**
 * Launch dialog component.
 */

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Play } from "lucide-react";
import { useLaunchDialogLogic } from "./launch-dialog-logic";
import { LaunchWarnings } from "./launch-warnings";
import { ModelSelect } from "./model-select";
import { ConnectionFields } from "./connection-fields";

export function LaunchDialog() {
  const dialog = useLaunchDialogLogic();

  return (
    <Dialog open={dialog.open} onOpenChange={dialog.setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Play className="mr-1.5 size-3.5" /> Launch
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="size-4 text-primary" /> Launch Instance
          </DialogTitle>
          <DialogDescription>Configure and launch a new llama.cpp instance.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <LaunchWarnings
            selectedModel={dialog.selectedModel}
            selectedModelMissing={dialog.selectedModelMissing}
            overVram={dialog.overVram}
            overRam={dialog.overRam}
            systemCapabilities={dialog.systemCapabilities}
          />

          <div className="grid gap-2">
            <Label htmlFor="instance-name">Instance name</Label>
            <Input
              id="instance-name"
              value={dialog.name}
              onChange={(e) => dialog.setName(e.target.value)}
              placeholder="e.g. My Instance"
              className="h-9"
            />
          </div>

          <ModelSelect
            downloaded={dialog.downloaded}
            modelId={dialog.modelId}
            onModelChange={dialog.setModelId}
            profileOptions={dialog.profileOptions}
            profileId={dialog.profileId}
            onProfileChange={dialog.setProfileId}
          />

          <ConnectionFields
            port={dialog.port}
            host={dialog.host}
            gpu={dialog.gpu}
            gpuOptions={dialog.gpuOptions}
            errors={dialog.errors}
            onPortChange={dialog.setPort}
            onHostChange={dialog.setHost}
            onGpuChange={dialog.setGpu}
            onClearError={dialog.clearError}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => dialog.setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={dialog.onLaunch} disabled={!dialog.canLaunch}>
            <Play className="mr-1.5 size-3.5" /> Launch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
