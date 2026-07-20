/**
 * System slice — main entry point.
 */

import { nowTs, seedMetrics } from "@/lib/helpers";
import { SYSTEM_CONSOLE_ID, defaultGlobalSettings } from "@/lib/types";
import type { StoreApi } from "zustand";
import type { LlamaStore } from "@/stores/types";
import { SystemSlice } from "./system-slice-types";
import { createSystemMainSlice } from "./system-slice-main";

export type { SystemSlice } from "./system-slice-types";

export function createSystemSlice(
  set: StoreApi<LlamaStore>["setState"],
  get: StoreApi<LlamaStore>["getState"],
): SystemSlice {
  const main = createSystemMainSlice(set, get);

  return {
    tauriReady: false,
    systemCapabilities: {
      gpu_name: "",
      gpu_vram_gb: 0,
      gpu_vendor: "none",
      ram_gb: 0,
      cpu_name: "",
      cpu_cores: 0,
      has_cuda: false,
      has_vulkan: false,
      has_metal: false,
      has_rocm: false,
      disk_free_gb: 0,
      os_name: "",
    },
    appStatus: "active",
    lastActivityAt: nowTs(),
    hibernatedInstanceIds: [],
    metrics: seedMetrics(),
    ...main,
  };
}
