/**
 * HF search catalog types.
 */

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
