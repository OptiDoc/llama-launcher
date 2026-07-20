"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { ViewToggle } from "@/components/ui/view-toggle";
import { useLlamaStore, type ViewMode } from "@/lib/llama-store";
import { VARIANT_LABEL, variantOrder } from "@/components/features/releases/release-badge";
import type { ReleaseVariant } from "@/lib/llama-store";
import { TableView, EmptyState, type TagGroup } from "@/components/features/releases/release-table";
import { GridView } from "@/components/features/releases/release-card";

// ---------- Main page ----------

export function ReleasesPage() {
  const releases = useLlamaStore((s) => s.releases);
  const activeWorkspaceId = useLlamaStore((s) => s.activeWorkspaceId);

  const [mounted, setMounted] = React.useState(false);
  const [view, setView] = React.useState<ViewMode>("table");
  const [query, setQuery] = React.useState("");
  const [expandedTags, setExpandedTags] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("ll-releases-view");
      if (saved === "grid" || saved === "table") setView(saved);
    } catch {
      // ignore
    }
  }, []);

  const handleViewChange = React.useCallback((v: ViewMode) => {
    setView(v);
    try {
      localStorage.setItem("ll-releases-view", v);
    } catch {
      // ignore
    }
  }, []);

  const handleToggleExpand = React.useCallback((tag: string) => {
    setExpandedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const ws = releases.filter((r) => r.workspaceId === null || r.workspaceId === activeWorkspaceId);
    if (!q) return ws;
    return ws.filter(
      (r) =>
        r.tag.toLowerCase().includes(q) ||
        r.commit.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q) ||
        r.variant.toLowerCase().includes(q) ||
        VARIANT_LABEL[r.variant as ReleaseVariant].toLowerCase().includes(q),
    );
  }, [releases, activeWorkspaceId, query]);

  const sortedFiltered = React.useMemo(() => {
    return [...filtered].sort((a, b) => {
      const d = (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
      if (d !== 0) return d;
      return variantOrder(a.variant as ReleaseVariant) - variantOrder(b.variant as ReleaseVariant);
    });
  }, [filtered]);

  const groups = React.useMemo<TagGroup[]>(() => {
    const map = new Map<string, TagGroup>();
    for (const r of sortedFiltered) {
      let g = map.get(r.tag);
      if (!g) {
        g = {
          tag: r.tag,
          publishedAt: r.publishedAt ?? "",
          commit: r.commit,
          notes: r.notes,
          releases: [],
        };
        map.set(r.tag, g);
      } else {
        g.releases.push(r);
      }
    }
    return Array.from(map.values());
  }, [sortedFiltered]);

  const installedTag = React.useMemo(() => {
    const r = releases.find((x) => (x.workspaceId === null || x.workspaceId === activeWorkspaceId) && x.installed);
    return r?.tag;
  }, [releases, activeWorkspaceId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Releases</h1>
          <p className="text-[12px] text-muted-foreground">
            llama.cpp builds. Active build:{" "}
            <span className="font-mono font-semibold text-foreground">{installedTag ?? "none"}</span>.
          </p>
        </div>
      </div>

      <div className="flex w-full justify-between">
        <div className="relative w-md bg-card rounded-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search releases by tag, commit, variant…"
            className="h-9 pl-9"
            aria-label="Search releases"
          />
        </div>
        {mounted ? <ViewToggle value={view} onChange={handleViewChange} /> : <div className="h-8 w-37" />}
      </div>
      {filtered.length === 0 ? (
        <EmptyState hasQuery={query.trim().length > 0} />
      ) : view === "grid" ? (
        <GridView releases={sortedFiltered} />
      ) : (
        <TableView groups={groups} expandedTags={expandedTags} onToggleExpand={handleToggleExpand} />
      )}
    </div>
  );
}
