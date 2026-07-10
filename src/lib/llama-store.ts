/**
 * LlamaLauncher state store + simulator.
 *
 * Client-side simulation of llama.cpp server instances. Each instance is a
 * llama-server process that streams realistic startup logs to its own console
 * buffer.
 *
 * Features:
 * - Workspaces (isolated environments with own instances/profiles/releases)
 * - App status / hibernation (auto-unload models after idle period,
 *   hot-reload on next request) — hibernate delay is configurable
 * - Profiles with scope: 'global' | 'model' (for sharing + auto-calibration)
 * - HuggingFace model download (search-first, quantization picker)
 * - llama.cpp release variants (cuda12 / cuda13 / vulkan / cpu / …)
 * - Notifications (new GitHub release, download complete, …)
 * - Real-time system metrics stream (CPU/RAM/GPU/tok/s) for the dashboard
 * - Model metadata: builder, architecture, license, edit/delete/missing
 */

import { create } from "zustand";

// ---------- Types ----------

export type InstanceStatus = "stopped" | "starting" | "running" | "stopping" | "error";
export type AppStatus = "active" | "idle" | "hibernating" | "waking";
export type LogKind = "info" | "success" | "warn" | "error" | "debug";
export type ViewMode = "grid" | "table";
export type ReleaseVariant = "cuda12" | "cuda13" | "vulkan" | "cpu" | "hip" | "opencl" | "metal";

export interface ConsoleLine {
  id: string;
  instanceId: string;
  ts: number;
  kind: LogKind;
  text: string;
}

export interface LlamaInstance {
  id: string;
  name: string;
  model: string;
  profile: string;
  port: number;
  host: string;
  status: InstanceStatus;
  gpu: string;
  ctxSize: number;
  threads: number;
  color: "green" | "orange" | "blue" | "pink" | "purple";
  startedAt?: number;
  uptimeSec?: number;
  promptTokens: number;
  generatedTokens: number;
  requestsPerMin: number;
  tokensPerSec: number;
  memoryMb: number;
  peakTokensPerSec: number;
  totalRequests: number;
  errorCount: number;
  workspaceId: string;
  hibernatedConfig?: { name: string; model: string; profile: string; port: number; host: string; gpu: string };
}

export interface LlamaModel {
  id: string;
  name: string;
  family: string;
  sizeGb: number;
  quant: string;
  downloaded: boolean;
  path: string;
  hfRepo?: string;
  /** who built/quantized the model (bartowski, unsloth, TheBloke, …) */
  builder: string;
  /** GGUF metadata */
  architecture: string;
  contextLength: number;
  parameterCount: string; // "7B", "8B", "13B"
  quantizationBits: number;
  license: string;
  description: string;
  uploadedAt: string;
  hfDownloads: number;
  tags: string[];
  /** Mixture-of-Experts architecture (Mixtral, DeepSeek MoE, Qwen MoE, …) */
  isMoe: boolean;
  /** active expert count, when isMoe (e.g. 8 for 8x7B) */
  expertCount?: number;
  /** file is missing on disk (moved/deleted) — card shows greyed + "not found" */
  missing: boolean;
  workspaceId: string;
  addedAt: number;
  /** actively downloading — card/row shows an inline fill bar instead of a separate panel */
  downloading?: boolean;
  /** 0..100, only when downloading === true */
  downloadProgress?: number;
}

export type ProfileScope = "global" | "model";

export interface LlamaProfile {
  id: string;
  name: string;
  description: string;
  ctxSize: number;
  threads: number;
  gpuLayers: number;
  flashAttention: boolean;
  extraArgs: string;
  scope: ProfileScope;
  modelId?: string;
  shared?: boolean;
  shareId?: string;
  calibrationScore?: number;
  workspaceId: string | null; // null = available in all workspaces
}

export interface LlamaRelease {
  id: string;
  tag: string;
  publishedAt: string;
  commit: string;
  notes: string;
  installed: boolean;
  variant: ReleaseVariant;
  /** priority variants are shown first (cuda12, cuda13, vulkan); others hidden behind "show more" */
  priority: boolean;
  downloadUrl: string;
  sizeMb: number;
  workspaceId: string | null;
  installing?: boolean;
  installProgress?: number;
}

export interface Workspace {
  id: string;
  name: string;
  color: "green" | "orange" | "blue" | "pink" | "purple";
  description?: string;
}

export interface HFDownload {
  id: string;
  repo: string;
  quant: string;
  filename: string;
  sizeGb: number;
  progress: number; // 0..100
  status: "queued" | "downloading" | "completed" | "failed";
  startedAt: number;
  modelName: string;
  builder: string;
  kind: "model" | "release" | "cuda";
  /** release variant, when kind === 'release' */
  variant?: ReleaseVariant;
}

export interface MetricSample {
  t: number;
  cpu: number;
  ram: number;
  gpu: number;
  gpuMem: number;
  tps: number;
  reqPerMin: number;
}

export type NotificationKind = "release" | "download" | "info" | "warn" | "error";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  ts: number;
  read: boolean;
  actionLabel?: string;
}

export interface GlobalSettings {
  llamaCppPath: string;
  modelsDir: string;
  cudaLibsDir: string;
  defaultHost: string;
  portRangeStart: number;
  portRangeEnd: number;
  notifyOnCrash: boolean;
  notifyOnHighMemory: boolean;
  notifyOnNewRelease: boolean;
  checkForReleases: boolean;
  releaseChannel: "stable" | "pre-release";
}

/** Detected system capabilities — used to warn when a model is too large */
export interface SystemCapabilities {
  gpuName: string;
  gpuVramGb: number; // total VRAM in GB
  ramGb: number; // total system RAM in GB
  cpuCores: number;
  hasCuda: boolean;
}

export interface WorkspaceSettings {
  hibernateAfterSec: number; // idle seconds before hibernation
  defaultGpuLayers: number;
  defaultThreads: number;
  autoCalibrate: boolean;
  maxConcurrentInstances: number;
}

// ---------- HF search catalog ----------

export interface HFSearchResult {
  repo: string;
  builder: string;
  family: string;
  baseSizeGb: number;
  parameterCount: string;
  description: string;
  architecture: string;
  contextLength: number;
  license: string;
  downloads: number;
  uploadedAt: string;
  tags: string[];
  isMoe: boolean;
  expertCount?: number;
}

// Curated catalog of ~24 GGUF repos across multiple builders
export const HF_CATALOG: HFSearchResult[] = [
  { repo: "bartowski/Llama-3.1-8B-Instruct-GGUF", builder: "bartowski", family: "llama3", baseSizeGb: 16.0, parameterCount: "8B", description: "Meta Llama 3.1 8B Instruct", architecture: "llama", contextLength: 131072, license: "Llama 3.1 Community", downloads: 184200, uploadedAt: "2024-07-23", tags: ["instruct", "chat", "meta"], isMoe: false },
  { repo: "unsloth/Llama-3.1-8B-Instruct-GGUF", builder: "unsloth", family: "llama3", baseSizeGb: 16.0, parameterCount: "8B", description: "Meta Llama 3.1 8B Instruct (unsloth)", architecture: "llama", contextLength: 131072, license: "Llama 3.1 Community", downloads: 98100, uploadedAt: "2024-07-24", tags: ["instruct", "chat", "meta", "unsloth"], isMoe: false },
  { repo: "bartowski/Qwen2.5-7B-Instruct-GGUF", builder: "bartowski", family: "qwen2", baseSizeGb: 14.5, parameterCount: "7B", description: "Qwen 2.5 7B Instruct", architecture: "qwen2", contextLength: 32768, license: "Apache 2.0", downloads: 142800, uploadedAt: "2024-09-19", tags: ["instruct", "chat", "qwen"], isMoe: false },
  { repo: "unsloth/Qwen2.5-7B-Instruct-GGUF", builder: "unsloth", family: "qwen2", baseSizeGb: 14.5, parameterCount: "7B", description: "Qwen 2.5 7B Instruct (unsloth)", architecture: "qwen2", contextLength: 32768, license: "Apache 2.0", downloads: 76400, uploadedAt: "2024-09-20", tags: ["instruct", "chat", "qwen", "unsloth"], isMoe: false },
  { repo: "bartowski/mistral-7b-instruct-v0.3-GGUF", builder: "bartowski", family: "mistral", baseSizeGb: 14.5, parameterCount: "7B", description: "Mistral 7B Instruct v0.3", architecture: "llama", contextLength: 32768, license: "Apache 2.0", downloads: 121000, uploadedAt: "2024-05-22", tags: ["instruct", "chat", "mistral"], isMoe: false },
  { repo: "TheBloke/Mistral-7B-Instruct-v0.2-GGUF", builder: "TheBloke", family: "mistral", baseSizeGb: 14.5, parameterCount: "7B", description: "Mistral 7B Instruct v0.2 (TheBloke)", architecture: "llama", contextLength: 32768, license: "Apache 2.0", downloads: 540000, uploadedAt: "2023-12-11", tags: ["instruct", "chat", "mistral", "legacy"], isMoe: false },
  { repo: "bartowski/Phi-3.1-mini-128k_instruct-GGUF", builder: "bartowski", family: "phi3", baseSizeGb: 7.5, parameterCount: "3.8B", description: "Microsoft Phi 3.1 Mini 128k Instruct", architecture: "phi3", contextLength: 131072, license: "MIT", downloads: 88200, uploadedAt: "2024-07-01", tags: ["instruct", "microsoft", "long-context"], isMoe: false },
  { repo: "bartowski/gemma-2-9b-it-GGUF", builder: "bartowski", family: "gemma2", baseSizeGb: 18.0, parameterCount: "9B", description: "Google Gemma 2 9B IT", architecture: "gemma2", contextLength: 8192, license: "Gemma", downloads: 95400, uploadedAt: "2024-06-27", tags: ["instruct", "google", "gemma"], isMoe: false },
  { repo: "bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF", builder: "bartowski", family: "deepseek", baseSizeGb: 14.5, parameterCount: "7B", description: "DeepSeek R1 Distill Qwen 7B", architecture: "qwen2", contextLength: 131072, license: "MIT", downloads: 67800, uploadedAt: "2025-01-20", tags: ["reasoning", "deepseek", "r1"], isMoe: false },
  { repo: "unsloth/DeepSeek-R1-Distill-Llama-8B-GGUF", builder: "unsloth", family: "deepseek", baseSizeGb: 16.0, parameterCount: "8B", description: "DeepSeek R1 Distill Llama 8B (unsloth)", architecture: "llama", contextLength: 131072, license: "MIT", downloads: 71200, uploadedAt: "2025-01-21", tags: ["reasoning", "deepseek", "r1", "unsloth"], isMoe: false },
  { repo: "bartowski/Mistral-Nemo-Instruct-2407-GGUF", builder: "bartowski", family: "mistral", baseSizeGb: 24.0, parameterCount: "12B", description: "Mistral Nemo 12B Instruct", architecture: "llama", contextLength: 131072, license: "Apache 2.0", downloads: 54300, uploadedAt: "2024-07-18", tags: ["instruct", "mistral", "long-context"], isMoe: false },
  { repo: "bartowski/Llama-3.3-70B-Instruct-GGUF", builder: "bartowski", family: "llama3", baseSizeGb: 140.0, parameterCount: "70B", description: "Meta Llama 3.3 70B Instruct", architecture: "llama", contextLength: 131072, license: "Llama 3.3 Community", downloads: 42100, uploadedAt: "2024-12-06", tags: ["instruct", "chat", "meta", "large"], isMoe: false },
  { repo: "unsloth/Llama-3.2-3B-Instruct-GGUF", builder: "unsloth", family: "llama3", baseSizeGb: 6.5, parameterCount: "3B", description: "Meta Llama 3.2 3B Instruct (unsloth)", architecture: "llama", contextLength: 131072, license: "Llama 3.2 Community", downloads: 89300, uploadedAt: "2024-09-25", tags: ["instruct", "small", "unsloth"], isMoe: false },
  { repo: "bartowski/Qwen2.5-Coder-14B-Instruct-GGUF", builder: "bartowski", family: "qwen2", baseSizeGb: 29.0, parameterCount: "14B", description: "Qwen 2.5 Coder 14B Instruct", architecture: "qwen2", contextLength: 32768, license: "Apache 2.0", downloads: 63900, uploadedAt: "2024-11-12", tags: ["coder", "code", "qwen"], isMoe: false },
  { repo: "bartowski/Qwen2.5-32B-Instruct-GGUF", builder: "bartowski", family: "qwen2", baseSizeGb: 64.0, parameterCount: "32B", description: "Qwen 2.5 32B Instruct", architecture: "qwen2", contextLength: 32768, license: "Qwen License", downloads: 38800, uploadedAt: "2024-09-25", tags: ["instruct", "chat", "large"], isMoe: false },
  { repo: "lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF", builder: "lmstudio-community", family: "llama3", baseSizeGb: 16.0, parameterCount: "8B", description: "Meta Llama 3.1 8B Instruct (LM Studio)", architecture: "llama", contextLength: 131072, license: "Llama 3.1 Community", downloads: 67500, uploadedAt: "2024-07-23", tags: ["instruct", "chat", "lmstudio"], isMoe: false },
  { repo: "bartowski/gemma-2-27b-it-GGUF", builder: "bartowski", family: "gemma2", baseSizeGb: 54.0, parameterCount: "27B", description: "Google Gemma 2 27B IT", architecture: "gemma2", contextLength: 8192, license: "Gemma", downloads: 47100, uploadedAt: "2024-06-27", tags: ["instruct", "google", "large"], isMoe: false },
  { repo: "MaziyarPanahi/Llama-3.1-8B-Instruct-GGUF", builder: "MaziyarPanahi", family: "llama3", baseSizeGb: 16.0, parameterCount: "8B", description: "Meta Llama 3.1 8B Instruct (MaziyarPanahi)", architecture: "llama", contextLength: 131072, license: "Llama 3.1 Community", downloads: 32900, uploadedAt: "2024-07-23", tags: ["instruct", "chat"], isMoe: false },
  { repo: "bartowski/Phi-3-medium-128k-instruct-GGUF", builder: "bartowski", family: "phi3", baseSizeGb: 28.0, parameterCount: "14B", description: "Microsoft Phi 3 Medium 128k Instruct", architecture: "phi3", contextLength: 131072, license: "MIT", downloads: 29400, uploadedAt: "2024-05-21", tags: ["instruct", "microsoft", "long-context"], isMoe: false },
  { repo: "bartowski/Llama-3-8B-Instruct-GGUF", builder: "bartowski", family: "llama3", baseSizeGb: 16.0, parameterCount: "8B", description: "Meta Llama 3 8B Instruct (legacy)", architecture: "llama", contextLength: 8192, license: "Llama 3 Community", downloads: 156000, uploadedAt: "2024-04-09", tags: ["instruct", "chat", "legacy"], isMoe: false },
  { repo: "TheBloke/Llama-2-7B-Chat-GGUF", builder: "TheBloke", family: "llama2", baseSizeGb: 13.0, parameterCount: "7B", description: "Llama 2 7B Chat (TheBloke)", architecture: "llama", contextLength: 4096, license: "Llama 2 Community", downloads: 980000, uploadedAt: "2023-07-18", tags: ["chat", "legacy", "llama2"], isMoe: false },
  { repo: "bartowski/Mistral-Small-24B-Instruct-2501-GGUF", builder: "bartowski", family: "mistral", baseSizeGb: 48.0, parameterCount: "24B", description: "Mistral Small 24B Instruct 2501", architecture: "llama", contextLength: 32768, license: "Apache 2.0", downloads: 18600, uploadedAt: "2025-01-15", tags: ["instruct", "mistral", "small"], isMoe: false },
  { repo: "unsloth/Mistral-Nemo-Instruct-2407-GGUF", builder: "unsloth", family: "mistral", baseSizeGb: 24.0, parameterCount: "12B", description: "Mistral Nemo 12B (unsloth)", architecture: "llama", contextLength: 131072, license: "Apache 2.0", downloads: 23100, uploadedAt: "2024-07-19", tags: ["instruct", "mistral", "unsloth"], isMoe: false },
  { repo: "bartowski/Hermes-3-Llama-3.1-8B-GGUF", builder: "bartowski", family: "llama3", baseSizeGb: 16.0, parameterCount: "8B", description: "Hermes 3 Llama 3.1 8B (Nous Research)", architecture: "llama", contextLength: 131072, license: "Llama 3.1 Community", downloads: 15800, uploadedAt: "2024-08-10", tags: ["hermes", "nous", "instruct"], isMoe: false },
  // --- Mixture-of-Experts models ---
  { repo: "bartowski/Mixtral-8x7B-Instruct-v0.1-GGUF", builder: "bartowski", family: "mixtral", baseSizeGb: 93.0, parameterCount: "46.7B", description: "Mixtral 8x7B Instruct v0.1 (MoE)", architecture: "llama", contextLength: 32768, license: "Apache 2.0", downloads: 87400, uploadedAt: "2023-12-13", tags: ["instruct", "chat", "moe", "large"], isMoe: true, expertCount: 8 },
  { repo: "bartowski/Mixtral-8x22B-Instruct-v0.1-GGUF", builder: "bartowski", family: "mixtral", baseSizeGb: 280.0, parameterCount: "141B", description: "Mixtral 8x22B Instruct v0.1 (MoE)", architecture: "llama", contextLength: 65536, license: "Apache 2.0", downloads: 31200, uploadedAt: "2024-04-10", tags: ["instruct", "chat", "moe", "large"], isMoe: true, expertCount: 8 },
  { repo: "bartowski/Qwen2-57B-A14B-Instruct-GGUF", builder: "bartowski", family: "qwen2", baseSizeGb: 114.0, parameterCount: "57B", description: "Qwen 2 57B-A14B Instruct (MoE, 14 active experts)", architecture: "qwen2", contextLength: 32768, license: "Qwen License", downloads: 18900, uploadedAt: "2024-07-15", tags: ["instruct", "chat", "moe", "qwen"], isMoe: true, expertCount: 14 },
  { repo: "unsloth/DeepSeek-V2-Lite-Chat-GGUF", builder: "unsloth", family: "deepseek", baseSizeGb: 30.0, parameterCount: "15.7B", description: "DeepSeek V2 Lite Chat (MoE)", architecture: "deepseek2", contextLength: 32768, license: "DeepSeek License", downloads: 14200, uploadedAt: "2024-06-20", tags: ["instruct", "chat", "moe", "deepseek"], isMoe: true, expertCount: 6 },
];

export function searchHFModels(query: string): HFSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return HF_CATALOG.filter(
    (r) =>
      r.repo.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.family.includes(q) ||
      r.builder.toLowerCase().includes(q) ||
      r.tags.some((t) => t.includes(q)),
  ).sort((a, b) => b.downloads - a.downloads);
}

export const HF_QUANTS: { id: string; label: string; sizeFactor: number; note: string; bits: number }[] = [
  { id: "Q4_0", label: "Q4_0 · 4-bit", sizeFactor: 0.55, note: "Most compressed. Good for limited VRAM.", bits: 4 },
  { id: "Q4_K_M", label: "Q4_K_M · 4-bit", sizeFactor: 0.62, note: "Recommended default for most users.", bits: 4 },
  { id: "Q5_K_M", label: "Q5_K_M · 5-bit", sizeFactor: 0.72, note: "Better quality, ~15% more memory.", bits: 5 },
  { id: "Q6_K", label: "Q6_K · 6-bit", sizeFactor: 0.82, note: "Close to fp16 quality.", bits: 6 },
  { id: "Q8_0", label: "Q8_0 · 8-bit", sizeFactor: 0.95, note: "Nearly indistinguishable from fp16.", bits: 8 },
  { id: "F16", label: "F16 · 16-bit", sizeFactor: 1.0, note: "Full precision. Largest size.", bits: 16 },
];

// ---------- Release variant catalog ----------

export const RELEASE_VARIANTS: { id: ReleaseVariant; label: string; priority: boolean; note: string }[] = [
  { id: "cuda12", label: "CUDA 12.x", priority: true, note: "NVIDIA GPU (cuBLAS, recommended)" },
  { id: "cuda13", label: "CUDA 13.x", priority: true, note: "NVIDIA GPU (newest CUDA toolkit)" },
  { id: "vulkan", label: "Vulkan", priority: true, note: "Cross-vendor GPU (AMD/Intel/NVIDIA)" },
  { id: "cpu", label: "CPU", priority: false, note: "No GPU acceleration" },
  { id: "hip", label: "HIP / ROCm", priority: false, note: "AMD GPU (Linux)" },
  { id: "opencl", label: "OpenCL", priority: false, note: "OpenCL GPU backend" },
  { id: "metal", label: "Metal", priority: false, note: "Apple Silicon (macOS)" },
];

// ---------- Simulator ----------

interface SimState {
  running: boolean;
  ticks: number;
  stop: () => void;
}

const instanceSims = new Map<string, SimState>();
const logSubscribers = new Set<(line: ConsoleLine) => void>();

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowTs() {
  return Date.now();
}

function emitLog(instanceId: string, kind: LogKind, text: string) {
  const line: ConsoleLine = {
    id: uid("log"),
    instanceId,
    ts: nowTs(),
    kind,
    text,
  };
  logSubscribers.forEach((fn) => fn(line));
  return line;
}

function fmtTime(d: Date) {
  return d.toTimeString().slice(0, 8);
}

function runStartupSequence(instance: LlamaInstance, store: LlamaStore) {
  let cancelled = false;
  let reqTimer: ReturnType<typeof setTimeout> | null = null;

  const sim: SimState = {
    running: true,
    ticks: 0,
    stop: () => {
      cancelled = true;
      sim.running = false;
      if (reqTimer) clearTimeout(reqTimer);
    },
  };
  instanceSims.set(instance.id, sim);

  const steps: Array<[number, LogKind, string]> = [
    [30, "info", `════════════════════════════════════════════════════════════════`],
    [60, "info", `  Launching llama-server "${instance.name}"`],
    [90, "info", `────────────────────────────────────────────────────────────────`],
    [120, "debug", `  model       : ${instance.model}`],
    [150, "debug", `  profile     : ${instance.profile}`],
    [180, "debug", `  host:port   : ${instance.host}:${instance.port}`],
    [210, "debug", `  gpu         : ${instance.gpu}`],
    [240, "debug", `  context     : ${instance.ctxSize} tokens`],
    [270, "debug", `  threads     : ${instance.threads}`],
    [300, "debug", `  gpu layers  : ${instance.gpu === "cpu" ? 0 : 99} (-ngl)`],
    [330, "debug", `  flash-attn  : ${instance.gpu === "cpu" ? "off (cpu)" : "on"}`],
    [360, "info", `────────────────────────────────────────────────────────────────`],
    [400, "info", `$ llama-server --model ${instance.model} --host ${instance.host} --port ${instance.port} -c ${instance.ctxSize} -t ${instance.threads} -ngl ${instance.gpu === "cpu" ? 0 : 99} ${instance.gpu === "cpu" ? "" : "--flash-attn"} --parallel 4 --cont-batching`],
    [460, "debug", "build: 4402 (8f1f7e1) with AVX2=1 AVX512=1 BMI2=1 CUDA=1"],
    [520, "info", "system_info: n_threads = " + instance.threads + " n_gpu_layers = 99"],
    [600, "info", "loading model from " + instance.model],
    [720, "debug", "llama_model_loader: loaded meta data with 24 KV pairs"],
    [780, "debug", "llama_model_loader: - kv[ 0]:                       general.name = " + instance.name],
    [860, "debug", "llama_model_loader: - kv[ 1]:          general.architecture = llama"],
    [940, "info", `llama_model_loader: - kv[12]:                      llama.context_length = ${instance.ctxSize}`],
    [1020, "debug", "llama_model_loader: - type  f16:  221 tensors"],
    [1100, "info", "llama_model_loader: loading model part 1/1 from '" + instance.model + "'"],
    [1240, "info", "llama_model_loader: model size = " + (instance.model.includes("7b") ? "13.9" : "4.1") + " GiB"],
    [1320, "success", "llama_model_loader: model loaded successfully"],
    [1400, "info", "using CUDA for GPU acceleration"],
    [1480, "debug", "llama_kv_cache:  CUDA0 KV buffer size = " + Math.round(instance.ctxSize * 0.5) + " MiB"],
    [1560, "info", "llama_new_context_with_model: n_ctx = " + instance.ctxSize + ", batch = 512"],
    [1660, "success", "llama_new_context_with_model: graph initialized"],
    [1740, "info", `llama server: listening on ${instance.host}:${instance.port}`],
    [1820, "info", "llama server: loading model took " + (1200 + Math.floor(Math.random() * 600)) + " ms"],
    [1900, "success", `llama server: model loaded, ready for requests at http://${instance.host}:${instance.port}`],
  ];

  let elapsed = 0;
  steps.forEach(([delay, kind, text]) => {
    if (cancelled) return;
    setTimeout(() => {
      if (cancelled) return;
      emitLog(instance.id, kind, `[${fmtTime(new Date())}] ${text}`);
    }, delay);
    elapsed = delay;
  });

  setTimeout(() => {
    if (cancelled) return;
    store.markRunning(instance.id);
    emitLog(instance.id, "success", `[${fmtTime(new Date())}] ✓ Server ready. Listening on http://${instance.host}:${instance.port}/completions`);

    const tick = () => {
      if (cancelled || !sim.running) return;
      sim.ticks += 1;
      const t = sim.ticks;
      store.registerActivity();
      if (t % 3 === 0) {
        const promptTok = 8 + Math.floor(Math.random() * 80);
        const genTok = 12 + Math.floor(Math.random() * 120);
        const tps = 18 + Math.random() * 24;
        emitLog(instance.id, "info", `[${fmtTime(new Date())}] POST /v1/chat/completions 200 - prompt: ${promptTok} tok, gen: ${genTok} tok, ${tps.toFixed(1)} tok/s`);
        store.bumpStats(instance.id, promptTok, genTok, tps);
      } else if (t % 5 === 0) {
        emitLog(instance.id, "debug", `[${fmtTime(new Date())}] slot 0: cache reused, kv tokens = ${100 + Math.floor(Math.random() * 400)}`);
      } else if (t % 7 === 0) {
        emitLog(instance.id, "warn", `[${fmtTime(new Date())}] request queue depth = ${1 + Math.floor(Math.random() * 3)}`);
      }
      reqTimer = setTimeout(tick, 1800 + Math.random() * 1200);
    };
    reqTimer = setTimeout(tick, 1800);
  }, elapsed + 200);
}

function runShutdownSequence(instance: LlamaInstance, store: LlamaStore) {
  const sim = instanceSims.get(instance.id);
  if (sim) sim.stop();

  emitLog(instance.id, "warn", `[${fmtTime(new Date())}] received SIGINT, shutting down...`);
  setTimeout(() => {
    emitLog(instance.id, "info", `[${fmtTime(new Date())}] waiting for in-flight requests to finish`);
  }, 200);
  setTimeout(() => {
    emitLog(instance.id, "info", `[${fmtTime(new Date())}] freeing KV cache and model buffers`);
  }, 450);
  setTimeout(() => {
    emitLog(instance.id, "success", `[${fmtTime(new Date())}] server stopped cleanly. goodbye.`);
    store.markStopped(instance.id);
  }, 700);
}

// ---------- Seed data ----------

const WS_PERSONAL = "ws_personal";
const WS_TEAM = "ws_team";
const WS_RESEARCH = "ws_research";

const seedWorkspaces: Workspace[] = [
  { id: WS_PERSONAL, name: "Personal", color: "blue", description: "Local dev & experiments" },
  { id: WS_TEAM, name: "Team Production", color: "green", description: "Shared serving profiles" },
  { id: WS_RESEARCH, name: "Research", color: "purple", description: "Benchmarks & calibration" },
];

function mkModel(
  id: string,
  name: string,
  family: string,
  sizeGb: number,
  quant: string,
  downloaded: boolean,
  path: string,
  hfRepo: string,
  builder: string,
  architecture: string,
  contextLength: number,
  parameterCount: string,
  quantizationBits: number,
  license: string,
  description: string,
  uploadedAt: string,
  hfDownloads: number,
  tags: string[],
  workspaceId = WS_PERSONAL,
  isMoe = false,
  expertCount?: number,
): LlamaModel {
  return {
    id, name, family, sizeGb, quant, downloaded, path, hfRepo, builder,
    architecture, contextLength, parameterCount, quantizationBits, license,
    description, uploadedAt, hfDownloads, tags, missing: false, workspaceId,
    addedAt: nowTs() - Math.floor(Math.random() * 30) * 86400000,
    isMoe, expertCount,
  };
}

const seedModels: LlamaModel[] = [
  mkModel("m1", "Llama 3.1 8B Q4_K_M", "llama3", 4.9, "Q4_K_M", true, "/models/llama-3.1-8b-instruct-q4_k_m.gguf", "bartowski/Llama-3.1-8B-Instruct-GGUF", "bartowski", "llama", 131072, "8B", 4, "Llama 3.1 Community", "Meta Llama 3.1 8B Instruct, quantized to Q4_K_M", "2024-07-23", 184200, ["instruct", "chat", "meta"]),
  mkModel("m2", "Qwen2.5 7B Q5_K_M", "qwen2", 5.2, "Q5_K_M", true, "/models/qwen2.5-7b-instruct-q5_k_m.gguf", "bartowski/Qwen2.5-7B-Instruct-GGUF", "bartowski", "qwen2", 32768, "7B", 5, "Apache 2.0", "Qwen 2.5 7B Instruct, quantized to Q5_K_M", "2024-09-19", 142800, ["instruct", "chat", "qwen"]),
  mkModel("m3", "Mistral 7B Q4_0", "mistral", 4.1, "Q4_0", true, "/models/mistral-7b-instruct-q4_0.gguf", "bartowski/mistral-7b-instruct-v0.3-GGUF", "bartowski", "llama", 32768, "7B", 4, "Apache 2.0", "Mistral 7B Instruct v0.3, quantized to Q4_0", "2024-05-22", 121000, ["instruct", "chat", "mistral"]),
  mkModel("m4", "Phi 3.1 Mini Q8", "phi3", 3.8, "Q8_0", true, "/models/phi-3.1-mini-128k-instruct-q8.gguf", "bartowski/Phi-3.1-mini-128k_instruct-GGUF", "bartowski", "phi3", 131072, "3.8B", 8, "MIT", "Microsoft Phi 3.1 Mini 128k Instruct, Q8_0", "2024-07-01", 88200, ["instruct", "microsoft", "long-context"]),
  mkModel("m5", "Gemma 2 9B Q6_K", "gemma2", 6.6, "Q6_K", true, "/models/gemma-2-9b-it-q6_k.gguf", "bartowski/gemma-2-9b-it-GGUF", "bartowski", "gemma2", 8192, "9B", 6, "Gemma", "Google Gemma 2 9B IT, Q6_K", "2024-06-27", 95400, ["instruct", "google", "gemma"]),
  // m6 is "missing" — file moved on disk
  (() => {
    const m = mkModel("m6", "DeepSeek R1 Distill 7B", "deepseek", 4.4, "Q4_K_M", true, "/models/deepseek-r1-distill-qwen-7b-q4_k_m.gguf", "bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF", "bartowski", "qwen2", 131072, "7B", 4, "MIT", "DeepSeek R1 Distill Qwen 7B, Q4_K_M", "2025-01-20", 67800, ["reasoning", "deepseek", "r1"]);
    m.missing = true;
    return m;
  })(),
  // m7 — a MoE model (Mixtral) to demonstrate the MoE badge
  mkModel("m7", "Mixtral 8x7B Q4_K_M", "mixtral", 26.0, "Q4_K_M", true, "/models/mixtral-8x7b-instruct-v0.1-q4_k_m.gguf", "bartowski/Mixtral-8x7B-Instruct-v0.1-GGUF", "bartowski", "llama", 32768, "46.7B", 4, "Apache 2.0", "Mixtral 8x7B Instruct v0.1 (MoE), Q4_K_M", "2023-12-13", 87400, ["instruct", "chat", "moe", "large"], WS_PERSONAL, true, 8),
];

const seedProfiles: LlamaProfile[] = [
  { id: "p1", name: "Balanced", description: "Good defaults for 7B–13B models on a single GPU", ctxSize: 8192, threads: 8, gpuLayers: 99, flashAttention: true, extraArgs: "--parallel 4 --cont-batching", scope: "global", shared: true, shareId: "sh_balanced_v1", calibrationScore: 88, workspaceId: null },
  { id: "p2", name: "Long Context", description: "Optimised for RAG and long documents", ctxSize: 32768, threads: 6, gpuLayers: 99, flashAttention: true, extraArgs: "--cache-type-k q8_0 --cache-type-v q8_0", scope: "global", calibrationScore: 82, workspaceId: null },
  { id: "p3", name: "High Throughput", description: "Maximise concurrent requests", ctxSize: 4096, threads: 12, gpuLayers: 99, flashAttention: true, extraArgs: "--parallel 8 --cont-batching -np 8", scope: "global", calibrationScore: 91, workspaceId: null },
  { id: "p4", name: "CPU Only", description: "No GPU layers, full CPU inference", ctxSize: 4096, threads: 16, gpuLayers: 0, flashAttention: false, extraArgs: "", scope: "global", calibrationScore: 74, workspaceId: null },
  { id: "p5", name: "Llama 3.1 Tuned", description: "Auto-calibrated for Llama 3.1 8B on RTX 4070", ctxSize: 16384, threads: 8, gpuLayers: 99, flashAttention: true, extraArgs: "--parallel 4 --cont-batching --no-mmap", scope: "model", modelId: "m1", calibrationScore: 96, workspaceId: WS_PERSONAL },
  { id: "p6", name: "Qwen 2.5 Tuned", description: "Auto-calibrated for Qwen 2.5 7B", ctxSize: 8192, threads: 8, gpuLayers: 99, flashAttention: true, extraArgs: "--parallel 4 --cont-batching", scope: "model", modelId: "m2", calibrationScore: 93, workspaceId: WS_PERSONAL },
];

function mkRelease(
  id: string,
  tag: string,
  publishedAt: string,
  commit: string,
  notes: string,
  installed: boolean,
  variant: ReleaseVariant,
  priority: boolean,
  sizeMb: number,
  workspaceId: string | null = WS_PERSONAL,
): LlamaRelease {
  return {
    id, tag, publishedAt, commit, notes, installed, variant, priority,
    downloadUrl: `https://github.com/ggerganov/llama.cpp/releases/download/${tag}/llama-${tag}-bin-${variant}-x64.zip`,
    sizeMb, workspaceId,
  };
}

// Generate releases for several tags × variants
const releaseTags = [
  { tag: "b4402", date: "2025-01-14", commit: "8f1f7e1", notes: "KV cache quantisation, faster prompt processing, RPC server fixes", installed: true },
  { tag: "b4390", date: "2024-12-20", commit: "a2c4f90", notes: "Improved FlashAttention path, new --cache-type-v flag", installed: false },
  { tag: "b4378", date: "2024-11-28", commit: "7bd12aa", notes: "Speculative decoding via draft models, multi-GPU tensor split fixes", installed: false },
  { tag: "b4360", date: "2024-10-15", commit: "3f8e221", notes: "Initial Qwen2.5 support, llama-server OpenAI-compatible refactor", installed: false },
  { tag: "b4345", date: "2024-09-02", commit: "c5d9012", notes: "Vulkan backend improvements, llama-perplexity fixes", installed: false },
  { tag: "b4321", date: "2024-08-11", commit: "e7a2b54", notes: "Batched decoding optimisations, KV cache reuse", installed: false },
  { tag: "b4300", date: "2024-07-05", commit: "1f6c890", notes: "gguf v3 support, llama-quantise rewrite", installed: false },
  { tag: "b4280", date: "2024-06-01", commit: "9b3a107", notes: "Metal backend updates, RPC server initial release", installed: false },
  { tag: "b4250", date: "2024-04-18", commit: "2d5e881", notes: "FlashAttention 2 path, KV cache paged", installed: false },
  { tag: "b4200", date: "2024-02-22", commit: "6c1f045", notes: "OpenAI-compatible /v1/chat/completions endpoint", installed: false },
];

const seedReleases: LlamaRelease[] = [];
releaseTags.forEach((r, ti) => {
  RELEASE_VARIANTS.forEach((v, vi) => {
    const installed = r.installed && v.id === "cuda12" && ti === 0;
    seedReleases.push(
      mkRelease(
        `r_${r.tag}_${v.id}`,
        r.tag,
        r.date,
        r.commit,
        r.notes,
        installed,
        v.id,
        v.priority,
        v.id === "cpu" ? 18 : v.id === "cuda12" || v.id === "cuda13" ? 42 : 28,
      ),
    );
  });
});

const seedInstances: LlamaInstance[] = [];

// ---------- Store ----------

interface LlamaStore {
  instances: LlamaInstance[];
  models: LlamaModel[];
  profiles: LlamaProfile[];
  releases: LlamaRelease[];
  workspaces: Workspace[];
  activeWorkspaceId: string;
  downloads: HFDownload[];
  logs: Record<string, ConsoleLine[]>;
  activeConsoleId: string;
  consoleOpen: boolean;
  consoleHeight: number;
  notifications: AppNotification[];

  // settings
  globalSettings: GlobalSettings;
  workspaceSettings: Record<string, WorkspaceSettings>;
  systemCapabilities: SystemCapabilities;

  // app status / hibernation
  appStatus: AppStatus;
  lastActivityAt: number;
  hibernatedInstanceIds: string[];
  metrics: MetricSample[];
  registerActivity: () => void;
  setAppStatus: (s: AppStatus) => void;
  forceHibernate: () => void;
  forceWake: () => void;
  pushMetric: (m: MetricSample) => void;

  // workspace
  setActiveWorkspace: (id: string) => void;
  addWorkspace: (w: { name: string; description: string; color: Workspace["color"] }) => string;
  updateWorkspace: (id: string, patch: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;
  updateGlobalSettings: (patch: Partial<GlobalSettings>) => void;
  updateWorkspaceSettings: (workspaceId: string, patch: Partial<WorkspaceSettings>) => void;

  // instance actions
  startInstance: (config: { name: string; model: string; profile: string; port: number; host: string; gpu: string }) => string;
  stopInstance: (id: string) => void;
  removeInstance: (id: string) => void;
  markRunning: (id: string) => void;
  markStopped: (id: string) => void;
  bumpStats: (id: string, prompt: number, gen: number, tps: number) => void;
  setActiveConsole: (id: string) => void;
  toggleConsole: () => void;
  setConsoleOpen: (open: boolean) => void;
  setConsoleHeight: (h: number) => void;
  clearConsole: (id: string) => void;

  // models
  downloadModel: (id: string) => void;
  startHFDownload: (config: { repo: string; quant: string; modelName: string; builder: string }) => string;
  updateModel: (id: string, patch: Partial<LlamaModel>) => void;
  deleteModel: (id: string) => void;
  markModelMissing: (id: string, missing: boolean) => void;
  locateModel: (id: string, newPath: string) => void;

  // releases
  installRelease: (id: string) => void;
  uninstallRelease: (id: string) => void;
  startReleaseDownload: (releaseId: string) => string;
  copyCudaLibs: (releaseId: string) => void;

  // profiles
  addProfile: (p: Omit<LlamaProfile, "id">) => void;
  removeProfile: (id: string) => void;
  shareProfile: (id: string) => void;
  calibrateProfile: (id: string) => void;

  // notifications
  addNotification: (n: Omit<AppNotification, "id" | "ts" | "read">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;

  appendLog: (line: ConsoleLine) => void;
}

const SYSTEM_CONSOLE_ID = "system";

const initialSystemLogs: ConsoleLine[] = [
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 5000, kind: "info", text: "[boot] LlamaLauncher v0.4.2 ready" },
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 4800, kind: "debug", text: "[boot] detected 1 CUDA device: NVIDIA RTX 4070 (12 GB)" },
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 4600, kind: "info", text: "[boot] llama.cpp build b4402 (8f1f7e1) installed at /opt/llama.cpp" },
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 4400, kind: "success", text: "[boot] 6 models available, 6 profiles configured (4 global, 2 model-tuned)" },
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 4200, kind: "info", text: "[hibernate] auto-hibernation enabled: idle 75s → hibernate (models unloaded)" },
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 200, kind: "info", text: "[ready] start an instance to launch a llama-server process" },
];

export const SYSTEM_CONSOLE = SYSTEM_CONSOLE_ID;

const defaultGlobalSettings: GlobalSettings = {
  llamaCppPath: "/opt/llama.cpp/build/llama-server",
  modelsDir: "/models",
  cudaLibsDir: "/opt/cuda/lib64",
  defaultHost: "127.0.0.1",
  portRangeStart: 8080,
  portRangeEnd: 8099,
  notifyOnCrash: true,
  notifyOnHighMemory: true,
  notifyOnNewRelease: true,
  checkForReleases: true,
  releaseChannel: "stable",
};

const defaultWorkspaceSettings: WorkspaceSettings = {
  hibernateAfterSec: 75,
  defaultGpuLayers: 99,
  defaultThreads: 8,
  autoCalibrate: true,
  maxConcurrentInstances: 4,
};

function seedMetrics(): MetricSample[] {
  const now = Date.now();
  const out: MetricSample[] = [];
  for (let i = 59; i >= 0; i--) {
    out.push({ t: now - i * 1000, cpu: 0, ram: 0, gpu: 0, gpuMem: 0, tps: 0, reqPerMin: 0 });
  }
  return out;
}

let watchdogTimer: ReturnType<typeof setInterval> | null = null;

function startWatchdog() {
  if (watchdogTimer) clearInterval(watchdogTimer);
  watchdogTimer = setInterval(() => {
    const s = useLlamaStore.getState();
    const since = Date.now() - s.lastActivityAt;
    const wsSettings = s.workspaceSettings[s.activeWorkspaceId] ?? defaultWorkspaceSettings;
    const hibernateAfterMs = wsSettings.hibernateAfterSec * 1000;
    const running = s.instances.filter((i) => i.status === "running" || i.status === "starting");

    if (s.appStatus === "waking" || s.appStatus === "hibernating") return;

    if (since >= hibernateAfterMs && running.length > 0) {
      s.setAppStatus("hibernating");
      emitLog(SYSTEM_CONSOLE_ID, "warn", `[${fmtTime(new Date())}] [hibernate] idle ${Math.round(since / 1000)}s — unloading ${running.length} model(s) from VRAM`);
      running.forEach((inst) => {
        useLlamaStore.getState().stopInstance(inst.id);
        useLlamaStore.setState((st) => ({
          hibernatedInstanceIds: [...st.hibernatedInstanceIds, inst.id],
          instances: st.instances.map((i) =>
            i.id === inst.id
              ? { ...i, hibernatedConfig: { name: i.name, model: i.model, profile: i.profile, port: i.port, host: i.host, gpu: i.gpu } }
              : i,
          ),
        }));
      });
      s.addNotification({ kind: "warn", title: "Hibernation started", body: `${running.length} model(s) unloaded from VRAM after ${Math.round(since / 1000)}s idle.` });
      setTimeout(() => {
        emitLog(SYSTEM_CONSOLE_ID, "info", `[${fmtTime(new Date())}] [hibernate] all models unloaded. VRAM freed. Awaiting next request to hot-reload.`);
      }, 1200);
    } else if (since >= hibernateAfterMs * 0.6 && s.appStatus === "active") {
      s.setAppStatus("idle");
      emitLog(SYSTEM_CONSOLE_ID, "debug", `[${fmtTime(new Date())}] [idle] no activity for ${Math.round(since / 1000)}s — will hibernate in ${Math.max(0, Math.round((hibernateAfterMs - since) / 1000))}s`);
    } else if (since < hibernateAfterMs * 0.6 && s.appStatus === "idle") {
      s.setAppStatus("active");
    }
  }, 3000);
}

let metricsTimer: ReturnType<typeof setInterval> | null = null;
function startMetricsTicker() {
  if (metricsTimer) clearInterval(metricsTimer);
  metricsTimer = setInterval(() => {
    const s = useLlamaStore.getState();
    const running = s.instances.filter((i) => i.status === "running");
    const totalTps = running.reduce((sum, i) => sum + i.tokensPerSec, 0);
    const totalMem = running.reduce((sum, i) => sum + i.memoryMb, 0);
    const totalReq = running.reduce((sum, i) => sum + i.requestsPerMin, 0);
    const isHibernating = s.appStatus === "hibernating";
    const sample: MetricSample = {
      t: Date.now(),
      cpu: isHibernating ? 1 + Math.random() * 2 : 8 + Math.random() * 18 + running.length * 3,
      ram: isHibernating ? 18 + Math.random() * 4 : 32 + Math.random() * 6 + totalMem / 1024,
      gpu: isHibernating ? 0 : Math.min(100, 15 + running.length * 22 + Math.random() * 18),
      gpuMem: isHibernating ? 0 : Math.min(100, (totalMem / 12288) * 100),
      tps: totalTps,
      reqPerMin: totalReq,
    };
    useLlamaStore.getState().pushMetric(sample);
  }, 1500);
}

// Simulated GitHub release poller — fires a "new release" notification once
let releaseCheckTimer: ReturnType<typeof setTimeout> | null = null;
function startReleaseChecker() {
  if (releaseCheckTimer) clearTimeout(releaseCheckTimer);
  releaseCheckTimer = setTimeout(() => {
    const s = useLlamaStore.getState();
    if (!s.globalSettings.notifyOnNewRelease || !s.globalSettings.checkForReleases) return;
    s.addNotification({
      kind: "release",
      title: "New llama.cpp release available",
      body: "b4403 (9a2c7f1) — Improved RPC server, fixed KV cache eviction bug. CUDA 12, CUDA 13, Vulkan builds available.",
      actionLabel: "Install",
    });
    emitLog(SYSTEM_CONSOLE_ID, "info", `[${fmtTime(new Date())}] [github] new release detected: b4403`);
  }, 12000);
}

export const useLlamaStore = create<LlamaStore>((set, get) => {
  logSubscribers.add((line) => {
    get().appendLog(line);
  });

  const store: LlamaStore = {
    instances: seedInstances,
    models: seedModels,
    profiles: seedProfiles,
    releases: seedReleases,
    workspaces: seedWorkspaces,
    activeWorkspaceId: WS_PERSONAL,
    downloads: [],
    logs: { [SYSTEM_CONSOLE_ID]: initialSystemLogs },
    activeConsoleId: SYSTEM_CONSOLE_ID,
    consoleOpen: false,
    consoleHeight: 240,
    notifications: [],

    globalSettings: defaultGlobalSettings,
    workspaceSettings: {
      [WS_PERSONAL]: { ...defaultWorkspaceSettings },
      [WS_TEAM]: { ...defaultWorkspaceSettings, hibernateAfterSec: 300, maxConcurrentInstances: 8 },
      [WS_RESEARCH]: { ...defaultWorkspaceSettings, hibernateAfterSec: 0, autoCalibrate: false },
    },
    systemCapabilities: {
      gpuName: "NVIDIA RTX 4070",
      gpuVramGb: 12,
      ramGb: 64,
      cpuCores: 16,
      hasCuda: true,
    },

    appStatus: "active",
    lastActivityAt: nowTs(),
    hibernatedInstanceIds: [],
    metrics: seedMetrics(),

    registerActivity: () => {
      const s = get();
      const wasHibernating = s.appStatus === "hibernating";
      set({ lastActivityAt: nowTs() });
      if (wasHibernating) {
        set({ appStatus: "waking" });
        emitLog(SYSTEM_CONSOLE_ID, "info", `[${fmtTime(new Date())}] [wake] activity detected — hot-reloading ${s.hibernatedInstanceIds.length} hibernated model(s)`);
        const hibernatedIds = [...s.hibernatedInstanceIds];
        set({ hibernatedInstanceIds: [] });
        let delay = 0;
        hibernatedIds.forEach((oldId) => {
          const oldInst = s.instances.find((i) => i.id === oldId);
          const cfg = oldInst?.hibernatedConfig;
          if (!cfg) return;
          setTimeout(() => {
            get().removeInstance(oldId);
            const newId = get().startInstance(cfg);
            emitLog(newId, "info", `[${fmtTime(new Date())}] [wake] hot-reloaded from hibernation`);
          }, delay);
          delay += 400;
        });
        setTimeout(() => {
          get().setAppStatus("active");
          emitLog(SYSTEM_CONSOLE_ID, "success", `[${fmtTime(new Date())}] [wake] all models reloaded, resuming normal operation`);
        }, delay + 2000);
      } else if (s.appStatus === "idle") {
        set({ appStatus: "active" });
      }
    },

    setAppStatus: (st) => set({ appStatus: st }),
    forceHibernate: () => {
      const wsSettings = get().workspaceSettings[get().activeWorkspaceId];
      set({ lastActivityAt: nowTs() - (wsSettings?.hibernateAfterSec ?? 75) * 1000 - 1000 });
    },
    forceWake: () => { get().registerActivity(); },
    pushMetric: (m) => set((s) => ({ metrics: [...s.metrics.slice(-59), m] })),

    setActiveWorkspace: (id) => {
      set({ activeWorkspaceId: id });
      const ws = get().workspaces.find((w) => w.id === id);
      if (ws) emitLog(SYSTEM_CONSOLE_ID, "info", `[${fmtTime(new Date())}] [workspace] switched to "${ws.name}"`);
    },
    addWorkspace: (w) => {
      const id = `ws_${Math.random().toString(36).slice(2, 8)}`;
      set((s) => ({
        workspaces: [...s.workspaces, { ...w, id }],
        workspaceSettings: { ...s.workspaceSettings, [id]: { ...defaultWorkspaceSettings } },
      }));
      return id;
    },
    updateWorkspace: (id, patch) =>
      set((s) => ({ workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
    removeWorkspace: (id) =>
      set((s) => ({
        workspaces: s.workspaces.filter((w) => w.id !== id),
        instances: s.instances.filter((i) => i.workspaceId !== id),
        models: s.models.filter((m) => m.workspaceId !== id),
      })),

    updateGlobalSettings: (patch) => set((s) => ({ globalSettings: { ...s.globalSettings, ...patch } })),
    updateWorkspaceSettings: (workspaceId, patch) =>
      set((s) => ({
        workspaceSettings: {
          ...s.workspaceSettings,
          [workspaceId]: { ...(s.workspaceSettings[workspaceId] ?? defaultWorkspaceSettings), ...patch },
        },
      })),

    startInstance: ({ name, model, profile, port, host, gpu }) => {
      const id = uid("inst");
      const wsId = get().activeWorkspaceId;
      const prof = get().profiles.find((p) => p.id === profile) ?? get().profiles[0];
      const colors: LlamaInstance["color"][] = ["green", "orange", "blue", "pink", "purple"];
      const color = colors[get().instances.length % colors.length];
      const instance: LlamaInstance = {
        id, name, model, profile: prof.name, port, host, status: "starting",
        gpu, ctxSize: prof.ctxSize, threads: prof.threads, color,
        startedAt: nowTs(), promptTokens: 0, generatedTokens: 0,
        requestsPerMin: 0, tokensPerSec: 0, memoryMb: 0,
        peakTokensPerSec: 0, totalRequests: 0, errorCount: 0, workspaceId: wsId,
      };
      set((s) => ({
        instances: [...s.instances, instance],
        logs: { ...s.logs, [id]: [] },
        activeConsoleId: id, consoleOpen: true, appStatus: "active", lastActivityAt: nowTs(),
      }));
      emitLog(id, "info", `[${fmtTime(new Date())}] starting llama-server for "${name}" (model: ${model})`);
      runStartupSequence(instance, get());
      get().registerActivity();
      return id;
    },

    stopInstance: (id) => {
      const inst = get().instances.find((i) => i.id === id);
      if (!inst) return;
      set((s) => ({ instances: s.instances.map((i) => (i.id === id ? { ...i, status: "stopping" } : i)) }));
      runShutdownSequence(inst, get());
    },

    removeInstance: (id) => {
      const sim = instanceSims.get(id);
      if (sim) sim.stop();
      instanceSims.delete(id);
      set((s) => {
        const newLogs = { ...s.logs };
        delete newLogs[id];
        return {
          instances: s.instances.filter((i) => i.id !== id),
          logs: newLogs,
          activeConsoleId: s.activeConsoleId === id ? SYSTEM_CONSOLE_ID : s.activeConsoleId,
        };
      });
    },

    markRunning: (id) => set((s) => ({
      instances: s.instances.map((i) => (i.id === id ? { ...i, status: "running", startedAt: i.startedAt ?? nowTs() } : i)),
    })),
    markStopped: (id) => set((s) => ({
      instances: s.instances.map((i) => (i.id === id ? { ...i, status: "stopped", startedAt: undefined } : i)),
    })),

    bumpStats: (id, prompt, gen, tps) => set((s) => ({
      instances: s.instances.map((i) =>
        i.id === id
          ? {
              ...i,
              promptTokens: i.promptTokens + prompt,
              generatedTokens: i.generatedTokens + gen,
              tokensPerSec: tps,
              peakTokensPerSec: Math.max(i.peakTokensPerSec, tps),
              requestsPerMin: i.requestsPerMin + 1,
              totalRequests: i.totalRequests + 1,
              memoryMb: Math.round(i.ctxSize * 0.5 + 1200 + Math.random() * 200),
            }
          : i,
      ),
    })),

    setActiveConsole: (id) => set({ activeConsoleId: id, consoleOpen: true }),
    toggleConsole: () => set((s) => ({ consoleOpen: !s.consoleOpen })),
    setConsoleOpen: (open) => set({ consoleOpen: open }),
    setConsoleHeight: (h) => set({ consoleHeight: Math.max(120, Math.min(600, h)) }),
    clearConsole: (id) => set((s) => ({ logs: { ...s.logs, [id]: [] } })),

    downloadModel: (id) => set((s) => ({
      models: s.models.map((m) => (m.id === id ? { ...m, downloaded: true, missing: false } : m)),
    })),

    startHFDownload: ({ repo, quant, modelName, builder }) => {
      const dlId = uid("dl");
      const modelId = uid("m");
      const q = HF_QUANTS.find((x) => x.id === quant);
      const repoInfo = HF_CATALOG.find((r) => r.repo === repo);
      const sizeGb = (repoInfo?.baseSizeGb ?? 8) * (q?.sizeFactor ?? 0.6);
      const filename = `${repo.split("/")[1]}-${quant}.gguf`;

      // Create an INLINE downloading model placeholder immediately — it appears
      // as a card/row at the end of the grid/table and animates in place. This
      // avoids layout shift from a separate "Active downloads" panel appearing
      // at the top.
      const placeholderModel: LlamaModel = {
        id: modelId,
        name: `${modelName} ${quant}`,
        family: repoInfo?.family ?? "unknown",
        sizeGb: Math.round(sizeGb * 10) / 10,
        quant, downloaded: false, missing: false,
        path: `/models/${filename}`, hfRepo: repo, builder,
        architecture: repoInfo?.architecture ?? "llama",
        contextLength: repoInfo?.contextLength ?? 8192,
        parameterCount: repoInfo?.parameterCount ?? "?B",
        quantizationBits: q?.bits ?? 4,
        license: repoInfo?.license ?? "Unknown",
        description: repoInfo?.description ?? modelName,
        uploadedAt: repoInfo?.uploadedAt ?? new Date().toISOString().slice(0, 10),
        hfDownloads: repoInfo?.downloads ?? 0,
        tags: repoInfo?.tags ?? [],
        isMoe: repoInfo?.isMoe ?? false,
        expertCount: repoInfo?.expertCount,
        workspaceId: get().activeWorkspaceId,
        addedAt: nowTs(),
        downloading: true,
        downloadProgress: 0,
      };

      // Keep a downloads entry for the sidebar badge + system console log,
      // but the visible UI lives on the model card itself.
      const dl: HFDownload = {
        id: dlId, repo, quant, filename, sizeGb, progress: 0, status: "downloading",
        startedAt: nowTs(), modelName, builder, kind: "model",
      };
      set((s) => ({ downloads: [...s.downloads, dl], models: [...s.models, placeholderModel] }));
      emitLog(SYSTEM_CONSOLE_ID, "info", `[${fmtTime(new Date())}] [hf] downloading ${filename} from ${repo} (${sizeGb.toFixed(1)} GB, builder: ${builder})`);

      // Smooth progressive download — small steady increments to avoid UI jitter.
      // Updates the model's downloadProgress in place (no new element added).
      let progress = 0;
      const tick = () => {
        progress += 1.5 + Math.random() * 1.5;
        if (progress >= 100) {
          set((st) => ({
            downloads: st.downloads.map((d) => (d.id === dlId ? { ...d, progress: 100, status: "completed" } : d)),
            models: st.models.map((m) =>
              m.id === modelId
                ? { ...m, downloaded: true, downloading: false, downloadProgress: 100 }
                : m,
            ),
          }));
          emitLog(SYSTEM_CONSOLE_ID, "success", `[${fmtTime(new Date())}] [hf] download complete: ${filename} (${sizeGb.toFixed(1)} GB)`);
          get().addNotification({ kind: "download", title: "Model downloaded", body: `${modelName} ${quant} (${sizeGb.toFixed(1)} GB) is ready to use.` });
          return;
        }
        set((st) => ({
          downloads: st.downloads.map((d) => (d.id === dlId ? { ...d, progress } : d)),
          models: st.models.map((m) =>
            m.id === modelId ? { ...m, downloadProgress: progress } : m,
          ),
        }));
        setTimeout(tick, 200);
      };
      setTimeout(tick, 400);
      return dlId;
    },

    updateModel: (id, patch) => set((s) => ({
      models: s.models.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
    deleteModel: (id) => set((s) => ({ models: s.models.filter((m) => m.id !== id) })),
    markModelMissing: (id, missing) => set((s) => ({
      models: s.models.map((m) => (m.id === id ? { ...m, missing, downloaded: missing ? false : m.downloaded } : m)),
    })),
    locateModel: (id, newPath) => set((s) => ({
      models: s.models.map((m) => (m.id === id ? { ...m, path: newPath, missing: false, downloaded: true } : m)),
    })),

    installRelease: (id) => set((s) => ({
      releases: s.releases.map((r) => (r.id === id ? { ...r, installed: true, installing: false, installProgress: 100 } : r)),
    })),
    uninstallRelease: (id) => set((s) => ({
      releases: s.releases.map((r) => (r.id === id ? { ...r, installed: false } : r)),
    })),

    startReleaseDownload: (releaseId) => {
      const dlId = uid("dl");
      const rel = get().releases.find((r) => r.id === releaseId);
      if (!rel) return dlId;
      const sizeGb = rel.sizeMb / 1024;
      const dl: HFDownload = {
        id: dlId, repo: `llama.cpp ${rel.tag} (${rel.variant})`, quant: rel.variant,
        filename: `llama-${rel.tag}-bin-${rel.variant}-x64.zip`, sizeGb, progress: 0,
        status: "downloading", startedAt: nowTs(), modelName: `llama.cpp ${rel.tag}`,
        builder: "ggerganov", kind: "release", variant: rel.variant,
      };
      set((s) => ({
        downloads: [...s.downloads, dl],
        releases: s.releases.map((r) => (r.id === releaseId ? { ...r, installing: true, installProgress: 0 } : r)),
      }));
      emitLog(SYSTEM_CONSOLE_ID, "info", `[${fmtTime(new Date())}] [release] downloading llama.cpp ${rel.tag} (${rel.variant}, ${rel.sizeMb} MB)`);

      let progress = 0;
      const tick = () => {
        progress += 2 + Math.random() * 2;
        if (progress >= 100) {
          set((st) => ({
            downloads: st.downloads.map((d) => (d.id === dlId ? { ...d, progress: 100, status: "completed" } : d)),
            releases: st.releases.map((r) => (r.id === releaseId ? { ...r, installing: false, installProgress: 100, installed: true } : r)),
          }));
          emitLog(SYSTEM_CONSOLE_ID, "success", `[${fmtTime(new Date())}] [release] llama.cpp ${rel.tag} (${rel.variant}) installed`);
          get().addNotification({ kind: "download", title: "Release installed", body: `llama.cpp ${rel.tag} (${rel.variant}) is ready.` });
          // For CUDA variants, simulate copying CUDA libs
          if (rel.variant === "cuda12" || rel.variant === "cuda13") {
            setTimeout(() => get().copyCudaLibs(releaseId), 600);
          }
          return;
        }
        set((st) => ({
          downloads: st.downloads.map((d) => (d.id === dlId ? { ...d, progress } : d)),
          releases: st.releases.map((r) => (r.id === releaseId ? { ...r, installProgress: progress } : r)),
        }));
        setTimeout(tick, 180);
      };
      setTimeout(tick, 400);
      return dlId;
    },

    copyCudaLibs: (releaseId) => {
      const rel = get().releases.find((r) => r.id === releaseId);
      if (!rel) return;
      const cudaDir = get().globalSettings.cudaLibsDir;
      emitLog(SYSTEM_CONSOLE_ID, "info", `[${fmtTime(new Date())}] [cuda] copying CUDA libraries from ${cudaDir} → llama.cpp ${rel.tag} build dir`);
      setTimeout(() => {
        emitLog(SYSTEM_CONSOLE_ID, "debug", `[${fmtTime(new Date())}] [cuda] copied cublasLt.dll, cublas.dll, cudart64_*.dll, cudnn*.dll`);
      }, 400);
      setTimeout(() => {
        emitLog(SYSTEM_CONSOLE_ID, "success", `[${fmtTime(new Date())}] [cuda] CUDA libraries linked. ${rel.variant.toUpperCase()} backend ready.`);
        get().addNotification({ kind: "info", title: "CUDA libraries copied", body: `CUDA libs linked to llama.cpp ${rel.tag} (${rel.variant}).` });
      }, 900);
    },

    addProfile: (p) => set((s) => ({ profiles: [...s.profiles, { ...p, id: uid("prof") }] })),
    removeProfile: (id) => set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) })),
    shareProfile: (id) => set((s) => ({
      profiles: s.profiles.map((p) => (p.id === id ? { ...p, shared: true, shareId: p.shareId ?? `sh_${id}_v1` } : p)),
    })),
    calibrateProfile: (id) => set((s) => ({
      profiles: s.profiles.map((p) =>
        p.id === id ? { ...p, calibrationScore: Math.min(100, (p.calibrationScore ?? 70) + 5 + Math.floor(Math.random() * 8)) } : p,
      ),
    })),

    addNotification: (n) => set((s) => ({
      notifications: [{ ...n, id: uid("notif"), ts: nowTs(), read: false }, ...s.notifications].slice(0, 50),
    })),
    markNotificationRead: (id) => set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),
    markAllNotificationsRead: () => set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),
    clearNotifications: () => set({ notifications: [] }),

    appendLog: (line) => set((s) => {
      const list = s.logs[line.instanceId] ?? [];
      const next = list.length > 800 ? list.slice(list.length - 800) : list;
      return { logs: { ...s.logs, [line.instanceId]: [...next, line] } };
    }),
  };

  if (typeof window !== "undefined") {
    setTimeout(() => {
      startWatchdog();
      startMetricsTicker();
      startReleaseChecker();
    }, 500);
  }

  return store;
});

// ---------- Selectors / helpers ----------

export function uptimeString(startedAt?: number) {
  if (!startedAt) return "--";
  const sec = Math.floor((Date.now() - startedAt) / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function pickPort() {
  return 8080 + Math.floor(Math.random() * 20);
}

export function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function fmtBytes(gb: number) {
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(gb * 1024).toFixed(0)} MB`;
}
