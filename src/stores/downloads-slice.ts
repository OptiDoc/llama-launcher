/**
 * Downloads slice — main entry point.
 */

import type { StoreApi } from "zustand";
import type { LlamaStore } from "@/stores/types";
import { DownloadsSlice, patchDownload, patchModel, patchRelease } from "./downloads-slice-types";
import { createCancelDownloadSlice } from "./downloads-slice-cancel";
import { createStartHFDownloadSlice } from "./downloads-slice-start";
import { createStartReleaseDownloadSlice } from "./downloads-slice-release";

export type { DownloadsSlice } from "./downloads-slice-types";
export { patchDownload, patchModel, patchRelease } from "./downloads-slice-types";

export function createDownloadsSlice(
  set: StoreApi<LlamaStore>["setState"],
  get: StoreApi<LlamaStore>["getState"],
): DownloadsSlice {
  const cancelAndRetry = createCancelDownloadSlice(set, get);
  const startHF = createStartHFDownloadSlice(set, get);
  const startRelease = createStartReleaseDownloadSlice(set, get);

  return {
    downloads: [],
    ...startHF,
    ...startRelease,
    ...cancelAndRetry,
  };
}
