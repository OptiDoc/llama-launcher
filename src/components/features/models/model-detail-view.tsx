/**
 * Model detail view component.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { fmtBytes, fmtNum } from "@/lib/llama-store";
import type { LlamaModel } from "@/lib/llama-store";
import { AlertTriangle, ExternalLink, FileText, FolderOpen, Pencil, Play, Sparkles, Tag, Trash2 } from "lucide-react";
import { deriveModelStats } from "./model-detail-derive-stats";
import { ModelDetailHeader } from "./model-detail-header";
import { StatTile } from "./model-detail-stats";

function MetaItem({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-xs text-foreground", mono && "font-mono")}>{value}</span>
    </div>
  );
}

export function ModelDetailView({
  model, onBack, onEdit, onLoad,
}: {
  model: LlamaModel; onBack: () => void; onEdit: (m: LlamaModel) => void; onLoad: (m: LlamaModel) => void;
}) {
  const stats = React.useMemo(() => deriveModelStats(model), [model]);

  return (
    <div className="space-y-5">
      <ModelDetailHeader model={model} onBack={onBack} />

      {model.missing && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Model file not found at <span className="font-mono text-xs">{model.path}</span></AlertTitle>
          <AlertDescription className="text-xs">
            The file may have been moved or deleted. Update the path to continue using this model.
            <Button variant="outline" size="sm" className="ml-3"
              onClick={() => onEdit(model)}>
              <Pencil className="mr-1.5 size-3" /> Update path
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <Card className="shadow-none">
            <CardContent className="p-5">
              <h3 className="mb-3 text-sm font-semibold">Statistics</h3>
              <div className="grid grid-cols-3 gap-3">
                <StatTile label="Context" value={`${stats.context} tokens`} sub="Max sequence length" />
                <StatTile label="Embedding" value={`${stats.embedding} dim`} sub="Vector dimensions" />
                <StatTile label="Parameters" value={fmtNum(stats.params)} sub="Total parameters" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardContent className="p-5">
              <h3 className="mb-3 text-sm font-semibold">Details</h3>
              <div className="grid gap-1.5">
                <MetaItem label="Type" value={stats.type} mono />
                <MetaItem label="Format" value={stats.format} mono />
                <MetaItem label="Architecture" value={stats.architecture} mono />
                <MetaItem label="Tokenizer" value={stats.tokenizer} mono />
                <MetaItem label="Created" value={stats.created} mono />
                <MetaItem label="Modified" value={stats.modified} mono />
                <MetaItem label="File size" value={fmtBytes(stats.fileSize)} mono />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardContent className="p-5">
              <h3 className="mb-3 text-sm font-semibold">Actions</h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onLoad(model)}>
                  <Play className="mr-1.5 size-3.5" /> Load model
                </Button>
                <Button size="sm" variant="outline" onClick={() => onEdit(model)}>
                  <Pencil className="mr-1.5 size-3.5" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => { /* open folder */ }}>
                  <FolderOpen className="mr-1.5 size-3.5" /> Open folder
                </Button>
                <Button size="sm" variant="outline" onClick={() => { /* copy path */ }}>
                  <FileText className="mr-1.5 size-3.5" /> Copy path
                </Button>
                <Button size="sm" variant="outline" onClick={() => { /* delete */ }}>
                  <Trash2 className="mr-1.5 size-3.5" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="shadow-none">
            <CardContent className="p-5">
              <h3 className="mb-3 text-sm font-semibold">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {model.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] font-semibold">
                    <Tag className="mr-1 size-2.5" /> {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardContent className="p-5">
              <h3 className="mb-3 text-sm font-semibold">Links</h3>
              <div className="grid gap-2">
                {model.hfUrl && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={model.hfUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1.5 size-3.5" /> HuggingFace
                    </a>
                  </Button>
                )}
                {model.repoUrl && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={model.repoUrl} target="_blank" rel="noopener noreferrer">
                      <Sparkles className="mr-1.5 size-3.5" /> Repository
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
