import { tauri, isTauri } from "@/lib/tauri-api";
import type { LlamaModel } from "@/lib/types";
import type { ExternalModelDir } from "@/lib/tauri-api";
import { emitLog, mapTauriModel, uid, NOTIF_MESSAGES } from "@/lib/helpers";
import { log } from "@/lib/logger";
import { SYSTEM_CONSOLE_ID } from "@/lib/types";
import type { StoreApi } from "zustand";
import type { LlamaStore } from "@/stores/types";

export interface ModelsSlice {
  models: LlamaModel[];
  externalModels: ExternalModelDir[];
  refreshModels: () => Promise<void>;
  importLocalModel: (options?: { move?: boolean; paths?: string[] }) => Promise<void>;
  updateModel: (id: string, patch: Partial<LlamaModel>) => void;
  deleteModel: (id: string) => void;
  markModelMissing: (id: string, missing: boolean) => void;
  locateModel: (id: string, newPath: string) => void;
  refreshExternalModels: () => Promise<void>;
}

export function createModelsSlice(
  set: StoreApi<LlamaStore>["setState"],
  get: StoreApi<LlamaStore>["getState"],
): ModelsSlice {
  return {
    models: [],
    externalModels: [],

    refreshModels: async () => {
      const tauriModels = await tauri.scanModels();
      if (!tauriModels) {
        log.debug("[STORE] refreshModels: scanModels returned null", { category: "store" });
        return;
      }
      const wsId = get().activeWorkspaceId;
      const mapped: LlamaModel[] = tauriModels.map((m) => mapTauriModel(m, wsId));
      set({ models: mapped });
    },

    importLocalModel: async (options) => {
      log.info("[STORE] importLocalModel called", { category: "store", context: options });
      if (!isTauri()) {
        emitLog(SYSTEM_CONSOLE_ID, "error", `import requires Tauri desktop app`);
        log.warn("[STORE] importLocalModel: not in Tauri mode", { category: "store" });
        return;
      }
      const paths = options?.paths ?? (await tauri.selectModelFiles());
      if (!paths || paths.length === 0) {
        log.info("[STORE] importLocalModel: no files selected", { category: "store" });
        return;
      }
      const modelsDir = get().globalSettings.modelsDir;
      let imported = 0;
      for (const srcPath of paths) {
        try {
          await tauri.importModelFiles?.([srcPath], modelsDir, options?.move ?? false);
          imported++;
        } catch (e) {
          log.error("[STORE] importLocalModel: failed to import", { category: "store", context: { path: srcPath, error: String(e) } });
        }
      }
      if (imported > 0) {
        await get().refreshModels();
        emitLog(SYSTEM_CONSOLE_ID, "success", `imported ${imported} model${imported !== 1 ? 's' : ''}`);
        const msg = NOTIF_MESSAGES.modelImported(`${imported} model${imported !== 1 ? 's' : ''}`);
        get().addNotification({ kind: "success", ...msg });
        log.success("[STORE] Models imported successfully", { category: "store", context: { count: imported } });
      } else {
        log.warn("[STORE] importLocalModel: no models imported", { category: "store" });
      }
    },

    updateModel: (id, patch) => set((s) => ({
      models: s.models.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),

    deleteModel: (id) => set((s) => ({ models: s.models.filter((m) => m.id !== id) })),

    markModelMissing: (id, missing) => set((s) => ({
      models: s.models.map((m) => (m.id === id ? { ...m, missing, downloaded: missing ? false : m.downloaded } : m)),
    })),

    locateModel: (id, newPath) => set((s) => ({
      models: s.models.map((m) => (m.id === id ? { ...m, path: newPath, missing: false, downloaded: true } : m)),
    })),

    refreshExternalModels: async () => {
      log.info("[STORE] refreshExternalModels called", { category: "store" });
      if (!isTauri()) {
        log.debug("[STORE] Not in Tauri mode, skipping external models scan", { category: "store" });
        return;
      }
      const externalModels = await tauri.scanExternalModels();
      set({ externalModels });
      emitLog(SYSTEM_CONSOLE_ID, "info", `found ${externalModels.length} external model directories`);
      log.success("[STORE] External models refreshed", { category: "store", context: { count: externalModels.length } });
    },
  };
}
