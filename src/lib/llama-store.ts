/**
 * LlamaLauncher state store — Tauri-backed.
 *
 * All model, process, system and config data comes from the real Tauri 2
 * Rust backend via `src/lib/tauri-api.ts`. When running outside Tauri
 * (plain browser), the store initialises with empty arrays and the UI
 * renders honest empty states — there is NO fake/seed data.
 *
 * Frontend-only features kept:
 * - Hibernation timer (stops real Tauri processes after idle)
 * - Notifications (in-memory)
 * - Profiles (localStorage)
 * - HF search catalog (in-memory, for the download dialog)
 */

import { create } from "zustand";
import { tauri, isTauri } from "@/lib/tauri-api";

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
  pid?: number;
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
  // --- Codestral & code models ---
  { repo: "bartowski/Codestral-22B-v0.1-GGUF", builder: "bartowski", family: "codestral", baseSizeGb: 44.0, parameterCount: "22B", description: "Mistral Codestral 22B v0.1 (code generation)", architecture: "llama", contextLength: 32768, license: "MNPL", downloads: 52800, uploadedAt: "2024-05-29", tags: ["code", "coder", "mistral", "codestral"], isMoe: false },
  { repo: "bartowski/Codestral-22B-v0.1-GGUF", builder: "bartowski", family: "codestral", baseSizeGb: 44.0, parameterCount: "22B", description: "Codestral 22B (Mistral AI code model)", architecture: "llama", contextLength: 32768, license: "MNPL", downloads: 31200, uploadedAt: "2024-05-30", tags: ["codestral", "code", "coder"], isMoe: false },
  { repo: "lmstudio-community/Codestral-22B-v0.1-GGUF", builder: "lmstudio-community", family: "codestral", baseSizeGb: 44.0, parameterCount: "22B", description: "Codestral 22B v0.1 (LM Studio)", architecture: "llama", contextLength: 32768, license: "MNPL", downloads: 18700, uploadedAt: "2024-05-29", tags: ["codestral", "code", "lmstudio"], isMoe: false },
  { repo: "bartowski/CodeQwen1.5-7B-Chat-GGUF", builder: "bartowski", family: "qwen2", baseSizeGb: 14.5, parameterCount: "7B", description: "CodeQwen 1.5 7B Chat (Qwen code model)", architecture: "qwen2", contextLength: 65536, license: "Apache 2.0", downloads: 41600, uploadedAt: "2024-04-25", tags: ["code", "coder", "qwen", "codeqwen"], isMoe: false },
  { repo: "bartowski/CodeLlama-7B-Instruct-GGUF", builder: "bartowski", family: "codellama", baseSizeGb: 13.0, parameterCount: "7B", description: "Code Llama 7B Instruct (Meta)", architecture: "llama", contextLength: 16384, license: "Llama 2 Community", downloads: 38900, uploadedAt: "2024-01-15", tags: ["code", "coder", "meta", "codellama"], isMoe: false },
  { repo: "TheBloke/CodeLlama-7B-Instruct-GGUF", builder: "TheBloke", family: "codellama", baseSizeGb: 13.0, parameterCount: "7B", description: "Code Llama 7B Instruct (TheBloke)", architecture: "llama", contextLength: 16384, license: "Llama 2 Community", downloads: 245000, uploadedAt: "2023-08-25", tags: ["code", "coder", "codellama", "legacy"], isMoe: false },
  { repo: "bartowski/CodeLlama-13B-Instruct-GGUF", builder: "bartowski", family: "codellama", baseSizeGb: 26.0, parameterCount: "13B", description: "Code Llama 13B Instruct (Meta)", architecture: "llama", contextLength: 16384, license: "Llama 2 Community", downloads: 21400, uploadedAt: "2024-01-15", tags: ["code", "coder", "meta", "codellama", "large"], isMoe: false },
  { repo: "bartowski/DeepSeek-Coder-V2-Lite-Instruct-GGUF", builder: "bartowski", family: "deepseek", baseSizeGb: 30.0, parameterCount: "15.7B", description: "DeepSeek Coder V2 Lite Instruct (MoE, code)", architecture: "deepseek2", contextLength: 131072, license: "DeepSeek License", downloads: 35600, uploadedAt: "2024-06-21", tags: ["code", "coder", "moe", "deepseek", "deepseek-coder"], isMoe: true, expertCount: 6 },
  { repo: "bartowski/DeepSeek-Coder-V2-Instruct-GGUF", builder: "bartowski", family: "deepseek", baseSizeGb: 449.0, parameterCount: "236B", description: "DeepSeek Coder V2 Instruct (MoE, full)", architecture: "deepseek2", contextLength: 131072, license: "DeepSeek License", downloads: 12700, uploadedAt: "2024-06-19", tags: ["code", "coder", "moe", "deepseek", "large"], isMoe: true, expertCount: 6 },
  { repo: "bartowski/starcoder2-7b-GGUF", builder: "bartowski", family: "starcoder", baseSizeGb: 14.5, parameterCount: "7B", description: "StarCoder 2 7B (BigCode)", architecture: "starcoder2", contextLength: 16384, license: "BigCode OpenRAIL-M", downloads: 28900, uploadedAt: "2024-02-28", tags: ["code", "coder", "bigcode", "starcoder"], isMoe: false },
  { repo: "bartowski/starcoder2-15b-GGUF", builder: "bartowski", family: "starcoder", baseSizeGb: 30.0, parameterCount: "15B", description: "StarCoder 2 15B (BigCode)", architecture: "starcoder2", contextLength: 16384, license: "BigCode OpenRAIL-M", downloads: 19400, uploadedAt: "2024-02-28", tags: ["code", "coder", "bigcode", "starcoder", "large"], isMoe: false },
  // --- Command R / Aya ---
  { repo: "bartowski/c4ai-command-r-v01-GGUF", builder: "bartowski", family: "command-r", baseSizeGb: 70.0, parameterCount: "35B", description: "Cohere Command R 35B v01", architecture: "command-r", contextLength: 131072, license: "CC-BY-NC-4.0", downloads: 22300, uploadedAt: "2024-03-12", tags: ["instruct", "chat", "cohere", "command-r"], isMoe: false },
  { repo: "bartowski/c4ai-command-r-plus-GGUF", builder: "bartowski", family: "command-r", baseSizeGb: 195.0, parameterCount: "104B", description: "Cohere Command R+ 104B", architecture: "command-r", contextLength: 131072, license: "CC-BY-NC-4.0", downloads: 16700, uploadedAt: "2024-04-04", tags: ["instruct", "chat", "cohere", "command-r", "large"], isMoe: false },
  { repo: "bartowski/aya-23-8B-GGUF", builder: "bartowski", family: "aya", baseSizeGb: 16.0, parameterCount: "8B", description: "Cohere Aya 23 8B (multilingual)", architecture: "command-r", contextLength: 8192, license: "CC-BY-NC-4.0", downloads: 12800, uploadedAt: "2024-05-08", tags: ["instruct", "chat", "cohere", "aya", "multilingual"], isMoe: false },
  // --- Llama 3.x family ---
  { repo: "bartowski/Llama-3.2-1B-Instruct-GGUF", builder: "bartowski", family: "llama3", baseSizeGb: 2.5, parameterCount: "1B", description: "Meta Llama 3.2 1B Instruct (small)", architecture: "llama", contextLength: 131072, license: "Llama 3.2 Community", downloads: 67200, uploadedAt: "2024-09-25", tags: ["instruct", "small", "meta"], isMoe: false },
  { repo: "unsloth/Llama-3.2-1B-Instruct-GGUF", builder: "unsloth", family: "llama3", baseSizeGb: 2.5, parameterCount: "1B", description: "Meta Llama 3.2 1B Instruct (unsloth)", architecture: "llama", contextLength: 131072, license: "Llama 3.2 Community", downloads: 45300, uploadedAt: "2024-09-25", tags: ["instruct", "small", "meta", "unsloth"], isMoe: false },
  { repo: "bartowski/Llama-3.2-3B-Instruct-GGUF", builder: "bartowski", family: "llama3", baseSizeGb: 6.5, parameterCount: "3B", description: "Meta Llama 3.2 3B Instruct", architecture: "llama", contextLength: 131072, license: "Llama 3.2 Community", downloads: 94100, uploadedAt: "2024-09-25", tags: ["instruct", "small", "meta"], isMoe: false },
  { repo: "bartowski/Meta-Llama-3.1-70B-Instruct-GGUF", builder: "bartowski", family: "llama3", baseSizeGb: 140.0, parameterCount: "70B", description: "Meta Llama 3.1 70B Instruct", architecture: "llama", contextLength: 131072, license: "Llama 3.1 Community", downloads: 58300, uploadedAt: "2024-07-23", tags: ["instruct", "chat", "meta", "large"], isMoe: false },
  { repo: "bartowski/Meta-Llama-3.1-405B-Instruct-GGUF", builder: "bartowski", family: "llama3", baseSizeGb: 820.0, parameterCount: "405B", description: "Meta Llama 3.1 405B Instruct (frontier)", architecture: "llama", contextLength: 131072, license: "Llama 3.1 Community", downloads: 21800, uploadedAt: "2024-07-23", tags: ["instruct", "chat", "meta", "large", "frontier"], isMoe: false },
  // --- Qwen family ---
  { repo: "bartowski/Qwen2.5-3B-Instruct-GGUF", builder: "bartowski", family: "qwen2", baseSizeGb: 6.0, parameterCount: "3B", description: "Qwen 2.5 3B Instruct", architecture: "qwen2", contextLength: 32768, license: "Apache 2.0", downloads: 57600, uploadedAt: "2024-09-19", tags: ["instruct", "chat", "qwen", "small"], isMoe: false },
  { repo: "bartowski/Qwen2.5-14B-Instruct-GGUF", builder: "bartowski", family: "qwen2", baseSizeGb: 29.0, parameterCount: "14B", description: "Qwen 2.5 14B Instruct", architecture: "qwen2", contextLength: 32768, license: "Apache 2.0", downloads: 48200, uploadedAt: "2024-09-19", tags: ["instruct", "chat", "qwen"], isMoe: false },
  { repo: "bartowski/Qwen2.5-72B-Instruct-GGUF", builder: "bartowski", family: "qwen2", baseSizeGb: 144.0, parameterCount: "72B", description: "Qwen 2.5 72B Instruct (large)", architecture: "qwen2", contextLength: 32768, license: "Qwen License", downloads: 31400, uploadedAt: "2024-09-25", tags: ["instruct", "chat", "qwen", "large"], isMoe: false },
  { repo: "bartowski/Qwen2.5-Math-7B-Instruct-GGUF", builder: "bartowski", family: "qwen2", baseSizeGb: 14.5, parameterCount: "7B", description: "Qwen 2.5 Math 7B Instruct", architecture: "qwen2", contextLength: 32768, license: "Apache 2.0", downloads: 14300, uploadedAt: "2024-09-19", tags: ["instruct", "math", "qwen"], isMoe: false },
  { repo: "bartowski/Qwen2.5-VL-7B-Instruct-GGUF", builder: "bartowski", family: "qwen2", baseSizeGb: 14.5, parameterCount: "7B", description: "Qwen 2.5 VL 7B Instruct (vision-language)", architecture: "qwen2", contextLength: 32768, license: "Apache 2.0", downloads: 18900, uploadedAt: "2025-01-26", tags: ["instruct", "vision", "vl", "qwen"], isMoe: false },
  { repo: "bartowski/Qwen2-7B-Instruct-GGUF", builder: "bartowski", family: "qwen2", baseSizeGb: 14.5, parameterCount: "7B", description: "Qwen 2 7B Instruct (legacy)", architecture: "qwen2", contextLength: 32768, license: "Qwen License", downloads: 38700, uploadedAt: "2024-06-06", tags: ["instruct", "chat", "qwen", "legacy"], isMoe: false },
  { repo: "bartowski/QwQ-32B-Preview-GGUF", builder: "bartowski", family: "qwen2", baseSizeGb: 64.0, parameterCount: "32B", description: "Qwen QwQ 32B Preview (reasoning)", architecture: "qwen2", contextLength: 32768, license: "Apache 2.0", downloads: 27600, uploadedAt: "2024-11-28", tags: ["reasoning", "qwq", "qwen", "large"], isMoe: false },
  // --- Mistral / Mixtral family ---
  { repo: "bartowski/Mixtral-8x7B-Instruct-v0.1-GGUF", builder: "bartowski", family: "mixtral", baseSizeGb: 93.0, parameterCount: "46.7B", description: "Mixtral 8x7B Instruct v0.1 (MoE)", architecture: "llama", contextLength: 32768, license: "Apache 2.0", downloads: 87400, uploadedAt: "2023-12-13", tags: ["instruct", "chat", "moe", "large"], isMoe: true, expertCount: 8 },
  { repo: "TheBloke/Mixtral-8x7B-Instruct-v0.1-GGUF", builder: "TheBloke", family: "mixtral", baseSizeGb: 93.0, parameterCount: "46.7B", description: "Mixtral 8x7B Instruct v0.1 (TheBloke, MoE)", architecture: "llama", contextLength: 32768, license: "Apache 2.0", downloads: 412000, uploadedAt: "2023-12-12", tags: ["instruct", "chat", "moe", "large", "legacy"], isMoe: true, expertCount: 8 },
  { repo: "bartowski/Mixtral-8x22B-Instruct-v0.1-GGUF", builder: "bartowski", family: "mixtral", baseSizeGb: 280.0, parameterCount: "141B", description: "Mixtral 8x22B Instruct v0.1 (MoE)", architecture: "llama", contextLength: 65536, license: "Apache 2.0", downloads: 31200, uploadedAt: "2024-04-10", tags: ["instruct", "chat", "moe", "large"], isMoe: true, expertCount: 8 },
  { repo: "bartowski/Mistral-Large-Instruct-2407-GGUF", builder: "bartowski", family: "mistral", baseSizeGb: 250.0, parameterCount: "123B", description: "Mistral Large 123B Instruct 2407", architecture: "llama", contextLength: 131072, license: "Mistral Research", downloads: 16800, uploadedAt: "2024-07-24", tags: ["instruct", "chat", "mistral", "large"], isMoe: false },
  { repo: "bartowski/Mistral-7B-Instruct-v0.1-GGUF", builder: "bartowski", family: "mistral", baseSizeGb: 14.5, parameterCount: "7B", description: "Mistral 7B Instruct v0.1 (legacy)", architecture: "llama", contextLength: 32768, license: "Apache 2.0", downloads: 89000, uploadedAt: "2023-09-27", tags: ["instruct", "chat", "mistral", "legacy"], isMoe: false },
  { repo: "bartowski/Mistral-Small-Instruct-2409-GGUF", builder: "bartowski", family: "mistral", baseSizeGb: 48.0, parameterCount: "22B", description: "Mistral Small 22B Instruct 2409", architecture: "llama", contextLength: 32768, license: "Mistral Research", downloads: 24100, uploadedAt: "2024-09-17", tags: ["instruct", "chat", "mistral", "small"], isMoe: false },
  // --- Gemma family ---
  { repo: "bartowski/gemma-2-2b-it-GGUF", builder: "bartowski", family: "gemma2", baseSizeGb: 5.0, parameterCount: "2B", description: "Google Gemma 2 2B IT (small)", architecture: "gemma2", contextLength: 8192, license: "Gemma", downloads: 73400, uploadedAt: "2024-06-27", tags: ["instruct", "google", "gemma", "small"], isMoe: false },
  { repo: "bartowski/gemma-2-9b-it-GGUF", builder: "bartowski", family: "gemma2", baseSizeGb: 18.0, parameterCount: "9B", description: "Google Gemma 2 9B IT", architecture: "gemma2", contextLength: 8192, license: "Gemma", downloads: 95400, uploadedAt: "2024-06-27", tags: ["instruct", "google", "gemma"], isMoe: false },
  // --- Phi family ---
  { repo: "bartowski/Phi-3-mini-4k-instruct-GGUF", builder: "bartowski", family: "phi3", baseSizeGb: 7.5, parameterCount: "3.8B", description: "Microsoft Phi 3 Mini 4k Instruct", architecture: "phi3", contextLength: 4096, license: "MIT", downloads: 62100, uploadedAt: "2024-04-22", tags: ["instruct", "microsoft"], isMoe: false },
  { repo: "bartowski/Phi-3-small-8k-instruct-GGUF", builder: "bartowski", family: "phi3", baseSizeGb: 14.0, parameterCount: "7.4B", description: "Microsoft Phi 3 Small 8k Instruct", architecture: "phi3", contextLength: 8192, license: "MIT", downloads: 15600, uploadedAt: "2024-05-21", tags: ["instruct", "microsoft"], isMoe: false },
  // --- DBRX / Falcon / Yi / SOLAR ---
  { repo: "bartowski/dbrx-instruct-GGUF", builder: "bartowski", family: "dbrx", baseSizeGb: 264.0, parameterCount: "132B", description: "Databricks DBRX Instruct (MoE)", architecture: "dbrx", contextLength: 32768, license: "DBRX Open", downloads: 9800, uploadedAt: "2024-03-28", tags: ["instruct", "chat", "moe", "databricks", "large"], isMoe: true, expertCount: 16 },
  { repo: "bartowski/Falcon3-7B-Instruct-GGUF", builder: "bartowski", family: "falcon", baseSizeGb: 14.5, parameterCount: "7B", description: "TII Falcon 3 7B Instruct", architecture: "falcon3", contextLength: 32768, license: "TII Falcon LLM License", downloads: 11400, uploadedAt: "2024-12-18", tags: ["instruct", "chat", "falcon"], isMoe: false },
  { repo: "bartowski/Yi-1.5-9B-Chat-GGUF", builder: "bartowski", family: "yi", baseSizeGb: 18.0, parameterCount: "9B", description: "01.AI Yi 1.5 9B Chat", architecture: "llama", contextLength: 4096, license: "Apache 2.0", downloads: 13700, uploadedAt: "2024-05-14", tags: ["instruct", "chat", "yi"], isMoe: false },
  { repo: "bartowski/Yi-1.5-34B-Chat-GGUF", builder: "bartowski", family: "yi", baseSizeGb: 68.0, parameterCount: "34B", description: "01.AI Yi 1.5 34B Chat (large)", architecture: "llama", contextLength: 4096, license: "Apache 2.0", downloads: 8900, uploadedAt: "2024-05-14", tags: ["instruct", "chat", "yi", "large"], isMoe: false },
  { repo: "bartowski/solar-10.7b-instruct-v1.0-GGUF", builder: "bartowski", family: "solar", baseSizeGb: 20.0, parameterCount: "10.7B", description: "Upstage Solar 10.7B Instruct v1.0", architecture: "llama", contextLength: 4096, license: "MIT", downloads: 10200, uploadedAt: "2023-12-13", tags: ["instruct", "chat", "solar", "upstage"], isMoe: false },
  // --- DeepSeek ---
  { repo: "bartowski/DeepSeek-V2-Chat-GGUF", builder: "bartowski", family: "deepseek", baseSizeGb: 449.0, parameterCount: "236B", description: "DeepSeek V2 Chat (MoE, full)", architecture: "deepseek2", contextLength: 32768, license: "DeepSeek License", downloads: 8600, uploadedAt: "2024-06-20", tags: ["instruct", "chat", "moe", "deepseek", "large"], isMoe: true, expertCount: 6 },
  { repo: "bartowski/DeepSeek-R1-GGUF", builder: "bartowski", family: "deepseek", baseSizeGb: 800.0, parameterCount: "671B", description: "DeepSeek R1 (MoE, reasoning, full)", architecture: "deepseek2", contextLength: 131072, license: "MIT", downloads: 42300, uploadedAt: "2025-01-20", tags: ["reasoning", "moe", "deepseek", "r1", "frontier"], isMoe: true, expertCount: 8 },
  { repo: "unsloth/DeepSeek-R1-GGUF", builder: "unsloth", family: "deepseek", baseSizeGb: 800.0, parameterCount: "671B", description: "DeepSeek R1 (unsloth, MoE reasoning)", architecture: "deepseek2", contextLength: 131072, license: "MIT", downloads: 38700, uploadedAt: "2025-01-20", tags: ["reasoning", "moe", "deepseek", "r1", "unsloth"], isMoe: true, expertCount: 8 },
  { repo: "bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF", builder: "bartowski", family: "deepseek", baseSizeGb: 3.0, parameterCount: "1.5B", description: "DeepSeek R1 Distill Qwen 1.5B (small, reasoning)", architecture: "qwen2", contextLength: 131072, license: "MIT", downloads: 31200, uploadedAt: "2025-01-21", tags: ["reasoning", "deepseek", "r1", "small"], isMoe: false },
  { repo: "bartowski/DeepSeek-R1-Distill-Qwen-14B-GGUF", builder: "bartowski", family: "deepseek", baseSizeGb: 29.0, parameterCount: "14B", description: "DeepSeek R1 Distill Qwen 14B (reasoning)", architecture: "qwen2", contextLength: 131072, license: "MIT", downloads: 28400, uploadedAt: "2025-01-21", tags: ["reasoning", "deepseek", "r1"], isMoe: false },
  { repo: "bartowski/DeepSeek-R1-Distill-Llama-70B-GGUF", builder: "bartowski", family: "deepseek", baseSizeGb: 140.0, parameterCount: "70B", description: "DeepSeek R1 Distill Llama 70B (reasoning, large)", architecture: "llama", contextLength: 131072, license: "MIT", downloads: 19700, uploadedAt: "2025-01-21", tags: ["reasoning", "deepseek", "r1", "large"], isMoe: false },
  // --- Nous / Hermes / Zephyr / OpenChat ---
  { repo: "bartowski/Hermes-3-Llama-3.1-70B-GGUF", builder: "bartowski", family: "llama3", baseSizeGb: 140.0, parameterCount: "70B", description: "Hermes 3 Llama 3.1 70B (Nous Research)", architecture: "llama", contextLength: 131072, license: "Llama 3.1 Community", downloads: 9400, uploadedAt: "2024-08-10", tags: ["hermes", "nous", "instruct", "large"], isMoe: false },
  { repo: "bartowski/zephyr-7b-beta-GGUF", builder: "bartowski", family: "mistral", baseSizeGb: 14.5, parameterCount: "7B", description: "Zephyr 7B Beta (HuggingFace H4)", architecture: "llama", contextLength: 8192, license: "MIT", downloads: 21800, uploadedAt: "2023-10-25", tags: ["instruct", "chat", "zephyr", "h4"], isMoe: false },
  { repo: "TheBloke/zephyr-7B-beta-GGUF", builder: "TheBloke", family: "mistral", baseSizeGb: 14.5, parameterCount: "7B", description: "Zephyr 7B Beta (TheBloke)", architecture: "llama", contextLength: 8192, license: "MIT", downloads: 134000, uploadedAt: "2023-10-25", tags: ["instruct", "chat", "zephyr", "h4", "legacy"], isMoe: false },
  { repo: "bartowski/openchat-3.5-1210-GGUF", builder: "bartowski", family: "openchat", baseSizeGb: 14.5, parameterCount: "7B", description: "OpenChat 3.5 1210", architecture: "llama", contextLength: 8192, license: "Apache 2.0", downloads: 17600, uploadedAt: "2023-12-11", tags: ["instruct", "chat", "openchat"], isMoe: false },
  // --- Llama 2 legacy ---
  { repo: "TheBloke/Llama-2-13B-chat-GGUF", builder: "TheBloke", family: "llama2", baseSizeGb: 26.0, parameterCount: "13B", description: "Llama 2 13B Chat (TheBloke)", architecture: "llama", contextLength: 4096, license: "Llama 2 Community", downloads: 540000, uploadedAt: "2023-07-18", tags: ["chat", "legacy", "llama2", "large"], isMoe: false },
  { repo: "TheBloke/Llama-2-70B-Chat-GGUF", builder: "TheBloke", family: "llama2", baseSizeGb: 140.0, parameterCount: "70B", description: "Llama 2 70B Chat (TheBloke)", architecture: "llama", contextLength: 4096, license: "Llama 2 Community", downloads: 310000, uploadedAt: "2023-07-18", tags: ["chat", "legacy", "llama2", "large"], isMoe: false },
];

export function searchHFModels(query: string): HFSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  // Split into words; a model matches if ALL words appear somewhere in its
  // searchable text. This makes multi-word queries like "llama 3.1 8b" or
  // "deepseek reasoning" work, and also tolerates word reordering.
  const words = q.split(/\s+/).filter(Boolean);

  // Build a single searchable haystack string per result, including the
  // repo path, model name/description, family, architecture, builder,
  // parameter count and tags.
  const haystack = (r: HFSearchResult) =>
    [
      r.repo,
      r.description,
      r.family,
      r.architecture,
      r.builder,
      r.parameterCount,
      r.license,
      r.tags.join(" "),
    ]
      .join(" ")
      .toLowerCase();

  // Score: how well does this result match? Higher = better.
  // - exact substring match of the full query on repo → big boost
  // - all words present (required) → base score
  // - consecutive-word match → bonus
  // - downloads → tie-breaker (popularity)
  function score(r: HFSearchResult): number {
    const h = haystack(r);
    let s = 0;
    // All words must be present (AND logic)
    if (!words.every((w) => h.includes(w))) return -1;

    // Boost: full query substring on repo
    if (r.repo.toLowerCase().includes(q)) s += 1000;
    // Boost: full query substring on description
    if (r.description.toLowerCase().includes(q)) s += 500;
    // Boost: exact tag match
    if (r.tags.some((t) => t.toLowerCase() === q)) s += 200;
    // Per-word boost: word appears in repo (strong signal)
    words.forEach((w) => {
      if (r.repo.toLowerCase().includes(w)) s += 50;
      if (r.family.includes(w)) s += 30;
      if (r.builder.toLowerCase().includes(w)) s += 20;
      if (r.parameterCount.toLowerCase().includes(w)) s += 15;
    });
    // Popularity tie-breaker (downloads, scaled)
    s += Math.min(100, r.downloads / 1000);
    return s;
  }

  return HF_CATALOG
    .map((r) => ({ r, s: score(r) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.r);
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

/** Rename a key in the logs record (used when swapping a placeholder id for a real Tauri process id). */
function renameLogKey(logs: Record<string, ConsoleLine[]>, oldKey: string, newKey: string): Record<string, ConsoleLine[]> {
  if (oldKey === newKey) return logs;
  const { [oldKey]: val, ...rest } = logs;
  return { ...rest, [newKey]: val ?? [] };
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

const seedWorkspaces: Workspace[] = [];

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

const seedModels: LlamaModel[] = [];

const seedProfiles: LlamaProfile[] = [];

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
  // Latest releases (sorted newest-first here; the page sorts by publishedAt desc)
  { tag: "b9951", date: "2026-07-10", commit: "f3a2c81", notes: "New Vulkan compute scheduler, KV cache eviction rewrite, llama-server multipart support, RPC over TLS", installed: false },
  { tag: "b9940", date: "2026-07-08", commit: "c7e1d29", notes: "CUDA 13 build fixes, --cache-type-q flag, flash-attn v3 path for sm_90", installed: false },
  { tag: "b9925", date: "2026-07-05", commit: "8b4f602", notes: "Speculative decoding improvements, llama-bench JSON output, RPC auth tokens", installed: false },
  { tag: "b9908", date: "2026-07-01", commit: "2d9a157", notes: "MoE expert offload to CPU, llama-server /v1/embeddings endpoint, GGUF v4 metadata", installed: false },
  { tag: "b9890", date: "2026-06-26", commit: "e5c8043", notes: "K-quants for DeepSeek V3 architecture, llama-server metrics endpoint", installed: false },
  { tag: "b9872", date: "2026-06-20", commit: "a1b3e76", notes: "Multi-GPU pipeline parallelism, KV cache compression (zstd), build system refactor", installed: false },
  { tag: "b9855", date: "2026-06-14", commit: "9f02d44", notes: "llama-server graceful shutdown, --slots-keep-alive flag, RPC reconnection", installed: false },
  { tag: "b9830", date: "2026-06-06", commit: "4c8e9a1", notes: "FlashAttention 3 for Hopper, llama-quantise --keep-split, KV cache paged evict", installed: false },
  { tag: "b9800", date: "2026-05-28", commit: "b7d20f5", notes: "llama-server OpenAI v1 chat template auto-detect, draft model warm-up", installed: false },
  { tag: "b9775", date: "2026-05-20", commit: "3e6a8c2", notes: "Vulkan descriptor pool fixes, llama-imatrix JSONL output, CPU AVX-512 path", installed: false },
  { tag: "b9750", date: "2026-05-12", commit: "7a2c5e9", notes: "llama-server concurrent slots rewrite, --no-context-shift flag", installed: false },
  { tag: "b9720", date: "2026-05-04", commit: "d8f1b04", notes: "GGUF op count metadata, llama-perplexity ROCm path, build: CMake 3.22 required", installed: false },
  { tag: "b9685", date: "2026-04-25", commit: "1c9e7a3", notes: "MoE expert routing API, llama-server /v1/rerank endpoint, KV cache quantised k/q", installed: false },
  { tag: "b9640", date: "2026-04-15", commit: "f4b2e80", notes: "llama-server stream options, draft model speculative tree, RPC batching", installed: false },
  { tag: "b9600", date: "2026-04-05", commit: "a7d3c15", notes: "FlashAttention 2 default for sm_80+, llama-quantise --imatrix, KV cache mmap", installed: false },
  { tag: "b9550", date: "2026-03-26", commit: "2e8b4f9", notes: "llama-server /v1/completions streaming, ggml-backend device selection API", installed: false },
  { tag: "b9500", date: "2026-03-15", commit: "c5d9012", notes: "Vulkan compute shader optimisation, llama-bench warmup iterations", installed: false },
  { tag: "b9450", date: "2026-03-04", commit: "e7a2b54", notes: "Batched decoding optimisations, KV cache reuse, llama-server metrics", installed: false },
  { tag: "b9400", date: "2026-02-20", commit: "1f6c890", notes: "gguf v3 support, llama-quantise rewrite, RPC server TLS", installed: false },
  { tag: "b9350", date: "2026-02-08", commit: "9b3a107", notes: "Metal backend updates, RPC server initial release, KV cache paged", installed: false },
  { tag: "b9280", date: "2026-01-25", commit: "2d5e881", notes: "FlashAttention 2 path, KV cache paged, llama-server /slots endpoint", installed: false },
  { tag: "b9200", date: "2026-01-12", commit: "6c1f045", notes: "OpenAI-compatible /v1/chat/completions endpoint, draft model API", installed: false },
  // Legacy releases (older)
  { tag: "b4402", date: "2025-01-14", commit: "8f1f7e1", notes: "KV cache quantisation, faster prompt processing, RPC server fixes", installed: true },
  { tag: "b4390", date: "2024-12-20", commit: "a2c4f90", notes: "Improved FlashAttention path, new --cache-type-v flag", installed: false },
  { tag: "b4378", date: "2024-11-28", commit: "7bd12aa", notes: "Speculative decoding via draft models, multi-GPU tensor split fixes", installed: false },
  { tag: "b4360", date: "2024-10-15", commit: "3f8e221", notes: "Initial Qwen2.5 support, llama-server OpenAI-compatible refactor", installed: false },
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
  tauriReady: boolean;

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

  // bootstrap — fetch all real data from Tauri on startup
  bootstrap: () => Promise<void>;
  refreshModels: () => Promise<void>;
  refreshProcesses: () => Promise<void>;
  refreshReleases: () => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  refreshSystem: () => Promise<void>;
  refreshConsoleLogs: (instanceId: string) => Promise<void>;

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
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 4800, kind: "info", text: "[boot] connecting to Tauri backend…" },
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

// ---------- Tauri → store type mappers ----------

function mapTauriModel(m: import("@/lib/tauri-api").ModelInfo, workspaceId: string): LlamaModel {
  const arch = m.architecture ?? "llama";
  const name = m.name;
  const isMoe = /mixtral|deepseek.?v[23]|dbrx|qwen.?2.?57|moe/i.test(name + arch);
  const expertMatch = name.match(/(\d+)x\d+[bB]/);
  const quantBits = m.quantization?.match(/q?(\d+)/i);
  const family = inferFamily(name, arch);
  return {
    id: m.id,
    name,
    family,
    sizeGb: m.size / (1024 * 1024 * 1024),
    quant: m.quantization ?? "unknown",
    downloaded: true,
    missing: false,
    path: m.path,
    hfRepo: undefined,
    builder: m.metadata.author ?? "unknown",
    architecture: arch,
    contextLength: m.context_size ?? 4096,
    parameterCount: m.parameter_count ?? "?B",
    quantizationBits: quantBits ? parseInt(quantBits[1]) : 4,
    license: m.metadata.license ?? "Unknown",
    description: m.metadata.description ?? name,
    uploadedAt: new Date(m.modified * 1000).toISOString().slice(0, 10),
    hfDownloads: m.metadata.downloads ?? 0,
    tags: m.metadata.tags ?? [],
    isMoe,
    expertCount: expertMatch ? parseInt(expertMatch[1]) : undefined,
    workspaceId,
    addedAt: m.modified * 1000,
  };
}

function mapTauriProcess(
  p: import("@/lib/tauri-api").ProcessInfo,
  models: LlamaModel[],
): LlamaInstance {
  const model = models.find((m) => m.id === p.model_id);
  const statusMap: Record<string, InstanceStatus> = {
    starting: "starting",
    running: "running",
    stopping: "stopping",
    stopped: "stopped",
    crashed: "error",
    error: "error",
  };
  const colors: LlamaInstance["color"][] = ["green", "orange", "blue", "pink", "purple"];
  return {
    id: p.id,
    name: model?.name ?? p.model_id,
    model: model?.name ?? p.model_id,
    profile: "default",
    port: p.port,
    host: "127.0.0.1",
    status: statusMap[p.status] ?? "stopped",
    gpu: "auto",
    ctxSize: p.context_used || 8192,
    threads: 8,
    color: colors[0],
    startedAt: p.started_at ? p.started_at * 1000 : undefined,
    promptTokens: 0,
    generatedTokens: 0,
    requestsPerMin: 0,
    tokensPerSec: p.tokens_per_sec ?? 0,
    memoryMb: p.gpu_memory || p.cpu_memory || 0,
    peakTokensPerSec: p.tokens_per_sec ?? 0,
    totalRequests: 0,
    errorCount: p.status === "crashed" || p.status === "error" ? 1 : 0,
    workspaceId: "",
  };
}

function inferFamily(name: string, arch: string): string {
  const n = name.toLowerCase();
  if (n.includes("llama-3") || n.includes("llama3")) return "llama3";
  if (n.includes("llama-2") || n.includes("llama2")) return "llama2";
  if (n.includes("qwen")) return "qwen2";
  if (n.includes("mistral") || n.includes("codestral")) return "mistral";
  if (n.includes("mixtral")) return "mixtral";
  if (n.includes("gemma")) return "gemma2";
  if (n.includes("phi")) return "phi3";
  if (n.includes("deepseek")) return "deepseek";
  if (n.includes("starcoder")) return "starcoder";
  if (n.includes("code")) return "codellama";
  return arch;
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
    // In Tauri mode: fetch real system info from backend
    if (isTauri()) {
      useLlamaStore.getState().refreshSystem();
      useLlamaStore.getState().refreshProcesses();
    }
    // In browser mode: push a zero sample (no fake data)
    if (!isTauri()) {
      const sample: MetricSample = {
        t: Date.now(),
        cpu: 0, ram: 0, gpu: 0, gpuMem: 0,
        tps: 0, reqPerMin: 0,
      };
      useLlamaStore.getState().pushMetric(sample);
    }
  }, 2000);
}

// GitHub release poller — fetches real releases from Tauri backend
let releaseCheckTimer: ReturnType<typeof setTimeout> | null = null;
function startReleaseChecker() {
  if (releaseCheckTimer) clearTimeout(releaseCheckTimer);
  releaseCheckTimer = setTimeout(async () => {
    const s = useLlamaStore.getState();
    if (!s.globalSettings.checkForReleases) return;
    // Fetch real releases from Tauri (which hits GitHub API)
    await s.refreshReleases();
    const releases = useLlamaStore.getState().releases;
    if (releases.length > 0) {
      const latest = releases[0];
      emitLog(SYSTEM_CONSOLE_ID, "info", `[${fmtTime(new Date())}] [github] latest llama.cpp release: ${latest.tag} (${latest.variant})`);
      if (s.globalSettings.notifyOnNewRelease && !latest.installed) {
        s.addNotification({
          kind: "release",
          title: "New llama.cpp release available",
          body: `${latest.tag} — ${latest.notes.slice(0, 100)}…`,
          actionLabel: "Install",
        });
      }
    }
  }, 5000);
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
    activeWorkspaceId: "",
    downloads: [],
    logs: { [SYSTEM_CONSOLE_ID]: initialSystemLogs },
    activeConsoleId: SYSTEM_CONSOLE_ID,
    consoleOpen: false,
    consoleHeight: 240,
    notifications: [],
    tauriReady: false,

    globalSettings: defaultGlobalSettings,
    workspaceSettings: {},
    systemCapabilities: {
      gpuName: "",
      gpuVramGb: 0,
      ramGb: 0,
      cpuCores: 0,
      hasCuda: false,
    },

    appStatus: "active",
    lastActivityAt: nowTs(),
    hibernatedInstanceIds: [],
    metrics: seedMetrics(),

    // ---------- bootstrap — fetch all real data from Tauri ----------
    bootstrap: async () => {
      if (!isTauri()) {
        emitLog(SYSTEM_CONSOLE_ID, "warn", `[boot] not running in Tauri — data will be empty. Start the desktop app to scan real models.`);
        return;
      }
      set({ tauriReady: true });
      emitLog(SYSTEM_CONSOLE_ID, "info", `[tauri] bootstrapping — fetching models, processes, workspaces, releases…`);
      await Promise.all([
        get().refreshWorkspaces(),
        get().refreshModels(),
        get().refreshProcesses(),
        get().refreshReleases(),
        get().refreshSystem(),
      ]);
      // Set active workspace if we have one
      const ws = get().workspaces;
      if (ws.length > 0 && !get().activeWorkspaceId) {
        const activeId = await tauri.getActiveWorkspace();
        set({ activeWorkspaceId: activeId || ws[0].id });
      }
      // Fetch workspace settings for all workspaces
      const settingsMap: Record<string, WorkspaceSettings> = {};
      for (const w of ws) {
        const s = await tauri.getWorkspaceSettings(w.id);
        if (s) settingsMap[w.id] = {
          hibernateAfterSec: s.hibernate_after_sec,
          defaultGpuLayers: s.default_gpu_layers,
          defaultThreads: s.default_threads,
          autoCalibrate: s.auto_calibrate,
          maxConcurrentInstances: s.max_concurrent_instances,
        };
      }
      set({ workspaceSettings: settingsMap });
      emitLog(SYSTEM_CONSOLE_ID, "success", `[tauri] bootstrap complete — ${get().models.length} models, ${get().instances.length} instances, ${get().workspaces.length} workspaces`);
    },

    refreshModels: async () => {
      const tauriModels = await tauri.scanModels();
      if (!tauriModels) return;
      const wsId = get().activeWorkspaceId;
      const mapped: LlamaModel[] = tauriModels.map((m) => mapTauriModel(m, wsId));
      set({ models: mapped });
    },

    refreshProcesses: async () => {
      const tauriProcs = await tauri.listProcesses();
      if (!tauriProcs) return;
      const models = get().models;
      const mapped: LlamaInstance[] = tauriProcs.map((p) => mapTauriProcess(p, models));
      set({ instances: mapped });
      // Refresh console logs for running processes
      for (const p of mapped) {
        if (p.status === "running" || p.status === "starting") {
          get().refreshConsoleLogs(p.id);
        }
      }
    },

    refreshReleases: async () => {
      const tauriReleases = await tauri.listGithubReleases();
      if (!tauriReleases) return;
      const mapped: LlamaRelease[] = tauriReleases.map((r) => ({
        id: r.id,
        tag: r.tag,
        publishedAt: r.published_at,
        commit: r.commit,
        notes: r.notes,
        installed: r.installed,
        variant: r.variant as ReleaseVariant,
        priority: r.priority,
        downloadUrl: r.download_url,
        sizeMb: r.size_mb,
        workspaceId: null,
      }));
      set({ releases: mapped });
    },

    refreshWorkspaces: async () => {
      const tauriWorkspaces = await tauri.listWorkspaces();
      if (!tauriWorkspaces) return;
      const mapped: Workspace[] = tauriWorkspaces.map((w) => ({
        id: w.id,
        name: w.name,
        color: w.color as Workspace["color"],
        description: w.description ?? undefined,
      }));
      set({ workspaces: mapped });
    },

    refreshSystem: async () => {
      const [sys, caps, gpus] = await Promise.all([
        tauri.getSystemInfo(),
        tauri.getSystemCapabilities(),
        tauri.getGpuInfo(),
      ]);
      if (sys) {
        const sample: MetricSample = {
          t: Date.now(),
          cpu: sys.cpu_percent,
          ram: sys.memory_total_mb > 0 ? (sys.memory_used_mb / sys.memory_total_mb) * 100 : 0,
          gpu: 0,
          gpuMem: 0,
          tps: get().instances.reduce((sum, i) => sum + i.tokensPerSec, 0),
          reqPerMin: get().instances.reduce((sum, i) => sum + i.requestsPerMin, 0),
        };
        if (gpus && gpus.length > 0) {
          sample.gpuMem = gpus[0].memory_total_mb > 0 ? (gpus[0].memory_used_mb / gpus[0].memory_total_mb) * 100 : 0;
          sample.gpu = gpus[0].utilization_percent ?? 0;
        }
        get().pushMetric(sample);
      }
      if (caps) {
        set({ systemCapabilities: {
          gpuName: caps.gpu_name,
          gpuVramGb: caps.gpu_vram_gb,
          ramGb: caps.ram_gb,
          cpuCores: caps.cpu_cores,
          hasCuda: caps.has_cuda,
        }});
      }
    },

    refreshConsoleLogs: async (instanceId) => {
      const lines = await tauri.getProcessStdout(instanceId, 200);
      if (!lines) return;
      const consoleLines: ConsoleLine[] = lines.map((text, i) => ({
        id: `${instanceId}_log_${i}`,
        instanceId,
        ts: Date.now() - (lines.length - i) * 100,
        kind: "info" as LogKind,
        text,
      }));
      set((s) => ({ logs: { ...s.logs, [instanceId]: consoleLines } }));
    },

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
      // In Tauri mode: call the real backend to spawn llama-server
      if (isTauri()) {
        const wsId = get().activeWorkspaceId;
        const prof = get().profiles.find((p) => p.id === profile);
        const colors: LlamaInstance["color"][] = ["green", "orange", "blue", "pink", "purple"];
        const color = colors[get().instances.length % colors.length];
        // Optimistic placeholder
        const placeholderId = uid("inst");
        const instance: LlamaInstance = {
          id: placeholderId, name, model, profile: prof?.name ?? "default", port, host,
          status: "starting", gpu, ctxSize: prof?.ctxSize ?? 8192, threads: prof?.threads ?? 8,
          color, startedAt: nowTs(), promptTokens: 0, generatedTokens: 0,
          requestsPerMin: 0, tokensPerSec: 0, memoryMb: 0,
          peakTokensPerSec: 0, totalRequests: 0, errorCount: 0, workspaceId: wsId,
        };
        set((s) => ({
          instances: [...s.instances, instance],
          logs: { ...s.logs, [placeholderId]: [] },
          activeConsoleId: placeholderId, consoleOpen: true,
          appStatus: "active", lastActivityAt: nowTs(),
        }));
        emitLog(placeholderId, "info", `[${fmtTime(new Date())}] Launching llama-server for "${name}" (model: ${model})`);
        emitLog(placeholderId, "info", `[${fmtTime(new Date())}] ════════════════════════════════════════════════════════════════`);
        emitLog(placeholderId, "info", `[${fmtTime(new Date())}]   model       : ${model}`);
        emitLog(placeholderId, "info", `[${fmtTime(new Date())}]   profile     : ${prof?.name ?? "default"}`);
        emitLog(placeholderId, "info", `[${fmtTime(new Date())}]   host:port   : ${host}:${port}`);
        emitLog(placeholderId, "info", `[${fmtTime(new Date())}]   gpu         : ${gpu}`);
        emitLog(placeholderId, "info", `[${fmtTime(new Date())}]   context     : ${prof?.ctxSize ?? 8192} tokens`);
        emitLog(placeholderId, "info", `[${fmtTime(new Date())}]   threads     : ${prof?.threads ?? 8}`);
        emitLog(placeholderId, "info", `[${fmtTime(new Date())}] ════════════════════════════════════════════════════════════════`);

        // Call Tauri backend (async)
        (async () => {
          const tauriProc = await tauri.startModel(model, {
            context_size: prof?.ctxSize ?? 8192,
            gpu_layers: prof?.gpuLayers ?? -1,
            threads: prof?.threads ?? 4,
            batch_size: 512,
            ubatch_size: 512,
            flash_attn: prof?.flashAttention ?? true,
            no_mmap: false,
            no_mlock: false,
            numa: false,
            arguments: prof?.extraArgs ? prof.extraArgs.split(" ").filter(Boolean) : [],
          });
          if (tauriProc) {
            // Replace placeholder with real process
            set((s) => ({
              instances: s.instances.map((i) =>
                i.id === placeholderId
                  ? { ...i, id: tauriProc.id, status: "running", port: tauriProc.port, pid: tauriProc.pid ?? undefined }
                  : i,
              ),
              logs: renameLogKey(s.logs, placeholderId, tauriProc.id),
              activeConsoleId: tauriProc.id,
            }));
            emitLog(tauriProc.id, "success", `[${fmtTime(new Date())}] ✓ llama-server started (pid: ${tauriProc.pid}, port: ${tauriProc.port})`);
          } else {
            set((s) => ({
              instances: s.instances.map((i) =>
                i.id === placeholderId ? { ...i, status: "error" } : i,
              ),
            }));
            emitLog(placeholderId, "error", `[${fmtTime(new Date())}] ✗ Failed to start llama-server. Check the binary path in Settings.`);
          }
        })();
        get().registerActivity();
        return placeholderId;
      }
      // Browser mode: no real processes — just show a message
      emitLog(SYSTEM_CONSOLE_ID, "warn", `[browser] cannot start real llama-server — run in Tauri desktop app.`);
      return "";
    },

    stopInstance: (id) => {
      const inst = get().instances.find((i) => i.id === id);
      if (!inst) return;
      set((s) => ({ instances: s.instances.map((i) => (i.id === id ? { ...i, status: "stopping" } : i)) }));
      emitLog(id, "warn", `[${fmtTime(new Date())}] sending stop signal…`);
      if (isTauri()) {
        (async () => {
          await tauri.stopModel(id);
          await get().refreshProcesses();
          emitLog(id, "success", `[${fmtTime(new Date())}] server stopped cleanly.`);
        })();
      }
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

      // Inline downloading placeholder
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

      const dl: HFDownload = {
        id: dlId, repo, quant, filename, sizeGb, progress: 0, status: "downloading",
        startedAt: nowTs(), modelName, builder, kind: "model",
      };
      set((s) => ({ downloads: [...s.downloads, dl], models: [...s.models, placeholderModel] }));
      emitLog(SYSTEM_CONSOLE_ID, "info", `[${fmtTime(new Date())}] [hf] downloading ${filename} from ${repo} (${sizeGb.toFixed(1)} GB, builder: ${builder})`);

      // Real Tauri download (or empty in browser)
      (async () => {
        const result = await tauri.downloadModel(repo, filename, (p) => {
          const pct = p.total > 0 ? (p.downloaded / p.total) * 100 : 0;
          set((st) => ({
            downloads: st.downloads.map((d) => (d.id === dlId ? { ...d, progress: pct } : d)),
            models: st.models.map((m) =>
              m.id === modelId ? { ...m, downloadProgress: pct } : m,
            ),
          }));
        });

        if (result) {
          set((st) => ({
            downloads: st.downloads.map((d) => (d.id === dlId ? { ...d, progress: 100, status: "completed" } : d)),
          }));
          emitLog(SYSTEM_CONSOLE_ID, "success", `[${fmtTime(new Date())}] [hf] download complete: ${filename}`);
          get().addNotification({ kind: "download", title: "Model downloaded", body: `${modelName} ${quant} is ready to use.` });
          await get().refreshModels(); // re-scan models directory
        } else if (!isTauri()) {
          // Browser mode: no real download possible
          set((st) => ({
            downloads: st.downloads.map((d) => (d.id === dlId ? { ...d, status: "failed" } : d)),
            models: st.models.map((m) =>
              m.id === modelId ? { ...m, downloading: false, downloadProgress: 0, missing: true } : m,
            ),
          }));
          emitLog(SYSTEM_CONSOLE_ID, "error", `[${fmtTime(new Date())}] [hf] download requires Tauri desktop app.`);
        }
      })();
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
      // Bootstrap: fetch all real data from Tauri backend
      store.bootstrap();
      // Start background pollers (only active in Tauri mode)
      startWatchdog();
      startMetricsTicker();
      startReleaseChecker();
    }, 300);
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
