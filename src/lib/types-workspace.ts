/**
 * Workspace types — Workspace, WorkspaceSettings.
 */

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

// Aliases for camelCase access
export type WorkspaceSettingsCamel = {
  hibernateAfterSec: number;
  defaultGpuLayers: number;
  defaultThreads: number;
  autoCalibrate: boolean;
  maxConcurrentInstances: number;
};

export type ProfileScope = "global" | "model";

export interface LlamaProfile {
  id: string;
  name: string;
  description: string;
  scope: ProfileScope;
  modelId: string;
  ctxSize: string;
  contextSize?: number;
  threads: string;
  gpuLayers: string;
  flashAttention: boolean;
  port: string;
  host: string;
  parallel: string;
  contBatching: boolean;
  nPredict: string;
  timeout: string;
  metrics: boolean;
  apiKey: string;
  threadsBatch: string;
  batchSize: string;
  ubatchSize: string;
  cacheTypeK: string;
  cacheTypeV: string;
  splitMode: string;
  tensorSplit: string;
  mainGpu: string;
  kvOffload: boolean;
  fit: boolean;
  mmap: boolean;
  mlock: boolean;
  numa: boolean;
  temperature: string;
  topK: string;
  topP: string;
  minP: string;
  repeatPenalty: string;
  repeatLastN: string;
  presencePenalty: string;
  frequencyPenalty: string;
  seed: string;
  lora: string;
  mmproj: string;
  jinja: boolean;
  reasoningFormat: string;
  reasoningBudget: string;
  chatTemplate: string;
  ropeScaling: string;
  ropeScale: string;
  ropeFreqBase: string;
  ropeFreqScale: string;
  grammar: string;
  jsonSchema: string;
  logLevel: string;
  extraArgs: string;
  createdAt: number;
  updatedAt: number;
  workspaceId?: string;
  shared?: boolean;
  shareId?: string;
  calibrationScore?: number;
}

export const SYSTEM_CONSOLE_ID = "__system__";

export type ViewMode = "grid" | "list" | "table";

export const defaultWorkspaceSettings: WorkspaceSettings = {
  hibernate_after_sec: 0,
  default_gpu_layers: 99,
  default_threads: 8,
  auto_calibrate: true,
  max_concurrent_instances: 4,
};
