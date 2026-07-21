/**
 * Downloads slice — startReleaseDownload.
 */

import { tauri, isTauri } from "@/lib/tauri-api";
import type { HFDownload, LlamaRelease } from "@/lib/types";
import { uid, nowTs, emitLog, NOTIF_MESSAGES } from "@/lib/helpers";
import { formatDuration } from "@/lib/utils";
import { SYSTEM_CONSOLE_ID } from "@/lib/types";
import { log } from "@/lib/logger";
import type { StoreApi } from "zustand";
import type { LlamaStore } from "@/stores/types";
import { patchDownload, patchRelease } from "./downloads-slice-types";

export function createStartReleaseDownloadSlice(
  set: StoreApi<LlamaStore>["setState"],
  get: StoreApi<LlamaStore>["getState"],
) {
  return {
    startReleaseDownload: (releaseId: string) => {
      const dlId = uid("dl");
      const rel = get().releases.find((r) => r.id === releaseId);
      if (!rel) {
        log.warn("[STORE] startReleaseDownload: release not found", { category: "store", context: { releaseId } });
        return dlId;
      }
      const sizeMb = rel.sizeMb ?? 0;
      const sizeGb = sizeMb / 1024;
      const filename = `llama-${rel.tag}-bin-${rel.variant}-x64.zip`;
      const dl: HFDownload = {
        id: dlId,
        repo: `llama.cpp ${rel.tag} (${rel.variant})`,
        quant: rel.variant,
        filename,
        sizeGb,
        progress: 0,
        speed: 0,
        eta: "",
        status: "downloading",
        startedAt: nowTs(),
        modelName: `llama.cpp ${rel.tag}`,
        builder: "ggerganov",
        kind: "release",
        variant: rel.variant,
        completedAt: null,
      };
      set((s) => ({
        downloads: [...s.downloads, dl],
        releases: patchRelease(s, releaseId, { installing: true, installProgress: 0 }),
      }));

      const msg = NOTIF_MESSAGES.releaseDownloadStart(rel.tag, rel.variant, sizeMb);
      get().addNotification?.(msg);
      log.info("[STORE] Release download started", {
        category: "store",
        context: { tag: rel.tag, variant: rel.variant, sizeMb },
      });

      (async () => {
        if (!isTauri()) {
          set((st) => ({
            downloads: patchDownload(st, dlId, { status: "failed" }),
            releases: patchRelease(st, releaseId, { installing: false }),
          }));
          emitLog(SYSTEM_CONSOLE_ID, "error", `install requires Tauri desktop app`);
          get().addNotification?.(NOTIF_MESSAGES.systemError("Install requires Tauri desktop app"));
          return;
        }

        emitLog(SYSTEM_CONSOLE_ID, "info", `installing ${rel.tag} (${rel.variant}, ${sizeMb} MB) from GitHub`);

        const result = await tauri.installRelease(rel.tag, rel.variant, dlId, (p) => {
          const pct = p.total > 0 ? (p.downloaded / p.total) * 100 : 0;
          const eta = p.speed > 0 && p.total > 0 ? formatDuration((p.total - p.downloaded) / p.speed) : "";
          set((st) => ({
            downloads: patchDownload(st, dlId, { progress: pct, speed: p.speed, eta }),
            releases: patchRelease(st, releaseId, { installProgress: pct }),
          }));
        });

        if (result) {
          set((st) => ({
            downloads: patchDownload(st, dlId, { progress: 100, speed: 0, eta: "", status: "completed" }),
            releases: patchRelease(st, releaseId, { installing: false, installProgress: 100, installed: true }),
          }));
          emitLog(SYSTEM_CONSOLE_ID, "success", `${rel.tag} (${rel.variant}) installed → ${result}`);
          const msg2 = NOTIF_MESSAGES.releaseInstalled(rel.tag, rel.variant);
          get().addNotification?.(msg2);
        } else {
          set((st) => ({
            downloads: patchDownload(st, dlId, { status: "failed" }),
            releases: patchRelease(st, releaseId, { installing: false }),
          }));
          emitLog(SYSTEM_CONSOLE_ID, "error", `install failed: ${rel.tag} (${rel.variant})`);
          get().addNotification?.(NOTIF_MESSAGES.systemError(`Install failed: ${rel.tag} (${rel.variant})`));
        }
      })().catch((e) => {
        const errMsg = e instanceof Error ? e.message : String(e);
        emitLog(SYSTEM_CONSOLE_ID, "error", `unexpected error: ${rel.tag} (${rel.variant}) — ${errMsg}`);
        set((st) => ({
          downloads: patchDownload(st, dlId, { status: "failed" }),
          releases: patchRelease(st, releaseId, { installing: false }),
        }));
        get().addNotification?.(NOTIF_MESSAGES.systemError(`Unexpected error: ${rel.tag} (${rel.variant}) — ${errMsg}`));
      });

      return dlId;
    },
  };
}
