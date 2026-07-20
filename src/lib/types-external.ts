/**
 * External model types — ExternalModelSource, ExternalModelFile, ExternalModelDir.
 */

export type ExternalModelSource = "ollama" | "lmstudio" | "huggingfacecli" | "custom";

export interface ExternalModelFile {
  id: string;
  filename: string;
  path: string;
  size_mb: number;
  format: string;
  estimated_parameters: string | null;
  quantization: string | null;
}

export interface ExternalModelDir {
  id: string;
  source: ExternalModelSource;
  display_name: string;
  path: string;
  model_count: number;
  total_size_mb: number;
  enabled: boolean;
  files: ExternalModelFile[];
}
