/**
 * Model types — ModelInfo, ModelFormat, ModelMetadata.
 */

export type ModelFormat = "gguf" | "ggml" | "pytorch" | "safetensors" | "onnx" | "tensorrt" | "other";

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

export interface LlamaModel {
  id: string;
  name: string;
  family: string;
  sizeGb: number;
  quant: string;
  downloaded: boolean;
  missing: boolean;
  downloading: boolean;
  downloadProgress: number;
  downloadId?: string;
  path: string;
  hfRepo?: string;
  builder: string;
  architecture: string;
  contextLength: number;
  parameterCount: string;
  quantizationBits: number;
  license: string;
  description: string;
  uploadedAt: string;
  hfDownloads: number;
  tags: string[];
  isMoe: boolean;
  expertCount?: number;
  workspaceId: string;
  addedAt: number;
  context?: number;
  embedding?: number;
  params?: number;
  type?: string;
  format?: string;
  tokenizer?: string;
  created?: string;
  modified?: string;
  fileSize?: number;
  hfUrl?: string;
  repoUrl?: string;
}
