/**
 * Tauri API bridge — typed wrappers for every Rust command in the backend.
 *
 * When running outside Tauri (plain browser), every call returns null/empty
 * so the UI can render honest empty states. No fake data is ever injected.
 */

// ---------- Backend type mirrors ----------

export type ModelFormat = "gguf" | "ggml" | "pytorch" | "safetensors" | "onnx" | "tensorrt" | "other";
export type ProcessStatus = "starting" | "running" | "stopping" | "stopped" | "crashed" | "error";
export type GpuVendor = "nvidia" | "amd" | "intel" | "apple" | "other";
export type Theme = "light" | "dark" | "system";

export interface ModelMetadata {
  description: string | null;
  author: string | null;
  license: string | null;
  tags: string[];
  model_card: string | null;
  downloads: number | null;
  likes: number | null;
}

export interface ModelInfo {
  id: string;
  name: string;
  path: string;
  size: number;
  format: ModelFormat;
  architecture: string | null;
  quantization: string | null;
  context_size: number | null;
  parameter_count: string | null;
  modified: number;
  metadata: ModelMetadata;
  checksum: string | null;
}

export interface ProcessConfig {
  // Core
  context_size: number;
  gpu_layers: number;
  threads: number;
  batch_size: number;
  ubatch_size: number;
  flash_attn: boolean;
  no_mmap: boolean;
  no_mlock: boolean;
  numa: boolean;
  // Server
  port: number;
  host: string;
  parallel: number;
  cont_batching: boolean;
  n_predict: number;
  timeout: number;
  metrics: boolean;
  api_key: string;
  // Performance
  threads_batch: number;
  cache_type_k: string;
  cache_type_v: string;
  split_mode: string;
  tensor_split: string;
  main_gpu: number;
  kv_offload: boolean;
  fit: boolean;
  // Sampling
  temperature: number;
  top_k: number;
  top_p: number;
  min_p: number;
  repeat_penalty: number;
  repeat_last_n: number;
  presence_penalty: number;
  frequency_penalty: number;
  seed: number;
  // Advanced
  lora: string;
  mmproj: string;
  jinja: boolean;
  reasoning_format: string;
  reasoning_budget: number;
  chat_template: string;
  rope_scaling: string;
  rope_scale: number;
  rope_freq_base: number;
  rope_freq_scale: number;
  grammar: string;
  json_schema: string;
  log_level: number;
  arguments: string[];
}

export interface ProcessInfo {
  id: string;
  model_id: string;
  pid: number | null;
  port: number;
  status: ProcessStatus;
  started_at: number;
  gpu_memory: number;
  cpu_memory: number;
  tokens_per_sec: number;
  context_used: number;
}

export interface ProcessMetrics {
  cpu_percent: number;
  cpu_memory_mb: number;
  gpu_memory_mb: number;
  tokens_per_sec: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  avg_latency_ms: number;
  context_used: number;
  kv_cache_mb: number;
  last_update: number;
}

export interface SystemSnapshot {
  cpu_percent: number;
  cpu_name: string;
  cpu_cores_physical: number;
  cpu_cores_logical: number;
  memory_total_mb: number;
  memory_used_mb: number;
  memory_available_mb: number;
  disk_total_gb: number;
  disk_used_gb: number;
  disk_free_gb: number;
  os_name: string;
  os_version: string;
}

export interface GpuInfo {
  index: number;
  name: string;
  vendor: GpuVendor;
  memory_total_mb: number;
  memory_used_mb: number;
  memory_free_mb: number;
  temperature_c: number | null;
  utilization_percent: number | null;
  compute_capability: string | null;
  driver_version: string | null;
}

export interface SystemCapabilities {
  gpu_name: string;
  gpu_vram_gb: number;
  gpu_vendor: string;
  ram_gb: number;
  cpu_name: string;
  cpu_cores: number;
  has_cuda: boolean;
  has_vulkan: boolean;
  has_metal: boolean;
  has_rocm: boolean;
  disk_free_gb: number;
  os_name: string;
}

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

export interface VerificationResult {
  valid: boolean;
  checksum_match: boolean;
  size_match: boolean;
  format_valid: boolean;
  error: string | null;
}

export interface DownloadProgress {
  total: number;
  downloaded: number;
  speed: number;
}

export interface Workspace {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

export interface WorkspaceSettings {
  hibernate_after_sec: number;
  default_gpu_layers: number;
  default_threads: number;
  auto_calibrate: boolean;
  max_concurrent_instances: number;
}

export interface ReleaseVariant {
  id: string;
  label: string;
  priority: boolean;
  note: string;
}

export interface GitHubRelease {
  id: string;
  tag: string;
  published_at: string;
  commit: string;
  notes: string;
  installed: boolean;
  variant: string;
  priority: boolean;
  download_url: string;
  size_mb: number;
}

// ---------- Tauri detection ----------

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: {
      core?: {
        invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
      };
    };
  }
}

export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__?.core?.invoke);
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauri()) return null;
  try {
    const fn = window.__TAURI__?.core?.invoke;
    if (!fn) return null;
    return (await fn(cmd, args)) as T;
  } catch (err) {
    console.error(`[tauri] ${cmd} failed:`, err);
    return null;
  }
}

// ---------- Typed command wrappers ----------

export const tauri = {
  isTauri,

  // Models
  scanModels: () => invoke<ModelInfo[]>("scan_models"),
  getModelInfo: (id: string) => invoke<ModelInfo | null>("get_model_info", { id }),
  deleteModel: (id: string) => invoke<null>("delete_model", { id }),
  verifyModel: (id: string) => invoke<VerificationResult>("verify_model", { id }),
  downloadModel: async (
    repo: string,
    file: string,
    onProgress?: (p: DownloadProgress) => void,
  ): Promise<ModelInfo | null> => {
    if (!isTauri()) return null;
    try {
      const fn = window.__TAURI__?.core?.invoke;
      if (!fn) return null;
      const { Channel } = await import("@tauri-apps/api/core");
      const channel = new Channel<DownloadProgress>();
      if (onProgress) channel.onmessage = onProgress;
      return (await fn("download_model", { repo, file, progressTx: channel })) as ModelInfo;
    } catch (err) {
      console.error("[tauri] download_model failed:", err);
      return null;
    }
  },

  // Processes
  startModel: (modelId: string, config?: Partial<ProcessConfig>) =>
    invoke<ProcessInfo>("start_model", { modelId, config: config ?? null }),
  stopModel: (id: string) => invoke<null>("stop_model", { id }),
  restartModel: (id: string) => invoke<ProcessInfo>("restart_model", { id }),
  getProcessStatus: (id: string) => invoke<ProcessInfo | null>("get_process_status", { id }),
  listProcesses: () => invoke<ProcessInfo[]>("list_processes"),
  getProcessMetrics: (id: string) => invoke<ProcessMetrics | null>("get_process_metrics", { id }),
  getProcessStdout: (id: string, lines?: number) =>
    invoke<string[]>("get_process_stdout", { id, lines: lines ?? 200 }),

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
  updateWorkspace: (
    id: string,
    name?: string,
    color?: string,
    description?: string | null,
  ) => invoke<null>("update_workspace", { id, name, color, description }),
  deleteWorkspace: (id: string) => invoke<null>("delete_workspace", { id }),
  getActiveWorkspace: () => invoke<string>("get_active_workspace"),
  setActiveWorkspace: (id: string) => invoke<null>("set_active_workspace", { id }),
  getWorkspaceSettings: (workspaceId: string) =>
    invoke<WorkspaceSettings>("get_workspace_settings", { workspaceId }),
  updateWorkspaceSettings: (workspaceId: string, settings: WorkspaceSettings) =>
    invoke<null>("update_workspace_settings", { workspaceId, settings }),

  // Releases
  listReleaseVariants: () => invoke<ReleaseVariant[]>("list_release_variants"),
  listGithubReleases: () => invoke<GitHubRelease[]>("list_github_releases"),

  // File / dialog
  openModelFolder: () => invoke<null>("open_model_folder"),
  selectModelFile: () => invoke<string | null>("select_model_file"),
};

// ---------- Formatting helpers ----------

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export function formatUptime(startedAtSec: number): string {
  if (!startedAtSec) return "--";
  const sec = Math.floor(Date.now() / 1000 - startedAtSec);
  if (sec < 0) return "--";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
