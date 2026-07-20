/**
 * Downloads slice — startHFDownload.
 */

import { tauri, isTauri } from "@/lib/tauri-api";
import type { HFDownload, LlamaModel, LlamaRelease } from "@/lib/types";
import { uid, nowTs, emitLog, NOTIF_MESSAGES } from "@/lib/helpers";
import { formatDuration } from "@/lib/utils";
import { HF_QUANTS } from "@/lib/catalog";
import { SYSTEM_CONSOLE_ID } from "@/lib/types";
import { log } from "@/lib/logger";
import type { StoreApi } from "zustand";
import type { LlamaStore } from "@/stores/types";
import { patchDownload, patchModel } from "./downloads-slice-types";

export function createStartHFDownloadSlice(
  set: StoreApi<LlamaStore>["setState"],
  get: StoreApi<LlamaStore>["getState"],
) {
  return {
    startHFDownload: ({ repo, quant, modelName, builder }: { repo: string; quant: string; modelName: string; builder: string }) => {
      const dlId = uid("dl");
      const modelId = uid("m");
      const q = HF_QUANTS.find((x) => x.id === quant);
      const sizeGb = 8 * (q?.sizeFactor ?? 0.6);
      const repoName = repo.split("/")[1];
      const baseName = repoName.replace(/[-_]?[Gg][Gg][Uu][Ff]$/i, "");
      const fallbackFilename = `${baseName}.${quant}.gguf`;

      const placeholderModel: LlamaModel = {
        id: modelId,
        name: `${modelName} ${quant}`,
        family: "unknown",
        sizeGb: Math.round(sizeGb * 10) / 10,
        quant, downloaded: false, missing: false,
        path: `${get().globalSettings.modelsDir}/${fallbackFilename}`, hfRepo: repo, builder,
        architecture: "llama",
        contextLength: 8192,
        parameterCount: "?B",
        quantizationBits: q?.bits ?? 4,
        license: "Unknown",
        description: modelName,
        uploadedAt: new Date().toISOString().slice(0, 10),
        hfDownloads: 0,
        tags: [],
        isMoe: false,
        expertCount: undefined,
        workspaceId: get().activeWorkspaceId,
        addedAt: nowTs(),
        downloading: true,
        downloadProgress: 0,
        downloadId: dlId,
      };

      const dl: HFDownload = {
        id: dlId, repo, quant, filename: fallbackFilename, sizeGb, progress: 0, speed: 0, eta: "", status: "downloading",
        startedAt: nowTs(), modelName, builder, kind: "model", completedAt: null,
      };
      set((s) => ({ downloads: [...s.downloads, dl], models: [...s.models, placeholderModel] }));

      const msg = NOTIF_MESSAGES.modelDownloadStart(modelName, quant, sizeGb);
      get().addNotification?.({ kind: "download", ...msg });
      log.info("[STORE] Model download started", { category: "store", context: { modelName, quant, sizeGb } });

      (async () => {
        if (!isTauri()) {
          set((st) => ({
            downloads: patchDownload(st, dlId, { status: "failed" }),
            models: patchModel(st, modelId, { downloading: false, missing: true }),
          }));
          emitLog(SYSTEM_CONSOLE_ID, "error", `download requires Tauri desktop app`);
          return;
        }

        emitLog(SYSTEM_CONSOLE_ID, "info", `checking repo accessibility: ${repo}…`);
        try {
          const checkResp = await fetch(`https://huggingface.co/api/models/${repo}`, { method: "HEAD" });
          if (!checkResp.ok) {
            const statusText = checkResp.status === 401 ? "requires authentication (gated repo)" : checkResp.status === 404 ? "not found" : `HTTP ${checkResp.status}`;
            emitLog(SYSTEM_CONSOLE_ID, "error", `repo ${repo} is not accessible: ${statusText}`);
            set((st) => ({
              downloads: patchDownload(st, dlId, { status: "failed" }),
              models: patchModel(st, modelId, { downloading: false, missing: true }),
            }));
            const msg2 = NOTIF_MESSAGES.modelDownloadFailed(modelName, `Repo ${repo} is not accessible: ${statusText}`);
            get().addNotification?.({ kind: "download", ...msg2 });
            return;
          }
        } catch {
          emitLog(SYSTEM_CONSOLE_ID, "warn", `could not verify repo accessibility, proceeding anyway`);
        }

        emitLog(SYSTEM_CONSOLE_ID, "info", `resolving download URL for ${repo} (${quant})…`);
        let resolvedFilename = fallbackFilename;
        let resolvedSize = 0;
        try {
          const apiUrl = `https://huggingface.co/api/models/${repo}/tree/main`;
          const resp = await fetch(apiUrl);
          if (resp.ok) {
            const items: Array<{ path: string; size?: number; type?: string }> = await resp.json();
            const quantLower = quant.toLowerCase();
            const ggufFiles = items.filter((f) =>
              f.type === "file" && f.path.endsWith(".gguf") && f.path.toLowerCase().includes(quantLower)
            );
            if (ggufFiles.length > 0) {
              const exact = ggufFiles.find((f) => f.path.toLowerCase().endsWith(`-${quantLower}.gguf`))
                ?? ggufFiles.find((f) => f.path.toLowerCase().endsWith(`.${quantLower}.gguf`))
                ?? ggufFiles[0];
              resolvedFilename = exact.path;
              resolvedSize = exact.size ?? 0;
              emitLog(SYSTEM_CONSOLE_ID, "info", `resolved file: ${resolvedFilename} (${Math.round(resolvedSize / 1e6)} MB)`);
            } else {
              for (const item of items) {
                if (item.type === "directory" && item.path.toLowerCase().includes(quantLower)) {
                  const subResp = await fetch(`https://huggingface.co/api/models/${repo}/tree/main/${item.path}`);
                  if (subResp.ok) {
                    const subItems: Array<{ path: string; size?: number; type?: string }> = await subResp.json();
                    const subGguf = subItems.find((f) => f.type === "file" && f.path.endsWith(".gguf"));
                    if (subGguf) {
                      resolvedFilename = subGguf.path;
                      resolvedSize = subGguf.size ?? 0;
                      emitLog(SYSTEM_CONSOLE_ID, "info", `resolved file (subdir): ${resolvedFilename} (${Math.round(resolvedSize / 1e6)} MB)`);
                      break;
                    }
                  }
                }
              }
            }
          } else {
            emitLog(SYSTEM_CONSOLE_ID, "warn", `HF API returned ${resp.status}, using fallback filename`);
          }
        } catch (apiErr) {
          emitLog(SYSTEM_CONSOLE_ID, "warn", `HF API lookup failed: ${apiErr instanceof Error ? apiErr.message : String(apiErr)}, using fallback`);
        }

        const modelsDir = get().globalSettings.modelsDir;
        const dest = `${modelsDir}/${resolvedFilename}`;
        const url = `https://huggingface.co/${repo}/resolve/main/${resolvedFilename}`;
        set((st) => ({
          downloads: patchDownload(st, dlId, { filename: resolvedFilename }),
          models: patchModel(st, modelId, { path: dest }),
        }));
        emitLog(SYSTEM_CONSOLE_ID, "info", `downloading ${resolvedFilename} from ${repo} → ${dest}`);

        const result = await tauri.downloadFile(url, dest, dlId, (p) => {
          const pct = p.total > 0 ? (p.downloaded / p.total) * 100 : 0;
          const eta = p.speed > 0 && p.total > 0
            ? formatDuration((p.total - p.downloaded) / p.speed)
            : "";
          set((st) => ({
            downloads: patchDownload(st, dlId, { progress: pct, speed: p.speed, eta }),
            models: patchModel(st, modelId, { downloadProgress: pct, downloadId: dlId }),
          }));
        });

        if (!result) {
          emitLog(SYSTEM_CONSOLE_ID, "error", `download failed: ${resolvedFilename}`);
          set((st) => ({
            downloads: patchDownload(st, dlId, { status: "failed" }),
            models: patchModel(st, modelId, { downloading: false, downloadProgress: 0, missing: true }),
          }));
          return;
        }

        if (result) {
          set((st) => ({
            downloads: patchDownload(st, dlId, { progress: 100, speed: 0, eta: "", status: "completed" }),
            models: patchModel(st, modelId, { downloading: false, downloaded: true, missing: false, path: result }),
          }));
          emitLog(SYSTEM_CONSOLE_ID, "success", `download complete: ${resolvedFilename} → ${result}`);
          const msg2 = NOTIF_MESSAGES.modelDownloadComplete(modelName, quant);
          get().addNotification?.({ kind: "download", ...msg2 });
          await get().refreshModels();
        }
      })().catch((e) => {
        const errMsg = e instanceof Error ? e.message : String(e);
        emitLog(SYSTEM_CONSOLE_ID, "error", `download unexpected error: ${fallbackFilename} — ${errMsg}`);
        set((st) => ({
          downloads: patchDownload(st, dlId, { status: "failed" }),
          models: patchModel(st, modelId, { downloading: false, downloadProgress: 0, missing: true }),
        }));
      });
      return dlId;
    },
  };
}
