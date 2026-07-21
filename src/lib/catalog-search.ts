/**
 * HF search — queries HuggingFace API for GGUF models.
 */

import type { HFSearchResult } from "./catalog-types";

export async function searchHFModels(query: string): Promise<HFSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    const url = `https://huggingface.co/api/models?search=${encodeURIComponent(q)}&filter=gguf&sort=downloads&limit=50`;
    const resp = await fetch(url);
    if (!resp.ok) return [];

    const data: Array<{
      id: string;
      author: string;
      likes: number;
      downloads: number;
      tags: string[];
      pipeline_tag?: string;
      createdAt?: string;
      siblings?: Array<{ rfilename: string }>;
    }> = await resp.json();

    const results: HFSearchResult[] = [];

    for (const model of data) {
      const repo = model.id;
      const builder = model.author;
      const description = repo.split("/")[1] ?? "";
      const family = detectFamily(repo);
      const architecture = detectArchitecture(model.tags);
      const parameterCount = detectParameterCount(model.tags);
      const license = detectLicense(model.tags);
      const downloads = model.downloads ?? 0;
      const uploadedAt = model.createdAt ?? "";
      const tags = model.tags.filter((t) => !t.startsWith("gguf"));
      const isMoe = model.tags.includes("moe");

      // Calculate base size from GGUF files
      let baseSizeGb = 0;
      if (model.siblings) {
        const ggufFiles = model.siblings.filter((s) => s.rfilename.endsWith(".gguf"));
        if (ggufFiles.length > 0) {
          // Estimate size from first GGUF file (approximation)
          baseSizeGb = estimateSizeFromParams(parameterCount);
        }
      }

      results.push({
        repo,
        builder,
        family,
        baseSizeGb,
        parameterCount,
        description,
        architecture,
        contextLength: detectContextLength(model.tags),
        license,
        downloads,
        uploadedAt,
        tags,
        isMoe,
      });
    }

    return results;
  } catch {
    return [];
  }
}

function detectFamily(repo: string): string {
  const r = repo.toLowerCase();
  if (r.includes("llama")) return "llama";
  if (r.includes("qwen")) return "qwen";
  if (r.includes("mistral")) return "mistral";
  if (r.includes("gemma")) return "gemma";
  if (r.includes("phi")) return "phi";
  if (r.includes("falcon")) return "falcon";
  if (r.includes("aya")) return "aya";
  if (r.includes("yi")) return "yi";
  return "other";
}

function detectArchitecture(tags: string[]): string {
  if (tags.includes("llama")) return "llama";
  if (tags.includes("qwen2")) return "qwen2";
  if (tags.includes("mistral")) return "mistral";
  if (tags.includes("gemma")) return "gemma";
  if (tags.includes("phi2")) return "phi2";
  return "unknown";
}

function detectParameterCount(tags: string[]): string {
  for (const tag of tags) {
    const match = tag.match(/(\d+(?:\.\d+)?)(B|M)/i);
    if (match) {
      const num = parseFloat(match[1]);
      const unit = match[2].toUpperCase();
      if (unit === "B") return `${num}B`;
      if (unit === "M") return `${(num / 1000).toFixed(1)}B`;
    }
  }
  return "unknown";
}

function detectLicense(tags: string[]): string {
  for (const tag of tags) {
    if (tag.startsWith("license:")) return tag.replace("license:", "");
  }
  return "unknown";
}

function detectContextLength(tags: string[]): number {
  for (const tag of tags) {
    const match = tag.match(/(\d+(?:\.\d+)?)(K|k)/i);
    if (match) {
      const num = parseFloat(match[1]);
      const unit = match[2].toUpperCase();
      if (unit === "K") return num * 1000;
    }
  }
  return 0;
}

function estimateSizeFromParams(paramCount: string): number {
  const match = paramCount.match(/(\d+(?:\.\d+)?)(B|M)/i);
  if (!match) return 0;

  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  // Rough estimate: 1B params ≈ 2GB (fp16), 1M params ≈ 2MB
  if (unit === "B") return num * 2;
  if (unit === "M") return (num / 1000) * 2;

  return 0;
}
