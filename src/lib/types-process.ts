/**
 * Process types — ProcessConfig, ProcessInfo, ProcessMetrics.
 */

export type ProcessStatus = "starting" | "running" | "stopping" | "stopped" | "crashed" | "error";

export type AppStatus = "active" | "hibernating" | "hibernated" | "idle";

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
  port: number;
  host: string;
  parallel: number;
  cont_batching: boolean;
  n_predict: number;
  timeout: number;
  metrics: boolean;
  api_key: string;
  threads_batch: number;
  cache_type_k: string;
  cache_type_v: string;
  split_mode: string;
  tensor_split: string;
  main_gpu: number;
  kv_offload: boolean;
  fit: boolean;
  temperature: number;
  top_k: number;
  top_p: number;
  min_p: number;
  repeat_penalty: number;
  repeat_last_n: number;
  presence_penalty: number;
  frequency_penalty: number;
  seed: number;
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

export type InstanceStatus = ProcessStatus;

export interface LlamaInstance {
  id: string;
  name: string;
  model: string;
  profile: string;
  port: number;
  host: string;
  gpu: string;
  status: InstanceStatus;
  metrics: ProcessMetrics | null;
  startedAt: number;
  log: string[];
  color: string;
  workspaceId: string;
  ctxSize: number;
  threads: number;
  memoryMb: number;
  tokensPerSec: number;
  requestsPerMin: number;
  promptTokens: number;
  generatedTokens: number;
  peakTokensPerSec: number;
  totalRequests: number;
  errorCount: number;
  hibernatedConfig: { name: string; model: string; profile: string; port: number; host: string; gpu: string } | null;
}

export interface InstancesSlice {
  stopInstance: (id: string) => Promise<void>;
  removeInstance: (id: string) => void;
  markRunning: (id: string) => void;
  markStopped: (id: string) => void;
  bumpStats: (id: string, prompt: number, gen: number, tps: number) => void;
  refreshConsoleLogs: (id: string) => Promise<void>;
}

export interface ConsoleLine {
  id: string;
  instanceId: string;
  ts: number;
  kind: LogKind;
  text: string;
}

export type LogKind = "info" | "warn" | "error" | "system" | "success" | "debug";

// Alias for backward compatibility
export type { ConsoleLine as LogEntry };
