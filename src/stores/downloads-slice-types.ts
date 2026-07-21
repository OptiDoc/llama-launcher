/**
 * Downloads slice types.
 */

import type { HFDownload, LlamaModel, LlamaRelease } from "@/lib/types";

export interface DownloadsSlice {
  downloads: HFDownload[];
  startHFDownload: (config: { repo: string; quant: string; modelName: string; builder: string }) => string;
  startReleaseDownload: (releaseId: string) => string;
  cancelDownload: (dlId: string) => Promise<void>;
  retryDownload: (dlId: string) => Promise<void>;
}

function patchDownload(st: { downloads: HFDownload[] }, dlId: string, patch: Partial<HFDownload>) {
  return st.downloads.map((d) => (d.id === dlId ? { ...d, ...patch } : d));
}

function patchModel(st: { models: LlamaModel[] }, modelId: string, patch: Partial<LlamaModel>) {
  return st.models.map((m) => (m.id === modelId ? { ...m, ...patch } : m));
}

function patchRelease(st: { releases: LlamaRelease[] }, releaseId: string, patch: Partial<LlamaRelease>) {
  return st.releases.map((r) => (r.id === releaseId ? { ...r, ...patch } : r));
}

export { patchDownload, patchModel, patchRelease };
