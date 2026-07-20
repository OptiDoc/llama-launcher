/**
 * HF download dialog component.
 */

"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Boxes } from "lucide-react";
import { useHFDownloadDialog } from "./hf-download-state";
import { HFDialogFooter } from "./hf-download-dialog-footer";
import { HFSearchResults } from "./hf-download-search";
import { HFDownloadQuant } from "./hf-download-quant";
import { HFDownloadInfo } from "./hf-download-info";
import { searchHFModels } from "@/lib/catalog";
import { deriveModelName } from "./hf-derive-model-name";

export interface HFDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefillRepo?: string;
  prefillModelName?: string;
}

export function HFDownloadDialog({ open, onOpenChange, prefillRepo, prefillModelName }: HFDialogProps) {
  const dialog = useHFDownloadDialog();

  React.useEffect(() => {
    if (open && prefillRepo) {
      searchHFModels(prefillRepo.split("/")[1] ?? prefillRepo).then((results) => {
        const r = results.find((x) => x.repo === prefillRepo);
        dialog.setSelectedRepo(r ?? null);
        dialog.setModelName(prefillModelName ?? deriveModelName(prefillRepo));
      });
    }
  }, [open, prefillRepo, prefillModelName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Download className="size-4 text-primary" /> Download from HuggingFace
          </DialogTitle>
          <DialogDescription className="text-xs">
            Search the HuggingFace Hub for GGUF checkpoints, then pick a quantization.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-2">
          <HFSearchResults
            results={dialog.results}
            visibleResults={dialog.visibleResults}
            visibleCount={dialog.visibleCount}
            selectedRepo={dialog.selectedRepo}
            searching={dialog.searching}
            query={dialog.query}
            onSearch={dialog.setQuery}
            onSelect={dialog.handleSelectResult}
            scrollRef={dialog.scrollRef}
            sentinelRef={dialog.sentinelRef}
          />

          <div className="flex min-h-0 flex-col">
            {!dialog.selectedRepo ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                <Boxes className="size-6 text-muted-foreground/50" />
                <p className="text-[11px] text-muted-foreground">Select a model to choose quantization</p>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
                <HFDownloadInfo selectedRepo={dialog.selectedRepo} />

                <HFDownloadQuant
                  selectedRepo={dialog.selectedRepo}
                  quant={dialog.quant}
                  setQuant={dialog.setQuant}
                  availableQuants={dialog.availableQuants}
                  loadingQuants={dialog.loadingQuants}
                />

                <Label
                  htmlFor="hf-name"
                  className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Model name
                </Label>
                <Input
                  id="hf-name"
                  value={dialog.modelName}
                  onChange={(e) => dialog.setModelName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>
        </div>

        <HFDialogFooter
          selectedRepo={dialog.selectedRepo}
          estimatedGb={dialog.estimatedGb}
          builder={dialog.builder}
          filename={dialog.filename}
          canStart={dialog.canStart}
          onOpenChange={onOpenChange}
          handleSubmit={dialog.handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
