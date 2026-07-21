"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, ChevronDown, ChevronRight, GitCommit, Rocket } from "lucide-react";
import { type LlamaRelease, type ReleaseVariant } from "@/lib/llama-store";
import { InstalledBadge, VariantBadge, shortCommit } from "./release-badge";
import { StatusCell, ActionControl } from "./release-status";

// ---------- Types ----------

export interface TagGroup {
  tag: string;
  publishedAt: string;
  commit: string;
  notes: string;
  releases: LlamaRelease[];
}

// ---------- Table view ----------

const VariantTableRow = React.memo(function VariantTableRow({ release }: { release: LlamaRelease }) {
  return (
    <TableRow className="hover:bg-muted/40">
      <TableCell className="w-10 pl-4 text-muted-foreground/40">
        <span className="font-mono text-xs">↳</span>
      </TableCell>
      <TableCell>
        <VariantBadge variant={release.variant as ReleaseVariant} withCudaNote />
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{release.publishedAt}</TableCell>
      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{release.sizeMb} MB</TableCell>
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
            <span className="min-w-0 flex-1 truncate text-xs text-foreground/70">{group.notes}</span>
            {hasSecondary && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 px-2 text-xs text-muted-foreground"
                onClick={onToggleExpand}
              >
                {expanded ? <ChevronDown className="mr-1 size-3.5" /> : <ChevronRight className="mr-1 size-3.5" />}
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

export function TableView({
  groups,
  expandedTags,
  onToggleExpand,
}: {
  groups: TagGroup[];
  expandedTags: Set<string>;
  onToggleExpand: (tag: string) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Tag</TableHead>
            <TableHead>Variant</TableHead>
            <TableHead className="w-27.5">Published</TableHead>
            <TableHead className="w-20">Size</TableHead>
            <TableHead className="w-40">Status</TableHead>
            <TableHead className="w-52.5 pr-4 text-right">Actions</TableHead>
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
    </Card>
  );
}

// ---------- Empty state ----------

export function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <Card className="border-2 border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Rocket className="size-6" />
        </div>
        <div>
          <p className="text-sm font-medium">{hasQuery ? "No releases match your search" : "No releases available"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasQuery ? "Try a different tag, commit, or variant." : "Releases will appear here once published."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
