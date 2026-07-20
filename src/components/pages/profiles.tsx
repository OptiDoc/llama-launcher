"use client";

import * as React from "react";
import { useLlamaStore, type ViewMode } from "@/lib/llama-store";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ViewToggle } from "@/components/ui/view-toggle";
import { Globe, Boxes, Cpu } from "lucide-react";
import { ProfileCard } from "@/components/features/profiles/profile-card";
import { ProfileTable } from "@/components/features/profiles/profile-table";
import { ProfileDetailView } from "@/components/features/profiles/profile-detail-view";
import { NewProfileDialog } from "@/components/features/profiles/new-profile-dialog-logic";
import { EmptyState } from "@/components/features/profiles/profiles-badges";

const VIEW_STORAGE_KEY = "ll-profiles-view";

export function ProfilesPage() {
  const profiles = useLlamaStore((s) => s.profiles);
  const activeWorkspaceId = useLlamaStore((s) => s.activeWorkspaceId);
  const [mounted, setMounted] = React.useState(false);
  const [view, setView] = React.useState<ViewMode>("grid");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<"global" | "model" | "all">("global");

  // Hydrate view mode from localStorage after mount (SSR-safe).
  React.useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "grid" || saved === "table") setView(saved);
    } catch { /* localStorage unavailable */ }
  }, []);

  // Persist view mode (only after mount to avoid SSR write).
  React.useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem(VIEW_STORAGE_KEY, view); } catch { /* ignore */ }
  }, [mounted, view]);

  // Workspace filter: visible if global (null) or in active workspace.
  const visibleProfiles = React.useMemo(
    () => profiles.filter(
      (p) => p.workspaceId === null || p.workspaceId === activeWorkspaceId,
    ),
    [profiles, activeWorkspaceId],
  );
  const globalProfiles = React.useMemo(
    () => visibleProfiles.filter((p) => p.scope === "global"),
    [visibleProfiles],
  );
  const modelProfiles = React.useMemo(
    () => visibleProfiles.filter((p) => p.scope === "model"),
    [visibleProfiles],
  );
  const sharedCount = React.useMemo(
    () => visibleProfiles.filter((p) => p.shared).length,
    [visibleProfiles],
  );

  const currentList = tab === "global"
    ? globalProfiles
    : tab === "model" ? modelProfiles : visibleProfiles;

  const selectedProfile = selectedId
    ? visibleProfiles.find((p) => p.id === selectedId) ?? null
    : null;

  // Clear selection if it points to a removed profile.
  React.useEffect(() => {
    if (selectedId && !selectedProfile) setSelectedId(null);
  }, [selectedId, selectedProfile]);

  const handleSelect = (id: string) => setSelectedId(id);
  const handleBack = () => setSelectedId(null);

  if (selectedProfile) {
    return <ProfileDetailView profile={selectedProfile} onBack={handleBack} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Profiles</h1>
          <p className="text-[12px] text-muted-foreground">
            Reusable llama-server argument presets · {visibleProfiles.length} total (
            {globalProfiles.length} global, {modelProfiles.length} model-bound, {sharedCount} shared)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NewProfileDialog />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <div className='flex w-full justify-between'>
        <TabsList>
          <TabsTrigger value="global" className="gap-1.5">
            <Globe className="size-3.5" /> Global
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
              {globalProfiles.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="model" className="gap-1.5">
            <Boxes className="size-3.5" /> Model-bound
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
              {modelProfiles.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5">
            <Cpu className="size-3.5" /> All
          </TabsTrigger>
        </TabsList>

        {mounted ? (
            <ViewToggle value={view} onChange={setView} />
        ) : (
            <div className="h-8 w-28 rounded-lg border border-border/60 bg-card" />
        )}
        </div>
        <TabsContent value={tab} className="mt-4">
          {currentList.length === 0 ? (
            <EmptyState />
          ) : view === "table" ? (
            <ProfileTable profiles={currentList} onSelect={handleSelect} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {currentList.map((p) => (
                <ProfileCard key={p.id} profile={p} onSelect={handleSelect} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
