/**
 * Instances slice — basic methods.
 */

import { SYSTEM_CONSOLE_ID } from "@/lib/types";
import type { StoreApi } from "zustand";
import type { LlamaStore } from "@/stores/types";
import type { InstancesSlice } from "./instances-slice-types";

export function createInstancesBasicSlice(
  set: StoreApi<LlamaStore>["setState"],
  get: StoreApi<LlamaStore>["getState"],
): Pick<InstancesSlice, "setNavigate" | "setActiveConsole" | "toggleConsole" | "setConsoleOpen" | "setConsoleHeight" | "clearConsole" | "appendLog"> {
  return {
    setNavigate: (fn) => set({ _navigate: fn }),
    setActiveConsole: (id) => set({ activeConsoleId: id }),
    toggleConsole: () => set((s) => ({ consoleOpen: !s.consoleOpen })),
    setConsoleOpen: (open) => set({ consoleOpen: open }),
    setConsoleHeight: (h) => set({ consoleHeight: h }),
    clearConsole: (id) => set((s) => ({ logs: { ...s.logs, [id]: [] } })),
    appendLog: (line) => set((s) => {
      const key = line.instanceId ?? SYSTEM_CONSOLE_ID;
      return { logs: { ...s.logs, [key]: [...(s.logs[key] ?? []), line] } };
    }),
  };
}
