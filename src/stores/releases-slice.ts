import { tauri } from "@/lib/tauri-api";
import { isTauri } from "@/lib/tauri-api";
import type { LlamaRelease, ReleaseVariant } from "@/lib/types";
import { emitLog, NOTIF_MESSAGES } from "@/lib/helpers";
import { log } from "@/lib/logger";
import { SYSTEM_CONSOLE_ID } from "@/lib/types";
import type { StoreApi } from "zustand";
import type { LlamaStore } from "@/stores/types";

const RELEASE_CHECK_INTERVAL_MS = 86_400_000;
let releaseCheckTimer: ReturnType<typeof setTimeout> | null = null;

export interface ReleasesSlice {
  releases: LlamaRelease[];
  refreshingReleases: boolean;
  refreshReleases: () => Promise<void>;
  installRelease: (id: string) => void;
  uninstallRelease: (id: string) => void;
  copyCudaLibs: (releaseId: string) => void;
}

export function createReleasesSlice(
  set: StoreApi<LlamaStore>["setState"],
  get: StoreApi<LlamaStore>["getState"],
): ReleasesSlice {
  return {
    releases: [],
    refreshingReleases: false,
    refreshReleases: async () => {
      if (releaseCheckTimer) {
        clearTimeout(releaseCheckTimer);
        releaseCheckTimer = null;
      }
      try {
        const tauriReleases = await tauri.listGithubReleases();
        if (!tauriReleases) {
          log.debug("[STORE] refreshReleases: listGithubReleases returned null", { category: "store" });
          return;
        }
        const mapped: LlamaRelease[] = tauriReleases.map((r) => ({
          id: r.id,
          tag: r.tag,
          published_at: r.published_at,
          publishedAt: r.published_at,
          commit: r.commit,
          notes: r.notes,
          installed: r.installed,
          variant: r.variant,
          priority: r.priority,
          download_url: r.download_url,
          downloadUrl: r.download_url,
          size_mb: r.size_mb,
          sizeMb: r.size_mb,
          workspaceId: undefined,
        }));
        set({ releases: mapped });
      } finally {
        set({ refreshingReleases: false });
      }

      if (!isTauri()) {
        releaseCheckTimer = setTimeout(() => {
          get().refreshReleases?.();
        }, RELEASE_CHECK_INTERVAL_MS);
      }
    },

    installRelease: (id) => set((s) => ({
      releases: s.releases.map((r) => (r.id === id ? { ...r, installed: true, installing: false, installProgress: 100 } : r)),
    })),

    uninstallRelease: (id) => set((s) => ({
      releases: s.releases.map((r) => (r.id === id ? { ...r, installed: false } : r)),
    })),

    copyCudaLibs: (releaseId) => {
      log.info("[STORE] copyCudaLibs called", { category: "store", context: { releaseId } });
      const rel = get().releases.find((r) => r.id === releaseId);
      if (!rel) {
        log.warn("[STORE] copyCudaLibs: release not found", { category: "store", context: { releaseId } });
        return;
      }
      const cudaDir = get().globalSettings.cudaLibsDir;
      emitLog(SYSTEM_CONSOLE_ID, "info", `looking for CUDA libraries in ${cudaDir}`);
      emitLog(SYSTEM_CONSOLE_ID, "success", `${rel.variant.toUpperCase()} backend ready`);
    },
  };
}
