/**
 * Notification messages for UI.
 */

export const NOTIF_MESSAGES = {
  modelDownloadStart: (modelName: string, quant: string, sizeGb: number) => ({
    kind: "download" as const,
    title: "Downloading model",
    body: `${modelName} ${quant} - ${sizeGb.toFixed(1)} GB`,
  }),
  modelDownloadComplete: (modelName: string, quant: string) => ({
    kind: "download" as const,
    title: "Model downloaded",
    body: `${modelName} ${quant} is ready to use.`,
  }),
  modelDownloadFailed: (modelName: string, reason: string) => ({
    kind: "error" as const,
    title: "Download failed",
    body: `${modelName}: ${reason}`,
  }),
  modelImported: (modelName: string) => ({
    kind: "success" as const,
    title: "Model imported",
    body: `${modelName} is ready to use.`,
  }),
  releaseDownloadStart: (tag: string, variant: string, sizeMb: number) => ({
    kind: "download" as const,
    title: "Downloading release",
    body: `llama.cpp ${tag} (${variant}) - ${sizeMb} MB`,
  }),
  releaseInstalled: (tag: string, variant: string) => ({
    kind: "download" as const,
    title: "Release installed",
    body: `llama.cpp ${tag} (${variant}) is ready.`,
  }),
  hibernationStarted: (count: number, seconds: number) => ({
    kind: "warning" as const,
    title: "Hibernation started",
    body: `${count} model(s) unloaded from VRAM after ${seconds}s idle.`,
  }),
  newReleaseAvailable: (tag: string, notes: string) => ({
    kind: "release" as const,
    title: "New llama.cpp release available",
    body: `${tag} — ${notes.slice(0, 100)}…`,
    actionLabel: "Install",
  }),
  processStarted: (name: string) => ({
    kind: "info" as const,
    title: "Process started",
    body: `${name} is running.`,
  }),
  processStopped: (name: string) => ({
    kind: "info" as const,
    title: "Process stopped",
    body: `${name} has been stopped.`,
  }),
  processFailed: (name: string, reason: string) => ({
    kind: "error" as const,
    title: "Process failed",
    body: `${name}: ${reason}`,
  }),
  workspaceSwitched: (name: string) => ({
    kind: "info" as const,
    title: "Workspace switched",
    body: `Switched to "${name}".`,
  }),
  configUpdated: (section: string) => ({
    kind: "success" as const,
    title: "Settings updated",
    body: `${section} settings have been saved.`,
  }),
  systemError: (message: string) => ({
    kind: "error" as const,
    title: "System error",
    body: message,
  }),
};
