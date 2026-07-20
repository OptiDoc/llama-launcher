/**
 * Notification messages for UI.
 */

export const NOTIF_MESSAGES = {
  modelDownloadStart: (modelName: string, quant: string, sizeGb: number) => ({
    title: "Downloading model",
    body: `${modelName} ${quant} - ${sizeGb.toFixed(1)} GB`,
  }),
  modelDownloadComplete: (modelName: string, quant: string) => ({
    title: "Model downloaded",
    body: `${modelName} ${quant} is ready to use.`,
  }),
  modelDownloadFailed: (modelName: string, reason: string) => ({
    title: "Download failed",
    body: `${modelName}: ${reason}`,
  }),
  modelImported: (modelName: string) => ({
    title: "Model imported",
    body: `${modelName} is ready to use.`,
  }),
  releaseDownloadStart: (tag: string, variant: string, sizeMb: number) => ({
    title: "Downloading release",
    body: `llama.cpp ${tag} (${variant}) - ${sizeMb} MB`,
  }),
  releaseInstalled: (tag: string, variant: string) => ({
    title: "Release installed",
    body: `llama.cpp ${tag} (${variant}) is ready.`,
  }),
  hibernationStarted: (count: number, seconds: number) => ({
    title: "Hibernation started",
    body: `${count} model(s) unloaded from VRAM after ${seconds}s idle.`,
  }),
  newReleaseAvailable: (tag: string, notes: string) => ({
    title: "New llama.cpp release available",
    body: `${tag} — ${notes.slice(0, 100)}…`,
  }),
};
