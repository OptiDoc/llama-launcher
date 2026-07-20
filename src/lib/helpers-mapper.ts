/**
 * Tauri → store type mappers.
 */

import type { ModelInfo, ProcessInfo } from "@/lib/tauri-api";
import type { LlamaModel, LlamaInstance, InstanceStatus } from "@/lib/types";
import { inferFamily } from "./helpers-infer";

export function mapTauriModel(m: ModelInfo, workspaceId: string): LlamaModel {
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
    downloading: false,
    downloadProgress: 0,
    path: m.path,
    hfRepo: undefined,
    builder: m.metadata?.author ?? "unknown",
    architecture: arch,
    contextLength: m.context_size ?? 4096,
    parameterCount: m.parameter_count ?? "?B",
    quantizationBits: quantBits ? parseInt(quantBits[1]) : 4,
    license: m.metadata?.license ?? "Unknown",
    description: m.metadata?.description ?? name,
    uploadedAt: new Date(m.modified * 1000).toISOString().slice(0, 10),
    hfDownloads: m.metadata?.downloads ?? 0,
    tags: m.metadata?.tags ?? [],
    isMoe,
    expertCount: expertMatch ? parseInt(expertMatch[1]) : undefined,
    workspaceId,
    addedAt: m.modified * 1000,
  };
}

export function mapTauriProcess(p: ProcessInfo, models: LlamaModel[]): LlamaInstance {
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
    startedAt: p.started_at ? p.started_at * 1000 : 0,
    promptTokens: 0,
    generatedTokens: 0,
    requestsPerMin: 0,
    tokensPerSec: p.tokens_per_sec ?? 0,
    memoryMb: p.gpu_memory || p.cpu_memory || 0,
    peakTokensPerSec: p.tokens_per_sec ?? 0,
    totalRequests: 0,
    errorCount: p.status === "crashed" || p.status === "error" ? 1 : 0,
    workspaceId: "",
    metrics: null,
    log: [],
    hibernatedConfig: null,
  };
}
