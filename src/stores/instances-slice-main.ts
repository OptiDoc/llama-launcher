/**
 * Instances slice — stop, remove, mark, bump, refreshConsoleLogs.
 */

import { tauri, isTauri } from "@/lib/tauri-api";
import { emitLog, nowTs } from "@/lib/helpers";
import { SYSTEM_CONSOLE_ID } from "@/lib/types";
import { log } from "@/lib/logger";
import type { StoreApi } from "zustand";
import type { LlamaStore } from "@/stores/types";
import type { ConsoleLine, LlamaInstance, InstancesSlice } from "@/lib/types";

export function createInstancesMainSlice(
  set: StoreApi<LlamaStore>["setState"],
  get: StoreApi<LlamaStore>["getState"],
): Pick<InstancesSlice, "stopInstance" | "removeInstance" | "markRunning" | "markStopped" | "bumpStats" | "refreshConsoleLogs"> {
  return {
    stopInstance: async (id) => {
      const inst = get().instances.find((i) => i.id === id);
      if (!inst) {
        log.warn("[STORE] stopInstance: instance not found", { category: "store", context: { id } });
        return;
      }
      set((s) => ({ instances: s.instances.map((i) => (i.id === id ? { ...i, status: "stopping" } : i)) }));
      emitLog(id, "warn", `sending stop signal…`);
      if (isTauri()) {
        try {
          await tauri.stopModel(id);
          await get().refreshProcesses();
          emitLog(id, "success", `server stopped cleanly.`);
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          emitLog(id, "error", `failed to stop server: ${errMsg}`);
          set((s) => ({ instances: s.instances.map((i) => (i.id === id ? { ...i, status: "error" } : i)) }));
        }
      }
    },

    removeInstance: (id) => {
      set((s) => {
        const newLogs = { ...s.logs };
        delete newLogs[id];
        return {
          instances: s.instances.filter((i) => i.id !== id),
          logs: newLogs,
          activeConsoleId: s.activeConsoleId === id ? SYSTEM_CONSOLE_ID : s.activeConsoleId,
        };
      });
    },

    markRunning: (id) => set((s) => ({
      instances: s.instances.map((i) => (i.id === id ? { ...i, status: "running", startedAt: i.startedAt ?? nowTs() } : i)),
    })),

    markStopped: (id) => set((s) => ({
      instances: s.instances.map((i) => (i.id === id ? { ...i, status: "stopped", startedAt: 0 } : i)),
    })),

    bumpStats: (id, prompt, gen, tps) => set((s) => ({
      instances: s.instances.map((i) =>
        i.id === id
          ? {
              ...i,
              promptTokens: i.promptTokens + prompt,
              generatedTokens: i.generatedTokens + gen,
              tokensPerSec: tps,
              peakTokensPerSec: Math.max(i.peakTokensPerSec, tps),
              requestsPerMin: i.requestsPerMin + 1,
              totalRequests: i.totalRequests + 1,
              memoryMb: Math.round(i.ctxSize * 0.5 + 1200 + Math.random() * 200),
            }
          : i,
      ),
    })),

    refreshConsoleLogs: async (instanceId) => {
      const lines = await tauri.getProcessStdout(instanceId, 200);
      if (!lines) {
        log.debug("[STORE] refreshConsoleLogs: getProcessStdout returned null", { category: "store", context: { instanceId } });
        return;
      }
      const consoleLines: ConsoleLine[] = lines.map((text, i) => ({
        id: `${instanceId}_log_${i}`,
        instanceId,
        ts: Date.now() - (lines.length - i) * 100,
        kind: "info" as const,
        text,
      }));
      set((s) => ({ logs: { ...s.logs, [instanceId]: consoleLines } }));
    },
  };
}
