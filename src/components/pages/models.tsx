"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ViewToggle } from "@/components/ui/view-toggle";
import { Boxes, Download, FolderOpen, Loader2 } from "lucide-react";
import { useModelsPage } from "@/components/features/models/use-models-page";
import { ModelCard } from "@/components/features/models/model-card";
import { ModelTable } from "@/components/features/models/model-table";
import { EditModelDialog } from "@/components/features/models/edit-model-dialog";
import { LaunchConfirmDialog } from "@/components/features/models/launch-confirm-dialog";
import { HFDownloadDialog } from "@/components/features/models/hf-download-dialog";
import { ModelDetailView } from "@/components/features/models/model-detail-view";
import { ExternalModelCard } from "@/components/features/models/external-model-card";
import { LocalModelImportDialog } from "@/components/features/models/local-model-import-dialog";
import { DropZone } from "@/components/features/models/drop-zone";

export function ModelsPage() {
  const {
    workspaceModels, ready, view, mounted, selectedModel, externalModels,
    systemCapabilities, scanningExternal, editModel, editOpen, editFocusPath,
    launchModel, launchOpen, hfOpen, hfPrefillRepo, hfPrefillName,
    importDialogOpen, selectedImportFiles, importMoveMode, importStatus,
    setEditOpen, setLaunchOpen, setHfOpen, setImportDialogOpen,
    setImportMoveMode, handleViewChange, handleScanExternalModels,
    handleOpenImportDialog, handleImportSelected, handleFilesDrop,
    openEdit, handleLoad, openHF, actions, setSelectedId,
  } = useModelsPage();

  if (selectedModel) {
    return (
      <div className="space-y-6">
        <ModelDetailView
          model={selectedModel}
          onBack={() => setSelectedId(null)}
          onEdit={(m) => openEdit(m, m.missing)}
          onLoad={handleLoad}
        />
        <EditModelDialog model={editModel} open={editOpen} onOpenChange={setEditOpen} focusPath={editFocusPath} />
        <LaunchConfirmDialog model={launchModel} open={launchOpen} onOpenChange={setLaunchOpen} />
        <HFDownloadDialog open={hfOpen} onOpenChange={setHfOpen} prefillRepo={hfPrefillRepo} prefillModelName={hfPrefillName} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Models</h1>
          <p className="text-[12px] text-muted-foreground">
            Browse, download and manage GGUF model files. {ready} of {workspaceModels.length} ready.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mounted ? (
            <ViewToggle value={view} onChange={handleViewChange} />
          ) : (
            <div className="h-9 w-32" />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" onClick={handleOpenImportDialog}>
                <FolderOpen className="mr-1.5 size-3.5" /> Import Local
              </Button>
            </TooltipTrigger>
            <TooltipContent>Import a GGUF file from disk</TooltipContent>
          </Tooltip>
          <Button size="sm" onClick={openHF}>
            <Download className="mr-1.5 size-3.5" /> Download from HF
          </Button>
        </div>
      </div>

      {workspaceModels.length === 0 ? (
        <Card className="border-2 border-dashed shadow-none">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <Boxes className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium">No models in this workspace.</p>
              <p className="text-xs text-muted-foreground">Download from HuggingFace or drop a GGUF file here.</p>
            </div>
            <div className="w-full max-w-md">
              <DropZone onFilesSelected={handleFilesDrop} />
            </div>
            <Button size="sm" onClick={openHF}>
              <Download className="mr-1.5 size-3.5" /> Download from HF
            </Button>
          </CardContent>
        </Card>
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {workspaceModels.map((m, i) => (
            <ModelCard key={m.id} model={m} index={i} actions={actions} gpuVramGb={systemCapabilities.gpu_vram_gb} />
          ))}
        </div>
      ) : (
        <ModelTable models={workspaceModels} actions={actions} gpuVramGb={systemCapabilities.gpu_vram_gb} />
      )}

      {externalModels.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">External Models</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleScanExternalModels}
              disabled={scanningExternal}
            >
              {scanningExternal ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <FolderOpen className="mr-1.5 size-3.5" />
                  Scan External Directories
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Found {externalModels.length} external model directory{externalModels.length !== 1 && 's'}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {externalModels.map((dir, i) => (
              <ExternalModelCard key={dir.id} dir={dir} index={i} />
            ))}
          </div>
        </div>
      )}

      <EditModelDialog model={editModel} open={editOpen} onOpenChange={setEditOpen} focusPath={editFocusPath} />
      <LaunchConfirmDialog model={launchModel} open={launchOpen} onOpenChange={setLaunchOpen} />
      <HFDownloadDialog open={hfOpen} onOpenChange={setHfOpen} prefillRepo={hfPrefillRepo} prefillModelName={hfPrefillName} />
      <LocalModelImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        selectedFiles={selectedImportFiles}
        onImport={handleImportSelected}
        moveMode={importMoveMode}
        onMoveModeChange={setImportMoveMode}
        status={importStatus}
      />
    </div>
  );
}
