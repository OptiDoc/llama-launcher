/**
 * Downloads slice — cancel and retry.
 */

import { tauri } from "@/lib/tauri-api";
import { emitLog, NOTIF_MESSAGES } from "@/lib/helpers";
import { SYSTEM_CONSOLE_ID } from "@/lib/types";
import { log } from "@/lib/logger";
import type { StoreApi } from "zustand";
import type { LlamaStore } from "@/stores/types";
import type { DownloadsSlice } from "./downloads-slice-types";

export function createCancelDownloadSlice(
  set: StoreApi<LlamaStore>["setState"],
  get: StoreApi<LlamaStore>["getState"],
): Pick<DownloadsSlice, "cancelDownload" | "retryDownload"> {
  return {
    cancelDownload: async (dlId) => {
      log.info("[STORE] Cancelling download", { category: "store", context: { dlId } });
      await tauri.cancelDownload(dlId);
      set((s) => ({
        downloads: s.downloads.map((d) => (d.id === dlId ? { ...d, status: "failed" as const } : d)),
      }));
      get().addNotification?.({
        kind: "download",
        title: "Download cancelled",
        body: `Download ${dlId.slice(0, 8)} was cancelled.`,
      });
      emitLog(SYSTEM_CONSOLE_ID, "info", `download ${dlId} cancelled by user`);
    },

    retryDownload: async (dlId) => {
      const dl = get().downloads.find((d) => d.id === dlId);
      if (!dl) {
        log.warn("[STORE] retryDownload: download not found", { category: "store", context: { dlId } });
        return;
      }
      log.info("[STORE] Retrying download", { category: "store", context: { dlId, kind: dl.kind } });
      if (dl.kind === "model") {
        const model = get().models.find(
          (m) => m.name === dl.modelName && m.quant === dl.quant && m.builder === dl.builder
        );
        if (model && model.hfRepo) {
          get().startHFDownload({ repo: model.hfRepo, quant: model.quant, modelName: model.name, builder: model.builder });
        }
      }
    },
  };
}
