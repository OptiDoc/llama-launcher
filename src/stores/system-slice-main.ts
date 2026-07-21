/**
 * System slice — refreshSystem and bootstrap.
 */

import { tauri, isTauri } from "@/lib/tauri-api";
import { SYSTEM_CONSOLE_ID } from "@/lib/types";
import { restoreHibernatedState, emitLog, NOTIF_MESSAGES } from "@/lib/helpers";
import { log } from "@/lib/logger";
import type { StoreApi } from "zustand";
import type { LlamaStore } from "@/stores/types";
import type { MetricSample, AppStatus } from "@/lib/types";
import { createActivitySlice } from "./system-slice-activity";

export function createSystemMainSlice(set: StoreApi<LlamaStore>["setState"], get: StoreApi<LlamaStore>["getState"]) {
  const activity = createActivitySlice(set, get);

  return {
    ...activity,

    setAppStatus: (s: AppStatus) => set({ appStatus: s }),

    pushMetric: (m: MetricSample) => set((s) => ({ metrics: [...s.metrics.slice(-59), m] })),

    refreshSystem: async () => {
      const [sys, caps, gpus] = await Promise.all([
        tauri.getSystemInfo(),
        tauri.getSystemCapabilities(),
        tauri.getGpuInfo(),
      ]);
      if (sys) {
        const sample: MetricSample = {
          t: Date.now(),
          cpu: sys.cpu_percent,
          ram: sys.memory_total_mb > 0 ? (sys.memory_used_mb / sys.memory_total_mb) * 100 : 0,
          gpu: 0,
          gpuMem: 0,
          tps: get().instances?.reduce((sum, i) => sum + i.tokensPerSec, 0) ?? 0,
          reqPerMin: get().instances?.reduce((sum, i) => sum + i.requestsPerMin, 0) ?? 0,
        };
        if (gpus && gpus.length > 0) {
          const g = gpus[0];
          sample.gpuMem = g.memory_total_mb > 0 ? (g.memory_used_mb / g.memory_total_mb) * 100 : 0;
          sample.gpu = g.utilization_percent ?? 0;
        }
        get().pushMetric(sample);
      }
      if (caps) {
        set({
          systemCapabilities: {
            gpu_name: caps.gpu_name,
            gpu_vram_gb: Math.round(caps.gpu_vram_gb * 10) / 10,
            gpu_vendor: caps.gpu_vendor,
            ram_gb: Math.round(caps.ram_gb * 10) / 10,
            cpu_name: caps.cpu_name,
            cpu_cores: caps.cpu_cores,
            has_cuda: caps.has_cuda,
            has_vulkan: caps.has_vulkan,
            has_metal: caps.has_metal,
            has_rocm: caps.has_rocm,
            disk_free_gb: caps.disk_free_gb,
            os_name: caps.os_name,
          },
        });
      }
    },

    bootstrap: async () => {
      const persisted = restoreHibernatedState();
      if (persisted) {
        set({
          hibernatedInstanceIds: persisted.hibernatedInstanceIds,
          lastActivityAt: persisted.lastActivityAt,
        });
        if (persisted.hibernatedConfigs) {
          set((s) => ({
            instances: s.instances.map((inst) => {
              const cfg = persisted.hibernatedConfigs?.[inst.id];
              return cfg ? { ...inst, hibernatedConfig: cfg } : inst;
            }),
          }));
        }
        emitLog(
          SYSTEM_CONSOLE_ID,
          "info",
          `restored ${persisted.hibernatedInstanceIds.length} hibernated model(s) from previous session`,
        );
        get().addNotification?.(
          NOTIF_MESSAGES.configUpdated(`Restored ${persisted.hibernatedInstanceIds.length} hibernated model(s)`),
        );
      }

      if (!isTauri()) {
        if (get().workspaces?.length === 0) {
          get().addWorkspace?.({ name: "Personal", color: "blue", description: "Local dev & experiments" });
        }
        if (!get().activeWorkspaceId && get().workspaces?.length > 0) {
          set({ activeWorkspaceId: get().workspaces[0].id });
        }
        emitLog(
          SYSTEM_CONSOLE_ID,
          "warn",
          `not running in Tauri — data will be empty. Start the desktop app to scan real models.`,
        );
        return;
      }
      set({ tauriReady: true });

      try {
        const appDir = await tauri.ensureAppDir();
        emitLog(SYSTEM_CONSOLE_ID, "info", `app directory: ${appDir}`);
        set((s) => ({
          globalSettings: {
            ...s.globalSettings,
            modelsDir: `${appDir}/models`,
            llamaCppPath: `${appDir}/llama-server`,
            cudaLibsDir: `${appDir}/cuda`,
          },
        }));
        const cfg = await tauri.getConfig();
        if (cfg) {
          await tauri.updateConfig({
            ...cfg,
            models_directory: get().globalSettings.modelsDir,
          });
        }
      } catch (e) {
        emitLog(SYSTEM_CONSOLE_ID, "warn", `could not create app directory: ${e}`);
      }

      emitLog(SYSTEM_CONSOLE_ID, "info", `bootstrapping — fetching models, processes, workspaces…`);
      await Promise.all([
        get().refreshWorkspaces?.(),
        get().refreshModels?.(),
        get().refreshProcesses?.(),
        get().refreshExternalModels?.(),
        get().refreshSystem?.(),
      ]);
      let ws = get().workspaces;
      if (ws?.length === 0) {
        await tauri.createWorkspace("Personal", "blue", "Local dev & experiments");
        await get().refreshWorkspaces?.();
        ws = get().workspaces;
      }
      if (ws?.length > 0 && !get().activeWorkspaceId) {
        const activeId = await tauri.getActiveWorkspace();
        set({ activeWorkspaceId: activeId || ws[0].id });
      }
      const settingsMap: Record<
        string,
        {
          hibernate_after_sec: number;
          default_gpu_layers: number;
          default_threads: number;
          auto_calibrate: boolean;
          max_concurrent_instances: number;
        }
      > = {};
      for (const w of ws || []) {
        const st = await tauri.getWorkspaceSettings(w.id);
        if (st)
          settingsMap[w.id] = {
            hibernate_after_sec: st.hibernate_after_sec,
            default_gpu_layers: st.default_gpu_layers,
            default_threads: st.default_threads,
            auto_calibrate: st.auto_calibrate,
            max_concurrent_instances: st.max_concurrent_instances,
          };
      }
      set({ workspaceSettings: settingsMap });
      emitLog(
        SYSTEM_CONSOLE_ID,
        "success",
        `bootstrap complete — ${get().models?.length} models, ${get().instances?.length} instances, ${get().workspaces?.length} workspaces`,
      );
      get().addNotification?.(
        NOTIF_MESSAGES.configUpdated(
          `System ready — ${get().models?.length} models, ${get().instances?.length} instances`,
        ),
      );
    },
  };
}
