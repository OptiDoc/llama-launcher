"use client";

import * as React from "react";
import { useLlamaStore } from "@/lib/llama-store";
import type { LlamaModel, ViewMode } from "@/lib/llama-store";
import { tauri, isTauri } from "@/lib/tauri-api";
import { toast } from "@/hooks/use-toast";

const VIEW_STORAGE_KEY = "ll-models-view";

export function useModelsPage() {
  const models = useLlamaStore((s) => s.models);
  const externalModels = useLlamaStore((s) => s.externalModels);
  const systemCapabilities = useLlamaStore((s) => s.systemCapabilities);
  const activeWorkspaceId = useLlamaStore((s) => s.activeWorkspaceId);

  const workspaceModels = React.useMemo(
    () => models.filter((m) => m.workspaceId === activeWorkspaceId),
    [models, activeWorkspaceId],
  );
  const ready = workspaceModels.filter((m) => m.downloaded && !m.missing).length;

  const [view, setView] = React.useState<ViewMode>("grid");
  const [mounted, setMounted] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [editModel, setEditModel] = React.useState<LlamaModel | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editFocusPath, setEditFocusPath] = React.useState(false);
  const [hfOpen, setHfOpen] = React.useState(false);
  const [hfPrefillRepo, setHfPrefillRepo] = React.useState<string | undefined>(undefined);
  const [hfPrefillName, setHfPrefillName] = React.useState<string | undefined>(undefined);
  const [launchModel, setLaunchModel] = React.useState<LlamaModel | null>(null);
  const [launchOpen, setLaunchOpen] = React.useState(false);
  const [scanningExternal, setScanningExternal] = React.useState(false);
  const [importDialogOpen, setImportDialogOpen] = React.useState(false);
  const [selectedImportFiles, setSelectedImportFiles] = React.useState<string[]>([]);
  const [importMoveMode, setImportMoveMode] = React.useState(false);
  const [importStatus, setImportStatus] = React.useState<"idle" | "selecting" | "importing" | "done">("idle");

  React.useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "grid" || saved === "table") setView(saved);
    } catch { /* noop */ }
  }, []);

  const handleViewChange = React.useCallback((v: ViewMode) => {
    setView(v);
    try { localStorage.setItem(VIEW_STORAGE_KEY, v); } catch { /* noop */ }
  }, []);

  const selectedModel = selectedId ? workspaceModels.find((m) => m.id === selectedId) ?? null : null;

  const openHF = React.useCallback(() => {
    setHfPrefillRepo(undefined);
    setHfPrefillName(undefined);
    setHfOpen(true);
  }, []);

  const openHFForModel = React.useCallback((m: LlamaModel) => {
    setHfPrefillRepo(m.hfRepo);
    setHfPrefillName(m.name);
    setHfOpen(true);
  }, []);

  const handleScanExternalModels = React.useCallback(async () => {
    if (!isTauri()) return;
    setScanningExternal(true);
    try {
      await useLlamaStore.getState().refreshExternalModels();
    } finally {
      setScanningExternal(false);
    }
  }, []);

  const handleOpenImportDialog = React.useCallback(async () => {
    setImportStatus("selecting");
    const paths = await tauri.selectModelFiles();
    setImportStatus("idle");
    if (paths && paths.length > 0) {
      setSelectedImportFiles(paths);
      setImportDialogOpen(true);
    }
  }, []);

  const handleImportSelected = React.useCallback(async () => {
    if (selectedImportFiles.length === 0) return;
    setImportStatus("importing");
    const { importLocalModel } = useLlamaStore.getState();
    try {
      await importLocalModel({ move: importMoveMode, paths: selectedImportFiles });
      setImportStatus("done");
      setTimeout(() => {
        setImportDialogOpen(false);
        setSelectedImportFiles([]);
        setImportStatus("idle");
      }, 1500);
      toast({
        title: "Import complete",
        description: `${selectedImportFiles.length} model${selectedImportFiles.length !== 1 ? 's' : ''} imported`,
      });
    } catch (err) {
      setImportStatus("idle");
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }, [selectedImportFiles, importMoveMode]);

  const handleFilesDrop = React.useCallback(async (files: FileList) => {
    const ggufFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".gguf"));
    if (ggufFiles.length === 0) return;
    handleOpenImportDialog();
  }, [handleOpenImportDialog]);

  const openEdit = React.useCallback((m: LlamaModel, focusPath = false) => {
    setEditModel(m);
    setEditFocusPath(focusPath);
    setEditOpen(true);
  }, []);

  const handleLoad = React.useCallback((m: LlamaModel) => {
    setLaunchModel(m);
    setLaunchOpen(true);
  }, []);

  const actions = {
    onSelect: (m: LlamaModel) => setSelectedId(m.id),
    onEdit: (m: LlamaModel) => openEdit(m, m.missing),
    onDownload: openHFForModel,
    onLoad: handleLoad,
  };

  return {
    workspaceModels, ready, view, mounted, selectedModel, externalModels,
    systemCapabilities, scanningExternal, editModel, editOpen, editFocusPath,
    launchModel, launchOpen, hfOpen, hfPrefillRepo, hfPrefillName,
    importDialogOpen, selectedImportFiles, importMoveMode, importStatus,
    setEditOpen, setLaunchOpen, setHfOpen, setImportDialogOpen,
    setImportMoveMode, setSelectedImportFiles, handleViewChange,
    handleScanExternalModels, handleOpenImportDialog, handleImportSelected,
    handleFilesDrop, openEdit, handleLoad, openHF, actions, setSelectedId,
  };
}
