/**
 * Tauri command wrappers — typed API for all backend commands.
 */

import { invoke, invokeWithChannel, isTauri } from "./invoke";
import type { LogEntry } from "./logger";
import type {
  ModelInfo,
  ProcessConfig,
  ProcessInfo,
  ProcessMetrics,
  SystemSnapshot,
  GpuInfo,
  SystemCapabilities,
  AppConfig,
  VerificationResult,
  DownloadProgress,
  Workspace,
  WorkspaceSettings,
  ReleaseVariant,
  GitHubRelease,
  ExternalModelDir,
} from "./types";

export const tauri = {
  isTauri,

  // Models
  scanModels: () => invoke<ModelInfo[]>("scan_models"),
  getModelInfo: (id: string) => invoke<ModelInfo | null>("get_model_info", { id }),
  deleteModel: (id: string) => invoke<null>("delete_model", { id }),
  verifyModel: (id: string) => invoke<VerificationResult>("verify_model", { id }),

  downloadModel: (repo: string, file: string, dlId: string, onProgress?: (p: DownloadProgress) => void) =>
    invokeWithChannel<ModelInfo>("download_model", { repo, file, dlId }, onProgress),

  // Processes
  startModel: (modelId: string, config?: Partial<ProcessConfig>) =>
    invoke<ProcessInfo>("start_model", { modelId, config: config ?? null }),
  stopModel: (id: string) => invoke<null>("stop_model", { id }),
  restartModel: (id: string) => invoke<ProcessInfo>("restart_model", { id }),
  getProcessStatus: (id: string) => invoke<ProcessInfo | null>("get_process_status", { id }),
  listProcesses: () => invoke<ProcessInfo[]>("list_processes"),
  getProcessMetrics: (id: string) => invoke<ProcessMetrics | null>("get_process_metrics", { id }),
  getProcessStdout: (id: string, lines?: number) => invoke<string[]>("get_process_stdout", { id, lines: lines ?? 200 }),

  // System
  getSystemInfo: () => invoke<SystemSnapshot>("get_system_info"),
  getGpuInfo: () => invoke<GpuInfo[]>("get_gpu_info"),
  getSystemCapabilities: () => invoke<SystemCapabilities>("get_system_capabilities"),
  detectLlamaBinary: () => invoke<string | null>("detect_llama_binary"),

  // Config
  getConfig: () => invoke<AppConfig>("get_config"),
  updateConfig: (config: AppConfig) => invoke<null>("update_config", { config }),

  // Workspaces
  listWorkspaces: () => invoke<Workspace[]>("list_workspaces"),
  createWorkspace: (name: string, color: string, description: string | null) =>
    invoke<Workspace>("create_workspace", { name, color, description }),
  updateWorkspace: (id: string, name?: string, color?: string, description?: string | null) =>
    invoke<null>("update_workspace", { id, name, color, description }),
  deleteWorkspace: (id: string) => invoke<null>("delete_workspace", { id }),
  getActiveWorkspace: () => invoke<string>("get_active_workspace"),
  setActiveWorkspace: (id: string) => invoke<null>("set_active_workspace", { id }),
  getWorkspaceSettings: (workspaceId: string) => invoke<WorkspaceSettings>("get_workspace_settings", { workspaceId }),
  updateWorkspaceSettings: (workspaceId: string, settings: WorkspaceSettings) =>
    invoke<null>("update_workspace_settings", { workspaceId, settings }),

  // Releases
  listReleaseVariants: () => invoke<ReleaseVariant[]>("list_release_variants"),
  listGithubReleases: () => invoke<GitHubRelease[]>("list_github_releases"),

  // Logs
  writeFrontendLog: (entry: LogEntry) => invoke<null>("write_frontend_log", { entry }),

  // File / dialog
  openModelFolder: () => invoke<null>("open_model_folder"),
  selectModelFile: () => invoke<string | null>("select_model_file"),
  selectModelFiles: async () => (await invoke<string[]>("select_model_files", {})) ?? [],
  importModelFile: async () => {
    const path = await invoke<string | null>("select_model_file");
    if (!path) return null;
    const models = await invoke<ModelInfo[]>("scan_models");
    return models?.find((m) => m.path === path) ?? null;
  },
  importModelFiles: async (filePaths: string[], destDir: string, moveFiles: boolean) =>
    (await invoke<string[]>("import_model_files", { filePaths, destDir, moveFiles })) ?? [],
  selectDirectory: () => invoke<string | null>("select_directory"),

  // Release management
  installRelease: (tag: string, variant: string, dlId: string, onProgress?: (p: DownloadProgress) => void) =>
    invokeWithChannel<string>("install_release", { tag, variant, dlId }, onProgress),
  extractZip: (zipPath: string, destDir: string, onProgress?: (p: DownloadProgress) => void) =>
    invokeWithChannel<string>("extract_zip", { zipPath, destDir }, onProgress),
  downloadCudaLibs: (
    tag: string,
    variant: string,
    destDir: string,
    dlId: string,
    onProgress?: (p: DownloadProgress) => void,
  ) => invokeWithChannel<string>("download_cuda_libs", { tag, variant, destDir, dlId }, onProgress),

  // App directory
  ensureAppDir: () => invoke<string>("ensure_app_dir"),

  // Generic file download
  downloadFile: (url: string, dest: string, dlId: string, onProgress?: (p: DownloadProgress) => void) =>
    invokeWithChannel<string>("download_file", { url, dest, dlId }, onProgress),

  // External models
  scanExternalModels: async () => (await invoke<ExternalModelDir[]>("scan_external_models", {})) ?? [],
  syncExternalModels: async (dirs: ExternalModelDir[]) => (await invoke<number>("sync_external_models", { dirs })) ?? 0,
  importExternalModel: (filePath: string, destDir: string) =>
    invoke<string | null>("import_external_model", { filePath, destDir }),

  // Cancel downloads
  cancelDownload: async (dlId: string): Promise<boolean> => {
    const result = await invoke<undefined>("cancel_download", { dlId });
    return result === undefined;
  },
};
