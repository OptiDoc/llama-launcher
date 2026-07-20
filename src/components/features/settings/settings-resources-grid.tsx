"use client";

import { Server, Layers, Package } from "lucide-react";
import { ResourceStat } from "@/components/features/settings/settings-section";

export function WorkspaceResourcesGrid({
  instanceCount,
  profileCount,
  modelCount,
  releaseCount,
}: {
  instanceCount: number;
  profileCount: number;
  modelCount: number;
  releaseCount: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <ResourceStat icon={<Server className="size-3.5" />} label="Instances" value={instanceCount} />
      <ResourceStat
        icon={<Layers className="size-3.5" />}
        label="Profiles"
        value={profileCount}
        hint="includes global"
      />
      <ResourceStat icon={<Package className="size-3.5" />} label="Models" value={modelCount} />
      <ResourceStat
        icon={<Package className="size-3.5" />}
        label="Installed releases"
        value={releaseCount}
        hint="includes global"
      />
    </div>
  );
}
