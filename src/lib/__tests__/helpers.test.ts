import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NOTIF_MESSAGES, renameLogKey, seedMetrics, uptimeString, pickPort, fmtNum, fmtBytes } from "@/lib/helpers";
import type { LlamaInstance } from "@/lib/types-process";

interface TauriProcessInfo {
  id: string;
  model_id: string;
  pid: number;
  port: number;
  status: string;
  started_at: number;
  gpu_memory: number;
  cpu_memory: number;
  context_used: number;
  tokens_per_sec: number;
}

const {
  uid,
  nowTs,
  mapTauriModel,
  mapTauriProcess,
  inferFamily,
  persistHibernatedState,
  restoreHibernatedState,
  persistLastActivity,
} = await vi.importActual<{
  uid: (prefix?: string) => string;
  nowTs: () => number;
  mapTauriModel: (m: unknown, workspaceId: string) => unknown;
  mapTauriProcess: (p: TauriProcessInfo, models: unknown[]) => LlamaInstance;
  inferFamily: (name: string, arch: string) => string;
  persistHibernatedState: (ids: string[], instances: unknown[], ts: number) => void;
  restoreHibernatedState: () => unknown;
  persistLastActivity: (ts: number) => void;
}>("@/lib/helpers");

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

describe("lib/helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", localStorageMock);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("NOTIF_MESSAGES", () => {
    it("creates model download start notification", () => {
      const msg = NOTIF_MESSAGES.modelDownloadStart("Llama-3.1-8B", "Q4_K_M", 8.5);
      expect(msg.title).toBe("Downloading model");
      expect(msg.body).toBe("Llama-3.1-8B Q4_K_M - 8.5 GB");
    });

    it("creates model download complete notification", () => {
      const msg = NOTIF_MESSAGES.modelDownloadComplete("Llama-3.1-8B", "Q4_K_M");
      expect(msg.title).toBe("Model downloaded");
      expect(msg.body).toBe("Llama-3.1-8B Q4_K_M is ready to use.");
    });

    it("creates model download failed notification", () => {
      const msg = NOTIF_MESSAGES.modelDownloadFailed("TestModel", "Network error");
      expect(msg.title).toBe("Download failed");
      expect(msg.body).toBe("TestModel: Network error");
    });

    it("creates model imported notification", () => {
      const msg = NOTIF_MESSAGES.modelImported("MyModel");
      expect(msg.title).toBe("Model imported");
      expect(msg.body).toBe("MyModel is ready to use.");
    });

    it("creates release download start notification", () => {
      const msg = NOTIF_MESSAGES.releaseDownloadStart("b9951", "cuda12", 42);
      expect(msg.title).toBe("Downloading release");
      expect(msg.body).toBe("llama.cpp b9951 (cuda12) - 42 MB");
    });

    it("creates release installed notification", () => {
      const msg = NOTIF_MESSAGES.releaseInstalled("b9951", "cuda12");
      expect(msg.title).toBe("Release installed");
      expect(msg.body).toBe("llama.cpp b9951 (cuda12) is ready.");
    });

    it("creates hibernation started notification", () => {
      const msg = NOTIF_MESSAGES.hibernationStarted(3, 300);
      expect(msg.title).toBe("Hibernation started");
      expect(msg.body).toBe("3 model(s) unloaded from VRAM after 300s idle.");
    });

    it("creates new release available notification", () => {
      const msg = NOTIF_MESSAGES.newReleaseAvailable("b9952", "Bug fixes and improvements...");
      expect(msg.title).toBe("New llama.cpp release available");
      expect(msg.body).toContain("b9952");
    });
  });

  describe("uid", () => {
    it("generates unique IDs with prefix", () => {
      const id1 = uid("test");
      const id2 = uid("test");
      expect(id1).toMatch(/^test_[a-z0-9]{7}$/);
      expect(id2).toMatch(/^test_[a-z0-9]{7}$/);
      expect(id1).not.toBe(id2);
    });

    it("uses default prefix when not provided", () => {
      const id = uid();
      expect(id).toMatch(/^id_[a-z0-9]{7}$/);
    });
  });

  describe("nowTs", () => {
    it("returns current timestamp", () => {
      const before = Date.now();
      const ts = nowTs();
      const after = Date.now();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });

  describe("renameLogKey", () => {
    it("renames key in log object", () => {
      const logs = { oldKey: [{ id: "1", instanceId: "i1", ts: 1, kind: "info" as const, text: "test" }] };
      const result = renameLogKey(logs, "oldKey", "newKey");
      expect(result).toHaveProperty("newKey");
      expect(result).not.toHaveProperty("oldKey");
      expect(result.newKey).toHaveLength(1);
    });

    it("returns same object if oldKey === newKey", () => {
      const logs = { key1: [] };
      const result = renameLogKey(logs, "key1", "key1");
      expect(result).toBe(logs);
    });

    it("handles missing oldKey gracefully", () => {
      const logs = { key1: [] };
      const result = renameLogKey(logs, "missing", "newKey");
      expect(result).toEqual({ key1: [], newKey: [] });
    });
  });

  describe("seedMetrics", () => {
    it("returns 60 metric samples", () => {
      const metrics = seedMetrics();
      expect(metrics).toHaveLength(60);
    });

    it("each sample has required fields", () => {
      const metrics = seedMetrics();
      for (const m of metrics) {
        expect(m).toHaveProperty("t");
        expect(m).toHaveProperty("cpu");
        expect(m).toHaveProperty("ram");
        expect(m).toHaveProperty("gpu");
        expect(m).toHaveProperty("gpuMem");
        expect(m).toHaveProperty("tps");
        expect(m).toHaveProperty("reqPerMin");
      }
    });

    it("timestamps are decreasing by 1 second", () => {
      const metrics = seedMetrics();
      for (let i = 1; i < metrics.length; i++) {
        expect(metrics[i].t - metrics[i - 1].t).toBe(1000);
      }
    });

    it("all values start at zero", () => {
      const metrics = seedMetrics();
      for (const m of metrics) {
        expect(m.cpu).toBe(0);
        expect(m.ram).toBe(0);
        expect(m.gpu).toBe(0);
        expect(m.gpuMem).toBe(0);
        expect(m.tps).toBe(0);
        expect(m.reqPerMin).toBe(0);
      }
    });
  });

  describe("mapTauriModel", () => {
    const mockModelInfo = {
      id: "m123",
      name: "Llama-3.1-8B-Instruct-Q4_K_M",
      path: "/models/llama-3.1-8b-q4_k_m.gguf",
      size: 8_000_000_000,
      format: "gguf" as const,
      architecture: "llama",
      quantization: "Q4_K_M",
      context_size: 8192,
      parameter_count: "8B",
      modified: 1700000000,
      metadata: {
        description: "Meta Llama 3.1 8B Instruct",
        author: "meta-llama",
        license: "Llama 3.1 Community",
        tags: ["instruct", "chat"],
        model_card: null,
        downloads: 100000,
        likes: 5000,
      },
      checksum: "abc123",
    };

    it("maps all required fields", () => {
      const model = mapTauriModel(mockModelInfo, "ws1");
      expect((model as any).id).toBe("m123");
      expect((model as any).name).toBe("Llama-3.1-8B-Instruct-Q4_K_M");
      expect((model as any).family).toBe("llama3");
      expect((model as any).sizeGb).toBeCloseTo(7.45, 1); // 8GB / 1.074
      expect((model as any).quant).toBe("Q4_K_M");
      expect((model as any).downloaded).toBe(true);
      expect((model as any).missing).toBe(false);
      expect((model as any).path).toBe("/models/llama-3.1-8b-q4_k_m.gguf");
      expect((model as any).hfRepo).toBeUndefined();
      expect((model as any).builder).toBe("meta-llama");
      expect((model as any).architecture).toBe("llama");
      expect((model as any).contextLength).toBe(8192);
      expect((model as any).parameterCount).toBe("8B");
      expect((model as any).quantizationBits).toBe(4);
      expect((model as any).license).toBe("Llama 3.1 Community");
      expect((model as any).description).toBe("Meta Llama 3.1 8B Instruct");
      expect((model as any).uploadedAt).toBe("2023-11-14");
      expect((model as any).hfDownloads).toBe(100000);
      expect((model as any).tags).toEqual(["instruct", "chat"]);
      expect((model as any).isMoe).toBe(false);
      expect((model as any).expertCount).toBeUndefined();
      expect((model as any).workspaceId).toBe("ws1");
      expect((model as any).addedAt).toBe(1700000000000);
    });

    it("detects MoE models from name/architecture", () => {
      const moeModel = { ...mockModelInfo, name: "Mixtral-8x7B-Instruct-v0.1", architecture: "mixtral" };
      const model = mapTauriModel(moeModel, "ws1");
      expect((model as any).isMoe).toBe(true);
      expect((model as any).expertCount).toBe(8);
    });

    it("detects MoE from expert pattern in name", () => {
      const moeModel = { ...mockModelInfo, name: "Qwen2-57B-A14B-Instruct" };
      const model = mapTauriModel(moeModel, "ws1");
      expect((model as any).isMoe).toBe(true);
    });

    it("handles null metadata gracefully", () => {
      const modelInfo = { ...mockModelInfo, metadata: null };
      const model = mapTauriModel(modelInfo, "ws1");
      expect((model as any).license).toBe("Unknown");
      expect((model as any).description).toBe(modelInfo.name);
      expect((model as any).hfDownloads).toBe(0);
      expect((model as any).tags).toEqual([]);
    });

    it("handles missing architecture/quantization", () => {
      const modelInfo = { ...mockModelInfo, architecture: null, quantization: null };
      const model = mapTauriModel(modelInfo, "ws1");
      expect((model as any).architecture).toBe("llama");
      expect((model as any).quant).toBe("unknown");
      expect((model as any).quantizationBits).toBe(4);
    });
  });

  describe("mapTauriProcess", () => {
    const mockModels = [
      {
        id: "m1",
        name: "TestModel",
        family: "llama",
        sizeGb: 8,
        quant: "Q4_K_M",
        downloaded: true,
        missing: false,
        path: "/m.gguf",
        hfRepo: "org/model",
        builder: "org",
        architecture: "llama",
        contextLength: 8192,
        parameterCount: "7B",
        quantizationBits: 4,
        license: "MIT",
        description: "",
        uploadedAt: "",
        hfDownloads: 0,
        tags: [],
        isMoe: false,
        workspaceId: "ws1",
        addedAt: 1,
      },
    ];

    it("maps process info with matching model", () => {
      const processInfo = {
        id: "p1",
        model_id: "m1",
        pid: 12345,
        port: 8080,
        status: "running",
        started_at: 1700000000,
        gpu_memory: 2000,
        cpu_memory: 500,
        context_used: 4096,
        tokens_per_sec: 45.5,
      };

      const instance: {
        id: string;
        name: string;
        model: string;
        status: string;
        port: number;
        memoryMb: number;
        tokensPerSec: number;
      } = mapTauriProcess(processInfo, mockModels);
      expect(instance.id).toBe("p1");
      expect(instance.name).toBe("TestModel");
      expect(instance.model).toBe("TestModel");
      expect(instance.status).toBe("running");
      expect(instance.port).toBe(8080);
      expect(instance.memoryMb).toBe(2000); // gpu_memory preferred
      expect(instance.tokensPerSec).toBe(45.5);
    });

    it("falls back to cpu_memory when gpu_memory is 0", () => {
      const processInfo = {
        id: "p1",
        model_id: "m1",
        pid: 12345,
        port: 8080,
        status: "running",
        started_at: 1700000000,
        gpu_memory: 0,
        cpu_memory: 500,
        context_used: 4096,
        tokens_per_sec: 45.5,
      };
      const instance: {
        id: string;
        name: string;
        model: string;
        status: string;
        port: number;
        memoryMb: number;
        tokensPerSec: number;
      } = mapTauriProcess(processInfo, mockModels);
      expect(instance.memoryMb).toBe(500);
    });

    it("maps status correctly", () => {
      const statuses: Array<[string, InstanceStatus]> = [
        ["starting", "starting"],
        ["running", "running"],
        ["stopping", "stopping"],
        ["stopped", "stopped"],
        ["crashed", "error"],
        ["error", "error"],
        ["unknown", "stopped"],
      ];
      for (const [input, expected] of statuses) {
        const processInfo = {
          id: "p1",
          model_id: "m1",
          pid: 1,
          port: 8080,
          status: input,
          started_at: 0,
          gpu_memory: 0,
          cpu_memory: 0,
          context_used: 0,
          tokens_per_sec: 0,
        };
        const instance: {
          id: string;
          name: string;
          model: string;
          status: string;
          port: number;
          memoryMb: number;
          tokensPerSec: number;
        } = mapTauriProcess(processInfo, mockModels);
        expect(instance.status).toBe(expected);
      }
    });

    it("handles missing model gracefully", () => {
      const processInfo = {
        id: "p1",
        model_id: "missing",
        pid: 1,
        port: 8080,
        status: "running",
        started_at: 0,
        gpu_memory: 0,
        cpu_memory: 0,
        context_used: 0,
        tokens_per_sec: 0,
      };
      const instance = mapTauriProcess(processInfo, []);
      expect(instance.name).toBe("missing");
      expect(instance.model).toBe("missing");
    });

    it("falls back to cpu_memory when gpu_memory is 0", () => {
      const processInfo = {
        id: "p1",
        model_id: "m1",
        pid: 12345,
        port: 8080,
        status: "running",
        started_at: 1700000000,
        gpu_memory: 0,
        cpu_memory: 500,
        context_used: 4096,
        tokens_per_sec: 45.5,
      };
      const instance: {
        id: string;
        name: string;
        model: string;
        status: string;
        port: number;
        memoryMb: number;
        tokensPerSec: number;
      } = mapTauriProcess(processInfo, mockModels);
      expect(instance.memoryMb).toBe(500);
    });

    it("maps status correctly", () => {
      const statusCases = [
        { input: "starting", expected: "starting" },
        { input: "running", expected: "running" },
        { input: "stopping", expected: "stopping" },
        { input: "stopped", expected: "stopped" },
        { input: "crashed", expected: "error" },
        { input: "error", expected: "error" },
        { input: "unknown", expected: "stopped" },
      ];
      for (const { input, expected } of statusCases) {
        const processInfo = {
          id: "p1",
          model_id: "m1",
          pid: 1,
          port: 8080,
          status: input,
          started_at: 0,
          gpu_memory: 0,
          cpu_memory: 0,
          context_used: 0,
          tokens_per_sec: 0,
        };
        const instance: {
          id: string;
          name: string;
          model: string;
          status: string;
          port: number;
          memoryMb: number;
          tokensPerSec: number;
        } = mapTauriProcess(processInfo, mockModels);
        expect(instance.status).toBe(expected);
      }
    });

    it("handles missing model gracefully", () => {
      const processInfo = {
        id: "p1",
        model_id: "missing",
        pid: 1,
        port: 8080,
        status: "running",
        started_at: 0,
        gpu_memory: 0,
        cpu_memory: 0,
        context_used: 0,
        tokens_per_sec: 0,
      };
      const instance = mapTauriProcess(processInfo, []);
      expect(instance.name).toBe("missing");
      expect(instance.model).toBe("missing");
    });
  });

  describe("inferFamily (actual implementation)", () => {
    const cases: Array<[string, string, string]> = [
      ["Llama-3.1-8B", "llama", "llama3"],
      ["Llama-3-8B", "llama", "llama3"],
      ["Llama-2-7B", "llama", "llama2"],
      ["Qwen2.5-7B", "llama", "qwen2"],
      ["Mistral-7B", "llama", "mistral"],
      ["Mixtral-8x7B", "llama", "mixtral"],
      ["Gemma-2-9B", "llama", "gemma2"],
      ["Phi-3-mini", "llama", "phi3"],
      ["DeepSeek-R1", "llama", "deepseek"],
      ["Starcoder2-7B", "llama", "starcoder"],
      ["CodeLlama-7B", "llama", "codellama"],
      ["UnknownModel", "mamba", "mamba"],
    ];

    for (const [name, arch, expected] of cases) {
      it(`infers "${expected}" for ${name} (arch: ${arch})`, () => {
        expect(inferFamily(name, arch)).toBe(expected);
      });
    }
  });

  describe("Hibernation helpers", () => {
    const mockInstances = [
      {
        id: "i1",
        hibernatedConfig: { name: "inst1", model: "m1", profile: "p1", port: 8080, host: "127.0.0.1", gpu: "auto" },
      },
      {
        id: "i2",
        hibernatedConfig: { name: "inst2", model: "m2", profile: "p2", port: 8081, host: "127.0.0.1", gpu: "auto" },
      },
      { id: "i3", hibernatedConfig: undefined },
    ];

    it("persists hibernated state to localStorage", () => {
      persistHibernatedState(["i1", "i2"], mockInstances, 1234567890);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "llama-launcher-hibernation",
        expect.stringContaining("i1"),
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith("llama-launcher-last-activity", "1234567890");
    });

    it("persists hibernated state", () => {
      persistHibernatedState(["i1", "i2", "i3"], mockInstances, 1234567890);
      const call = localStorageMock.setItem.mock.calls[0][1];
      const parsed = JSON.parse(call);
      expect(parsed.hibernatedInstanceIds).toEqual(["i1", "i2", "i3"]);
      expect(parsed.hibernatedConfigs).toHaveProperty("i1");
      expect(parsed.hibernatedConfigs).toHaveProperty("i2");
    });

    it("restores hibernated state from localStorage", () => {
      const state = {
        hibernatedInstanceIds: ["i1"],
        hibernatedConfigs: {
          i1: { name: "inst1", model: "m1", profile: "p1", port: 8080, host: "127.0.0.1", gpu: "auto" },
        },
        lastActivityAt: 1234567890,
      };
      localStorageMock.getItem.mockImplementation((key) =>
        key === "llama-launcher-hibernation" ? JSON.stringify(state) : null,
      );
      const restored = restoreHibernatedState();
      expect(restored).toEqual(state);
    });

    it("returns null for missing or invalid localStorage data", () => {
      localStorageMock.getItem.mockReturnValue(null);
      expect(restoreHibernatedState()).toBeNull();

      localStorageMock.getItem.mockReturnValue("invalid json");
      expect(restoreHibernatedState()).toBeNull();

      localStorageMock.getItem.mockReturnValue('{"hibernatedInstanceIds": "not-array"}');
      expect(restoreHibernatedState()).toBeNull();
    });

    it("persists last activity timestamp", () => {
      persistLastActivity(9876543210);
      expect(localStorageMock.setItem).toHaveBeenCalledWith("llama-launcher-last-activity", "9876543210");
    });
  });

  describe("uptimeString", () => {
    it("returns -- for undefined", () => {
      expect(uptimeString(undefined)).toBe("--");
    });

    it("formats seconds", () => {
      const now = Date.now();
      expect(uptimeString(now - 30_000)).toBe("30s");
      expect(uptimeString(now - 59_000)).toBe("59s");
    });

    it("formats minutes", () => {
      const now = Date.now();
      expect(uptimeString(now - 60_000)).toBe("1m 0s");
      expect(uptimeString(now - 3599_000)).toBe("59m 59s");
    });

    it("formats hours", () => {
      const now = Date.now();
      expect(uptimeString(now - 3600_000)).toBe("1h 0m");
      expect(uptimeString(now - 7200_000)).toBe("2h 0m");
    });
  });

  describe("pickPort", () => {
    it("returns port in range 8080-8099", () => {
      for (let i = 0; i < 100; i++) {
        const port = pickPort();
        expect(port).toBeGreaterThanOrEqual(8080);
        expect(port).toBeLessThanOrEqual(8099);
      }
    });
  });

  describe("fmtNum", () => {
    it("formats millions", () => {
      expect(fmtNum(1_500_000)).toMatch(/M/);
      expect(fmtNum(2_000_000)).toMatch(/M/);
    });

    it("formats thousands", () => {
      expect(fmtNum(1_500)).toMatch(/K/);
      expect(fmtNum(2_000)).toMatch(/K/);
    });

    it("formats small numbers as-is", () => {
      expect(fmtNum(500)).toBe("500");
      expect(fmtNum(999)).toBe("999");
    });
  });

  describe("fmtBytes", () => {
    it("formats GB", () => {
      expect(fmtBytes(1)).toBe("1.0 GB");
      expect(fmtBytes(8.5)).toBe("8.5 GB");
    });

    it("formats MB for < 1GB", () => {
      expect(fmtBytes(0.5)).toBe("512 MB");
      expect(fmtBytes(0.1)).toBe("102 MB");
    });
  });
});

type InstanceStatus = "stopped" | "starting" | "running" | "stopping" | "error";
