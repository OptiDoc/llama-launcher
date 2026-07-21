/**
 * Instances slice — startInstance.
 */

import { tauri, isTauri } from "@/lib/tauri-api";
import { emitLog, renameLogKey, uid, nowTs, mapTauriProcess, NOTIF_MESSAGES } from "@/lib/helpers";
import { SYSTEM_CONSOLE_ID } from "@/lib/types";
import { log } from "@/lib/logger";
import type { StoreApi } from "zustand";
import type { LlamaStore } from "@/stores/types";
import type { LlamaInstance } from "@/lib/types";
import type { InstancesSlice } from "./instances-slice-types";

export function createStartInstanceSlice(
  set: StoreApi<LlamaStore>["setState"],
  get: StoreApi<LlamaStore>["getState"],
): Pick<InstancesSlice, "refreshProcesses" | "startInstance"> {
  return {
    refreshProcesses: async () => {
      const tauriProcs = await tauri.listProcesses();
      if (!tauriProcs) {
        log.debug("[STORE] refreshProcesses: listProcesses returned null", { category: "store" });
        return;
      }
      const models = get().models;
      const mapped: LlamaInstance[] = tauriProcs.map((p) => mapTauriProcess(p, models));
      set({ instances: mapped });
      for (const p of mapped) {
        if (p.status === "running" || p.status === "starting") {
          get().refreshConsoleLogs(p.id);
        }
      }
    },

    startInstance: ({
      name,
      model,
      profile,
      port,
      host,
      gpu,
    }: {
      name: string;
      model: string;
      profile: string;
      port: number;
      host: string;
      gpu: string;
    }) => {
      if (isTauri()) {
        const wsId = get().activeWorkspaceId;
        const prof = get().profiles.find((p) => p.id === profile);
        const colors: LlamaInstance["color"][] = ["green", "orange", "blue", "pink", "purple"];
        const color = colors[get().instances.length % colors.length];
        const placeholderId = uid("inst");
        const instance: LlamaInstance = {
          id: placeholderId,
          name,
          model,
          profile: prof?.name ?? "default",
          port,
          host,
          status: "starting",
          gpu,
          ctxSize: prof ? parseInt(prof.ctxSize) || 8192 : 8192,
          threads: prof ? parseInt(prof.threads) || 8 : 8,
          color,
          startedAt: nowTs(),
          promptTokens: 0,
          generatedTokens: 0,
          requestsPerMin: 0,
          tokensPerSec: 0,
          memoryMb: 0,
          peakTokensPerSec: 0,
          totalRequests: 0,
          errorCount: 0,
          workspaceId: wsId,
          metrics: null,
          log: [],
          hibernatedConfig: null,
        };
        set((s) => ({
          instances: [...s.instances, instance],
          logs: { ...s.logs, [placeholderId]: [] },
          activeConsoleId: placeholderId,
          consoleOpen: true,
        }));
        emitLog(placeholderId, "info", `Launching llama-server for "${name}" (model: ${model})`);
        emitLog(placeholderId, "info", `  model       : ${model}`);
        emitLog(placeholderId, "info", `  profile     : ${prof?.name ?? "default"}`);
        emitLog(placeholderId, "info", `  host:port   : ${host}:${port}`);
        emitLog(placeholderId, "info", `  gpu         : ${gpu}`);

        (async () => {
          const tauriProc = await tauri.startModel(model, {
            context_size: prof ? parseInt(prof.ctxSize) || 8192 : 8192,
            gpu_layers: prof ? parseInt(prof.gpuLayers) || -1 : -1,
            threads: prof ? parseInt(prof.threads) || 4 : 4,
            batch_size: prof ? parseInt(prof.batchSize) || 512 : 512,
            ubatch_size: prof ? parseInt(prof.ubatchSize) || 512 : 512,
            flash_attn: prof?.flashAttention ?? true,
            no_mmap: !(prof?.mmap ?? true),
            no_mlock: prof?.mlock ?? false,
            numa: prof?.numa ?? false,
            port,
            host,
            parallel: prof ? parseInt(prof.parallel) || -1 : -1,
            cont_batching: prof?.contBatching ?? true,
            n_predict: prof ? parseInt(prof.nPredict) || -1 : -1,
            timeout: prof ? parseInt(prof.timeout) || 3600 : 3600,
            metrics: prof?.metrics ?? false,
            api_key: prof?.apiKey ?? "",
            threads_batch: prof ? parseInt(prof.threadsBatch) || -1 : -1,
            cache_type_k: prof?.cacheTypeK ?? "f16",
            cache_type_v: prof?.cacheTypeV ?? "f16",
            split_mode: prof?.splitMode ?? "layer",
            tensor_split: prof?.tensorSplit ?? "",
            main_gpu: prof ? parseInt(prof.mainGpu) || 0 : 0,
            kv_offload: prof?.kvOffload ?? true,
            fit: prof?.fit ?? true,
            temperature: prof ? parseFloat(prof.temperature) || 0.8 : 0.8,
            top_k: prof ? parseInt(prof.topK) || 40 : 40,
            top_p: prof ? parseFloat(prof.topP) || 0.95 : 0.95,
            min_p: prof ? parseFloat(prof.minP) || 0.05 : 0.05,
            repeat_penalty: prof ? parseFloat(prof.repeatPenalty) || 1.1 : 1.1,
            repeat_last_n: prof ? parseInt(prof.repeatLastN) || 64 : 64,
            presence_penalty: prof ? parseFloat(prof.presencePenalty) || 0 : 0,
            frequency_penalty: prof ? parseFloat(prof.frequencyPenalty) || 0 : 0,
            seed: prof ? parseInt(prof.seed) || -1 : -1,
            lora: prof?.lora ?? "",
            mmproj: prof?.mmproj ?? "",
            jinja: prof?.jinja ?? true,
            reasoning_format: prof?.reasoningFormat ?? "auto",
            reasoning_budget: prof ? parseInt(prof.reasoningBudget) || -1 : -1,
            chat_template: prof?.chatTemplate ?? "",
            rope_scaling: prof?.ropeScaling ?? "",
            rope_scale: prof ? parseFloat(prof.ropeScale) || 0 : 0,
            rope_freq_base: prof ? parseFloat(prof.ropeFreqBase) || 0 : 0,
            rope_freq_scale: prof ? parseFloat(prof.ropeFreqScale) || 0 : 0,
            grammar: prof?.grammar ?? "",
            json_schema: prof?.jsonSchema ?? "",
            log_level: prof ? parseInt(prof.logLevel) || 3 : 3,
            arguments: prof?.extraArgs ? prof.extraArgs.split(" ").filter(Boolean) : [],
          });
          if (tauriProc) {
            set((s) => ({
              instances: s.instances.map((i) =>
                i.id === placeholderId
                  ? { ...i, id: tauriProc.id, status: "running", port: tauriProc.port, pid: tauriProc.pid ?? undefined }
                  : i,
              ),
              logs: renameLogKey(s.logs, placeholderId, tauriProc.id),
              activeConsoleId: tauriProc.id,
            }));
            emitLog(tauriProc.id, "success", `server started (pid: ${tauriProc.pid}, port: ${tauriProc.port})`);
            get().addNotification?.(NOTIF_MESSAGES.processStarted(name));
          } else {
            set((s) => ({
              instances: s.instances.map((i) => (i.id === placeholderId ? { ...i, status: "error" } : i)),
            }));
            emitLog(placeholderId, "error", `Failed to start llama-server. Check the binary path in Settings.`);
            get().addNotification?.(
              NOTIF_MESSAGES.processFailed(name, "Failed to start llama-server. Check the binary path in Settings."),
            );
          }
        })().catch((e) => {
          const errMsg = e instanceof Error ? e.message : String(e);
          emitLog(placeholderId, "error", `Unexpected error: ${errMsg}`);
          set((s) => ({
            instances: s.instances.map((i) => (i.id === placeholderId ? { ...i, status: "error" } : i)),
          }));
          get().addNotification?.(NOTIF_MESSAGES.processFailed(name, errMsg));
        });
        get().registerActivity?.();
        return placeholderId;
      }
      emitLog(SYSTEM_CONSOLE_ID, "warn", `cannot start real llama-server — run in Tauri desktop app.`);
      get().addNotification?.(NOTIF_MESSAGES.systemError("Cannot start instance in web mode — use the desktop app"));
      return "";
    },
  };
}
