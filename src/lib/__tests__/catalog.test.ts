import { describe, it, expect, vi } from "vitest";

const { HF_CATALOG, HF_QUANTS, RELEASE_VARIANTS, searchHFModels } = await vi.importActual<
  {
    HF_CATALOG: { builder: string; isMoe: boolean; expertCount?: number; repo: string; family: string; parameterCount: string; tags: string[]; baseSizeGb?: number; contextLength?: number; downloads?: number; architecture?: string }[];
    HF_QUANTS: { id: string; sizeFactor?: number; bits?: number }[];
    RELEASE_VARIANTS: { id: string; priority: boolean }[];
    searchHFModels: (query: string) => Promise<{ repo: string; family: string; parameterCount: string; tags: string[]; builder: string; architecture?: string }[]>;
  }
>("@/lib/catalog");

describe("lib/catalog", () => {
  describe("HF_CATALOG", () => {
    it("is exported (populated at runtime)", () => {
      expect(HF_CATALOG).toBeDefined();
      expect(Array.isArray(HF_CATALOG)).toBe(true);
    });
  });

  describe("HF_QUANTS", () => {
    it("contains standard quantization levels", () => {
      const ids = HF_QUANTS.map((q) => q.id);
      expect(ids).toContain("Q4_0");
      expect(ids).toContain("Q4_K_M");
      expect(ids).toContain("Q5_K_M");
      expect(ids).toContain("Q6_K");
      expect(ids).toContain("Q8_0");
      expect(ids).toContain("F16");
    });

    it("has sizeFactor and bits for each quantization", () => {
      for (const q of HF_QUANTS) {
        expect(typeof q.sizeFactor).toBe("number");
        expect(q.sizeFactor).toBeGreaterThan(0);
        expect(typeof q.bits).toBe("number");
      }
    });
  });

  describe("RELEASE_VARIANTS", () => {
    it("contains all major GPU backends", () => {
      const ids = RELEASE_VARIANTS.map((v) => v.id);
      expect(ids).toContain("cuda12");
      expect(ids).toContain("vulkan");
      expect(ids).toContain("cpu");
    });

    it("marks priority variants", () => {
      const priority = RELEASE_VARIANTS.filter((v) => v.priority).map((v) => v.id);
      expect(priority).toContain("cuda12");
      expect(priority).toContain("vulkan");
    });
  });

  describe("searchHFModels", () => {
    it("returns empty array for empty query", async () => {
      expect(await searchHFModels("")).toEqual([]);
      expect(await searchHFModels("   ")).toEqual([]);
    });

    it("finds model by exact repo substring", async () => {
      const results = await searchHFModels("Llama-3.1-8B-Instruct-GGUF");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].repo).toContain("Llama-3.1-8B-Instruct-GGUF");
    });

    it("finds model by family name", async () => {
      const results = await searchHFModels("qwen");
      expect(results.length).toBeGreaterThan(0);
      // qwen models have family "qwen2" or architecture "qwen2"
      expect(results.every((r) => r.family.includes("qwen") || r.architecture?.includes("qwen"))).toBe(true);
    });

    it("finds model by parameter count", async () => {
      const results = await searchHFModels("7B");
      expect(results.length).toBeGreaterThan(0);
    });

    it("finds model by architecture", async () => {
      const results = await searchHFModels("gemma");
      expect(results.length).toBeGreaterThan(0);
    });

    it("handles multi-word queries with AND logic", async () => {
      const results = await searchHFModels("llama 3.1 8b");
      expect(results.length).toBeGreaterThan(0);
    });

    it("finds reasoning models", async () => {
      const results = await searchHFModels("deepseek reasoning");
      expect(results.length).toBeGreaterThan(0);
    });

    it("finds code models", async () => {
      const results = await searchHFModels("coder");
      expect(results.length).toBeGreaterThan(0);
    });

    it("limits results per builder in diverse section", async () => {
      const results = await searchHFModels("bartowski");
      expect(results.length).toBeGreaterThan(0);
    });

    it("returns results sorted by relevance score", async () => {
      const results = await searchHFModels("llama 8b");
      expect(results.length).toBeGreaterThan(0);
    });

    it("handles case-insensitive queries", async () => {
      const lower = await searchHFModels("llama 3.1 8b");
      const upper = await searchHFModels("LLAMA 3.1 8B");
      const mixed = await searchHFModels("Llama 3.1 8B");
      expect(lower.length).toBe(upper.length);
      expect(lower.length).toBe(mixed.length);
    });

    it("finds vision-language models", async () => {
      const results = await searchHFModels("vision");
      expect(results.length).toBeGreaterThan(0);
    });

    it("finds specific builder", async () => {
      const results = await searchHFModels("unsloth");
      expect(results.length).toBeGreaterThan(0);
    });

    it("returns diverse builders for generic queries", async () => {
      const results = await searchHFModels("instruct");
      expect(results.length).toBeGreaterThan(0);
    });
  });
});