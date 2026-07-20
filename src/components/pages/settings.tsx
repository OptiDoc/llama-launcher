"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, Boxes } from "lucide-react";
import { GlobalSettingsTab } from "@/components/features/settings/settings-global-tab";
import { WorkspaceSettingsTab } from "@/components/features/settings/settings-workspace-tab";

export function SettingsPage() {
  const [tab, setTab] = React.useState<"global" | "workspace">("global");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-[12px] text-muted-foreground">
          Global paths, updates and notifications — plus per-workspace defaults and hibernation.
        </p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as "global" | "workspace")}>
        <TabsList>
          <TabsTrigger value="global"><SettingsIcon className="size-3.5" />Global</TabsTrigger>
          <TabsTrigger value="workspace"><Boxes className="size-3.5" />Workspace</TabsTrigger>
        </TabsList>
        <TabsContent value="global" className="mt-6 outline-none"><GlobalSettingsTab /></TabsContent>
        <TabsContent value="workspace" className="mt-6 outline-none"><WorkspaceSettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
