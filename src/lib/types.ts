/**
 * Tauri API types — re-exports from domain-specific type files.
 */

export * from "./types-model";
export * from "./types-process";
export * from "./types-system";
export * from "./types-config";
export * from "./types-verification";
export * from "./types-download";
export * from "./types-workspace";
export * from "./types-release";
export * from "./types-external";

// Re-export for compatibility
export type { LlamaInstance, InstanceStatus, ConsoleLine, LogKind, InstancesSlice } from "./types-process";
export type { GlobalSettings } from "./types-config";
export type { AppStatus, MetricSample } from "./types-system";
export type {
  HFDownload,
  LlamaRelease,
  AppNotification,
  NotificationKind,
  NotificationEvent,
  NotificationSource,
} from "./types-download";
export type { LlamaProfile, ProfileScope, ViewMode } from "./types-workspace";
export { SYSTEM_CONSOLE_ID, defaultWorkspaceSettings } from "./types-workspace";
export { defaultGlobalSettings } from "./types-config";
