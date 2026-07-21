/**
 * Instances slice — main entry point.
 */

import { isTauri } from "@/lib/tauri-api";
import { nowTs } from "@/lib/helpers";
import { SYSTEM_CONSOLE_ID } from "@/lib/types";
import type { StoreApi } from "zustand";
import type { LlamaStore } from "@/stores/types";
import { InstancesSlice } from "./instances-slice-types";
import { createInstancesBasicSlice } from "./instances-slice-basic";
import { createStartInstanceSlice } from "./instances-slice-start";
import { createInstancesMainSlice } from "./instances-slice-main";

export type { InstancesSlice } from "./instances-slice-types";

export function createInstancesSlice(
  set: StoreApi<LlamaStore>["setState"],
  get: StoreApi<LlamaStore>["getState"],
): InstancesSlice {
  const basic = createInstancesBasicSlice(set, get);
  const start = createStartInstanceSlice(set, get);
  const main = createInstancesMainSlice(set, get);

  return {
    instances: [],
    logs: {},
    activeConsoleId: SYSTEM_CONSOLE_ID,
    consoleOpen: false,
    consoleHeight: 240,
    _navigate: null,
    ...basic,
    ...start,
    ...main,
  };
}
