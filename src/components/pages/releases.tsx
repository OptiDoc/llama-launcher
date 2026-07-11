"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ViewToggle } from "@/components/ui/view-toggle";
import {
  Rocket,
  CheckCircle2,
  Download,
  GitCommit,
  Calendar,
  Search,
  ChevronDown,
  ChevronRight,
  Info,
  MoreHorizontal,
  Trash2,
  Package,
} from "lucide-react";
import {
  useLlamaStore,
  RELEASE_VARIANTS,
  type LlamaRelease,
  type ReleaseVariant,
  type ViewMode,
} from "@/lib/llama-store";

// ---------- Variant metadata ----------

const VARIANT_STYLE: Record<ReleaseVariant, { badge: string; dot: string }> = {
  cuda12: { badge: "bg-primary/15 text-primary dark:text-primary/80", dot: "bg-primary" },
  cuda13: { badge: "bg-purple-500/15 text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
  vulkan: { badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  cpu: { badge: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300", dot: "bg-zinc-500" },
  hip: { badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  opencl: { badge: "bg-teal-500/15 text-teal-700 dark:text-teal-300", dot: "bg-teal-500" },
  metal: { badge: "bg-slate-500/15 text-slate-700 dark:text-slate-300", dot: "bg-slate-500" },
};

const VARIANT_LABEL = Object.fromEntries(
  RELEASE_VARIANTS.map((v) => [v.id, v.label] as const),
) as Record<ReleaseVariant, string>;

const VARIANT_NOTE = Object.fromEntries(
  RELEASE_VARIANTS.map((v) => [v.id, v.note] as const),
) as Record<ReleaseVariant, string>;

const CUDA_NOTE = "CUDA libraries will be auto-copied to the build directory after download.";

function isCuda(v: ReleaseVariant): boolean {
  return v === "cuda12" || v === "cuda13";
}

function variantOrder(v: ReleaseVariant): number {
  const i = RELEASE_VARIANTS.findIndex((r) => r.id === v);
  return i === -1 ? 99 : i;
}

function shortCommit(c: string): string {
  return c.length > 7 ? c.slice(0, 7) : c;
}

// ---------- Types ----------

interface TagGroup {
  tag: string;
  publishedAt: string;
  commit: string;
  notes: string;
  releases: LlamaRelease[];
}

// ---------- Shared badges ----------

function InstalledBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 bg-emerald-500/15 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300",
        className,
      )}
    >
      <CheckCircle2 className="size-3" />
      Installed
    </Badge>
  );
}

function VariantBadge({
  variant,
  withCudaNote = false,
}: {
  variant: ReleaseVariant;
  withCudaNote?: boolean;
}) {
  const s = VARIANT_STYLE[variant];
  const inner = (
    <Badge
      variant="secondary"
      className={cn("gap-1 text-[10px] font-semibold uppercase", s.badge)}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {VARIANT_LABEL[variant]}
      {withCudaNote && isCuda(variant) && <Info className="size-3 opacity-70" />}
    </Badge>
  );
  if (withCudaNote && isCuda(variant)) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help">{inner}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[240px] text-xs font-normal">
          {CUDA_NOTE}
        </TooltipContent>
      </Tooltip>
    );
  }
  return inner;
}

// ---------- Animated install progress ----------

function InstallFillBar({
  progress,
  className,
}: {
  progress: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div
      className={cn(
        "relative h-6 w-full overflow-hidden rounded bg-emerald-500/10",
        className,
      )}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Downloading release"
    >
      <div
        className="absolute inset-y-0 left-0 bg-emerald-500/80"
        style={{ width: `${pct}%`, transition: "width 180ms linear" }}
      />
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-emerald-900 dark:text-emerald-50">
        {pct}%
      </div>
    </div>
  );
}

// ---------- Status cell (table + grid) ----------

function StatusCell({ release }: { release: LlamaRelease }) {
  if (release.installing) {
    const pct = Math.max(0, Math.min(100, Math.round(release.installProgress ?? 0)));
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
          Installing… {pct}%
        </span>
        <div className="relative h-1.5 w-28 overflow-hidden rounded-full bg-emerald-500/15">
          <div
            className="absolute inset-y-0 left-0 bg-emerald-500"
            style={{ width: `${pct}%`, transition: "width 180ms linear" }}
          />
        </div>
      </div>
    );
  }
  if (release.installed) return <InstalledBadge />;
  return (
    <Badge variant="secondary" className="bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
      Available
    </Badge>
  );
}

// ---------- Action control (button / progress / installed+uninstall) ----------

function ActionControl({
  release,
  compact = false,
}: {
  release: LlamaRelease;
  compact?: boolean;
}) {
  const startReleaseDownload = useLlamaStore((s) => s.startReleaseDownload);
  const uninstallRelease = useLlamaStore((s) => s.uninstallRelease);

  // Fixed-height wrapper so the row/chip never jumps between states.
  if (release.installing) {
    return (
      <div className="flex h-6 w-28 items-center">
        <InstallFillBar progress={release.installProgress ?? 0} className="h-6 w-full" />
      </div>
    );
  }

  if (release.installed) {
    return (
      <div className="flex h-6 items-center gap-1">
        <InstalledBadge />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground"
              aria-label="Release actions"
            >
              <MoreHorizontal className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              variant="destructive"
              onClick={() => uninstallRelease(release.id)}
            >
              <Trash2 className="size-3.5" />
              Uninstall
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Compact install trigger — small icon button with tooltip, keeps the
  // row height tight and doesn't break the design with a wide button.
  return (
    <div className="flex h-6 items-center">
      <Button
        variant="ghost"
        size="icon"
        className="size-6 text-muted-foreground hover:bg-primary/10 hover:text-primary"
        onClick={() => startReleaseDownload(release.id)}
        aria-label={`Download and install ${release.tag} (${release.variant})`}
        title="Download & install"
      >
        <Download className="size-3.5" />
      </Button>
    </div>
  );
}

// ---------- Table view ----------

const VariantTableRow = React.memo(function VariantTableRow({
  release,
}: {
  release: LlamaRelease;
}) {
  return (
    <TableRow className="hover:bg-muted/40">
      <TableCell className="w-[40px] pl-4 text-muted-foreground/40">
        <span className="font-mono text-xs">↳</span>
      </TableCell>
      <TableCell>
        <VariantBadge variant={release.variant} withCudaNote />
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {release.publishedAt}
      </TableCell>
      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
        {release.sizeMb} MB
      </TableCell>
      <TableCell>
        <StatusCell release={release} />
      </TableCell>
      <TableCell className="pr-4 text-right">
        <div className="flex justify-end">
          <ActionControl release={release} compact />
        </div>
      </TableCell>
    </TableRow>
  );
});

function TagGroupBlock({
  group,
  expanded,
  onToggleExpand,
}: {
  group: TagGroup;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const priority = group.releases.filter((r) => r.priority);
  const secondary = group.releases.filter((r) => !r.priority);
  const visible = expanded ? group.releases : priority;
  const hasSecondary = secondary.length > 0;
  const anyInstalled = group.releases.some((r) => r.installed);

  return (
    <>
      <TableRow className="border-t-2 border-border/50 bg-muted/30 hover:bg-muted/30">
        <TableCell colSpan={6} className="py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold">{group.tag}</span>
              {anyInstalled && <InstalledBadge />}
            </div>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="size-3" />
              {group.publishedAt}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <GitCommit className="size-3" />
              <span className="font-mono">{shortCommit(group.commit)}</span>
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-foreground/70">
              {group.notes}
            </span>
            {hasSecondary && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
                onClick={onToggleExpand}
              >
                {expanded ? (
                  <ChevronDown className="mr-1 size-3.5" />
                ) : (
                  <ChevronRight className="mr-1 size-3.5" />
                )}
                {expanded ? "Hide variants" : `Show all variants (${secondary.length})`}
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {visible.map((r) => (
        <VariantTableRow key={r.id} release={r} />
      ))}
    </>
  );
}

function TableView({
  groups,
  expandedTags,
  onToggleExpand,
}: {
  groups: TagGroup[];
  expandedTags: Set<string>;
  onToggleExpand: (tag: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-soft">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Tag</TableHead>
            <TableHead>Variant</TableHead>
            <TableHead className="w-[110px]">Published</TableHead>
            <TableHead className="w-[80px]">Size</TableHead>
            <TableHead className="w-[160px]">Status</TableHead>
            <TableHead className="w-[210px] pr-4 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((g) => (
            <TagGroupBlock
              key={g.tag}
              group={g}
              expanded={expandedTags.has(g.tag)}
              onToggleExpand={() => onToggleExpand(g.tag)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------- Grid view ----------

const ReleaseCard = React.memo(function ReleaseCard({
  release,
}: {
  release: LlamaRelease;
}) {
  return (
    <Card className="overflow-hidden border bg-card shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lifted">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold">{release.tag}</span>
              {release.priority && (
                <Badge
                  variant="secondary"
                  className="bg-primary/10 text-[9px] font-semibold uppercase text-primary"
                >
                  Priority
                </Badge>
              )}
            </div>
            <VariantBadge variant={release.variant} withCudaNote />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground"
                aria-label="Release notes"
              >
                <Info className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 text-xs" align="end">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <Package className="size-3.5" />
                  {release.tag} · {VARIANT_LABEL[release.variant]}
                </div>
                <p className="text-muted-foreground">{release.notes}</p>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <GitCommit className="size-3" />
                  <span className="font-mono">{release.commit}</span>
                </div>
                <div className="text-muted-foreground">{VARIANT_NOTE[release.variant]}</div>
                {isCuda(release.variant) && (
                  <div className="rounded-md bg-primary/5 p-2 text-[11px] text-primary/80">
                    {CUDA_NOTE}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="size-3" />
            {release.publishedAt}
          </span>
          <span className="font-mono">{release.sizeMb} MB</span>
        </div>
        <div className="flex h-8 items-center justify-between gap-2 border-t pt-3">
          <StatusCell release={release} />
          <ActionControl release={release} compact />
        </div>
      </CardContent>
    </Card>
  );
});

function GridView({ releases }: { releases: LlamaRelease[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {releases.map((r) => (
        <ReleaseCard key={r.id} release={r} />
      ))}
    </div>
  );
}

// ---------- Empty state ----------

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <Card className="border-dashed shadow-soft">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Rocket className="size-6" />
        </div>
        <div>
          <p className="text-sm font-medium">
            {hasQuery ? "No releases match your search" : "No releases available"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasQuery
              ? "Try a different tag, commit, or variant."
              : "Releases will appear here once published."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Main page ----------

export function ReleasesPage() {
  const releases = useLlamaStore((s) => s.releases);
  const activeWorkspaceId = useLlamaStore((s) => s.activeWorkspaceId);

  const [mounted, setMounted] = React.useState(false);
  const [view, setView] = React.useState<ViewMode>("table");
  const [query, setQuery] = React.useState("");
  const [expandedTags, setExpandedTags] = React.useState<Set<string>>(new Set());

  // SSR-safe mount + hydrate persisted view from localStorage.
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

  // Workspace + search filter (real-time).
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const ws = releases.filter(
      (r) => r.workspaceId === null || r.workspaceId === activeWorkspaceId,
    );
    if (!q) return ws;
    return ws.filter(
      (r) =>
        r.tag.toLowerCase().includes(q) ||
        r.commit.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q) ||
        r.variant.toLowerCase().includes(q) ||
        VARIANT_LABEL[r.variant].toLowerCase().includes(q),
    );
  }, [releases, activeWorkspaceId, query]);

  // Sort by publishedAt desc, then variant order (priority first).
  const sortedFiltered = React.useMemo(() => {
    return [...filtered].sort((a, b) => {
      const d = b.publishedAt.localeCompare(a.publishedAt);
      if (d !== 0) return d;
      return variantOrder(a.variant) - variantOrder(b.variant);
    });
  }, [filtered]);

  // Group by tag for the table view.
  const groups = React.useMemo<TagGroup[]>(() => {
    const map = new Map<string, TagGroup>();
    for (const r of sortedFiltered) {
      let g = map.get(r.tag);
      if (!g) {
        g = {
          tag: r.tag,
          publishedAt: r.publishedAt,
          commit: r.commit,
          notes: r.notes,
          releases: [],
        };
        map.set(r.tag, g);
      }
      g.releases.push(r);
    }
    return Array.from(map.values());
  }, [sortedFiltered]);

  // Active build label (workspace-scoped).
  const installedTag = React.useMemo(() => {
    const r = releases.find(
      (x) =>
        (x.workspaceId === null || x.workspaceId === activeWorkspaceId) && x.installed,
    );
    return r?.tag;
  }, [releases, activeWorkspaceId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Releases</h1>
          <p className="text-sm text-muted-foreground">
            llama.cpp builds. Active build:{" "}
            <span className="font-mono font-semibold text-foreground">
              {installedTag ?? "none"}
            </span>
            .
          </p>
        </div>
        {mounted ? (
          <ViewToggle value={view} onChange={handleViewChange} />
        ) : (
          <div className="h-8 w-[148px]" />
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search releases by tag, commit, variant…"
          className="pl-9"
          aria-label="Search releases"
        />
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState hasQuery={query.trim().length > 0} />
      ) : view === "grid" ? (
        <GridView releases={sortedFiltered} />
      ) : (
        <TableView
          groups={groups}
          expandedTags={expandedTags}
          onToggleExpand={handleToggleExpand}
        />
      )}
    </div>
  );
}
