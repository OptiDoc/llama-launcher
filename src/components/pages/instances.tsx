"use client";
import * as React from "react";
import { useLlamaStore, type ViewMode } from "@/lib/llama-store";
import { ViewToggle } from "@/components/ui/view-toggle";
import {
  InstanceDetailView,
  InstanceGrid,
  InstanceTable,
  LaunchDialog,
  EmptyState,
} from "@/components/features/instances";

// ---------- constants ----------

const VIEW_STORAGE_KEY = "ll-instances-view";

// ---------- main page ----------

export function InstancesPage() {
  const instances = useLlamaStore((s) => s.instances);
  const activeWorkspaceId = useLlamaStore((s) => s.activeWorkspaceId);

  const [mounted, setMounted] = React.useState(false);
  const [view, setView] = React.useState<ViewMode>("grid");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [launchOpen, setLaunchOpen] = React.useState(false);

  // Hydrate view mode from localStorage after mount (SSR-safe).
  React.useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "grid" || saved === "table") setView(saved);
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  // Persist view mode (only after mount to avoid SSR write).
  React.useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      /* ignore */
    }
  }, [mounted, view]);

  const filtered = React.useMemo(
    () => instances.filter((i) => i.workspaceId === activeWorkspaceId),
    [instances, activeWorkspaceId],
  );

  const selectedInstance = selectedId
    ? filtered.find((i) => i.id === selectedId) ?? null
    : null;

  // If selection points to a removed/non-existent instance, fall back to list.
  React.useEffect(() => {
    if (selectedId && !selectedInstance) setSelectedId(null);
  }, [selectedId, selectedInstance]);

  const handleSelect = (id: string) => setSelectedId(id);
  const handleBack = () => setSelectedId(null);

  // ---------- detail view ----------
  if (selectedInstance) {
    return (
      <InstanceDetailView instance={selectedInstance} onBack={handleBack} />
    );
  }

  // ---------- list view ----------
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Instances</h1>
          <p className="text-[12px] text-muted-foreground">
            Launch, monitor and manage your llama.cpp server processes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Render placeholder toggle during SSR to avoid hydration mismatch. */}
          {mounted ? (
            <ViewToggle value={view} onChange={setView} />
          ) : (
            <div className="h-8 w-[112px] rounded-lg border bg-card" />
          )}
          <LaunchDialog />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState onLaunch={() => setLaunchOpen(true)} />
      ) : view === "table" ? (
        <InstanceTable instances={filtered} onSelect={handleSelect} />
      ) : (
        <InstanceGrid instances={filtered} onSelect={handleSelect} />
      )}
    </div>
  );
}
