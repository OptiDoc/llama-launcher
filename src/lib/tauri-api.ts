/**
 * Tauri API bridge.
 *
 * Wraps every Rust command exposed in `src-tauri/src/commands.rs` so the
 * frontend can call them with typed signatures. When running outside Tauri
 * (plain browser / Next.js dev server), every call resolves to `null`/empty
 * so the UI can render honest empty states instead of fake data.
 *
 * Detection: Tauri 2 with `withGlobalTauri: true` exposes `window.__TAURI_INTERNALS__`
 * and `window.__TAURI__`. We check both for robustness.
 */

// ---------- Tauri type mirrors (from src-tauri/src/core.rs) ----------

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
  size: number; // bytes
  format: ModelFormat;
  architecture: string | null;
  quantization: string | null;
  context_size: number | null;
  parameter_count: string | null;
  modified: number; // unix seconds
  metadata: ModelMetadata;
  checksum: string | null;
}

export interface ProcessConfig {
  context_size: number;
  gpu_layers: number;
  threads: number;
  batch_size: number;
  ubatch_size: number;
  flash_attn: boolean;
  no_mmap: boolean;
  no_mlock: boolean;
  numa: boolean;
  arguments: string[];
}

export interface ProcessInfo {
  id: string;
  model_id: string;
  pid: number | null;
  port: number;
  status: ProcessStatus;
  started_at: number; // unix seconds
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
  memory_total_mb: number;
  memory_used_mb: number;
  memory_available_mb: number;
}

export interface GpuInfo {
  index: number;
  name: string;
  vendor: GpuVendor;
  memory_total_mb: number;
  memory_used_mb: number;
  temperature_c: number | null;
  utilization_percent: number | null;
  compute_capability: string | null;
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

export interface BenchmarkConfig {
  prompt: string;
  n_predict: number;
  n_threads: number;
  n_gpu_layers: number;
  batch_size: number;
  context_size: number;
  runs: number;
  warmup_runs: number;
}

export interface BenchmarkMetrics {
  avg_tokens_per_sec: number;
  min_tokens_per_sec: number;
  max_tokens_per_sec: number;
  avg_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  memory_used_mb: number;
  gpu_memory_used_mb: number;
  power_watts: number | null;
}

export interface BenchmarkResult {
  id: string;
  model_id: string;
  timestamp: number;
  config: BenchmarkConfig;
  results: BenchmarkMetrics;
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

/** True when running inside a Tauri webview (production desktop app). */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__?.core?.invoke);
}

/**
 * Invoke a Tauri command. Returns `null` when not running in Tauri so callers
 * can render empty states. Never throws in browser mode — the error is logged.
 */
async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauri()) {
    return null;
  }
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

  // --- Models ---
  scanModels: () => invoke<ModelInfo[]>("scan_models"),
  getModelInfo: (id: string) => invoke<ModelInfo | null>("get_model_info", { id }),
  deleteModel: (id: string) => invoke<null>("delete_model", { id }),
  verifyModel: (id: string) => invoke<VerificationResult>("verify_model", { id }),
  /**
   * Download a model from HuggingFace. `onProgress` is called on every chunk.
   * Uses the Tauri Channel API to stream progress from Rust.
   */
  downloadModel: async (
    repo: string,
    file: string,
    onProgress?: (p: DownloadProgress) => void,
  ): Promise<ModelInfo | null> => {
    if (!isTauri()) return null;
    try {
      const fn = window.__TAURI__?.core?.invoke;
      if (!fn) return null;
      // Tauri 2 Channel — created via @tauri-apps/api/core
      const { Channel } = await import("@tauri-apps/api/core");
      const channel = new Channel<DownloadProgress>();
      if (onProgress) channel.onmessage = onProgress;
      return (await fn("download_model", { repo, file, progressTx: channel })) as ModelInfo;
    } catch (err) {
      console.error("[tauri] download_model failed:", err);
      return null;
    }
  },

  // --- Processes ---
  startModel: (modelId: string, config?: Partial<ProcessConfig>) =>
    invoke<ProcessInfo>("start_model", { modelId, config: config ?? null }),
  stopModel: (id: string) => invoke<null>("stop_model", { id }),
  restartModel: (id: string) => invoke<ProcessInfo>("restart_model", { id }),
  getProcessStatus: (id: string) => invoke<ProcessInfo | null>("get_process_status", { id }),
  listProcesses: () => invoke<ProcessInfo[]>("list_processes"),
  getProcessMetrics: (id: string) => invoke<ProcessMetrics | null>("get_process_metrics", { id }),

  // --- System ---
  getSystemInfo: () => invoke<SystemSnapshot>("get_system_info"),
  getGpuInfo: () => invoke<GpuInfo[]>("get_gpu_info"),
  detectLlamaBinary: () => invoke<string | null>("detect_llama_binary"),

  // --- Config ---
  getConfig: () => invoke<AppConfig>("get_config"),
  updateConfig: (config: AppConfig) => invoke<null>("update_config", { config }),

  // --- Benchmark ---
  runBenchmark: (modelId: string, config: BenchmarkConfig) =>
    invoke<BenchmarkResult>("run_benchmark", { modelId, config }),

  // --- File / dialog ---
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
