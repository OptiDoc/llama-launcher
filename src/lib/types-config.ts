/**
 * Config types — AppConfig, Theme.
 */

export type Theme = "light" | "dark" | "system";

export interface AppConfig {
  llama_binary_path: string | null;
  models_directory: string;
  default_context_size: number;
  default_gpu_layers: number;
  default_threads: number;
  default_batch_size: number;
  ubatch_size: number;
  flash_attn: boolean;
  no_mmap: boolean;
  no_mlock: boolean;
  numa: boolean;
  auto_start_server: boolean;
  server_port: number;
  enable_gpu: boolean;
  gpu_device: number | null;
  enable_metal: boolean;
  enable_cuda: boolean;
  enable_vulkan: boolean;
  enable_opencl: boolean;
  log_level: string;
  telemetry_enabled: boolean;
  check_updates: boolean;
  minimize_to_tray: boolean;
  start_minimized: boolean;
  theme: Theme;
  language: string;
}

export interface GlobalSettings {
  hibernate_after_sec: number;
  default_gpu_layers: number;
  default_threads: number;
  auto_calibrate: boolean;
  max_concurrent_instances: number;
  modelsDir: string;
  llamaCppPath?: string;
  cudaLibsDir?: string;
  defaultHost?: string;
  portRangeStart?: number;
  portRangeEnd?: number;
  checkForReleases?: boolean;
  releaseChannel?: string;
  notifyOnNewRelease?: boolean;
  notifyOnCrash?: boolean;
  notifyOnHighMemory?: boolean;
}

export const defaultGlobalSettings: GlobalSettings = {
  hibernate_after_sec: 0,
  default_gpu_layers: 99,
  default_threads: 8,
  auto_calibrate: true,
  max_concurrent_instances: 4,
  modelsDir: "",
};
