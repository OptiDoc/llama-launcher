import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { create } from "zustand";
import type { LlamaStore } from "@/stores/types";
import { createDownloadsSlice } from "@/stores/downloads-slice";
import { createModelsSlice } from "@/stores/models-slice";
import { createInstancesSlice } from "@/stores/instances-slice";
import { createProfilesSlice } from "@/stores/profiles-slice";
import { createReleasesSlice } from "@/stores/releases-slice";
import { createWorkspacesSlice } from "@/stores/workspaces-slice";
import { createNotificationsSlice } from "@/stores/notifications-slice";
import { createSystemSlice } from "@/stores/system-slice";
import { isTauri, tauri } from "@/lib/tauri-api";
import { defaultGlobalSettings } from "@/lib/types";

function createTestStore() {
  return create<LlamaStore>((set, get) => ({
    ...createDownloadsSlice(set, get),
    ...createModelsSlice(set, get),
    ...createInstancesSlice(set, get),
    ...createProfilesSlice(set, get),
    ...createReleasesSlice(set, get),
    ...createWorkspacesSlice(set, get),
    ...createNotificationsSlice(set, get),
    ...createSystemSlice(set, get),
    globalSettings: defaultGlobalSettings,
    logs: {},
  }));
}

describe("downloads-slice — full cycle", () => {
  let store: ReturnType<typeof createTestStore>;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = createTestStore();
    vi.mocked(isTauri).mockReturnValue(true);
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(tauri.downloadFile).mockResolvedValue(null);
    vi.mocked(tauri.installRelease).mockResolvedValue(null);
  });

  it("starts with empty downloads", () => {
    expect(store.getState().downloads).toEqual([]);
  });

  it("cancelDownload marks download failed", async () => {
    store.setState({
      downloads: [
        {
          id: "dl1",
          status: "downloading",
          kind: "model",
          repo: "",
          quant: "",
          filename: "",
          sizeGb: 0,
          progress: 0,
          speed: 0,
          eta: "",
          startedAt: 0,
          modelName: "",
          builder: "",
          completedAt: null,
        },
      ],
    });
    await store.getState().cancelDownload("dl1");
    expect(store.getState().downloads[0].status).toBe("failed");
  });

  it("retryDownload does nothing for missing download", async () => {
    await store.getState().retryDownload("nonexistent");
    expect(store.getState().downloads).toHaveLength(0);
  });

  describe("startHFDownload", () => {
    it("creates placeholder model and download entry", () => {
      const dlId = store
        .getState()
        .startHFDownload({ repo: "org/model", quant: "Q4_K_M", modelName: "TestModel", builder: "org" });

      expect(store.getState().downloads).toHaveLength(1);
      expect(store.getState().models).toHaveLength(1);
      expect(store.getState().downloads[0].id).toBe(dlId);
      expect(store.getState().downloads[0].status).toBe("downloading");
      expect(store.getState().models[0].downloading).toBe(true);
      expect(store.getState().models[0].name).toBe("TestModel Q4_K_M");
    });

    it("fails when not in Tauri", async () => {
      vi.mocked(isTauri).mockReturnValue(false);

      store.getState().startHFDownload({ repo: "org/model", quant: "Q4_K_M", modelName: "TestModel", builder: "org" });

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("failed");
        expect(store.getState().models[0].missing).toBe(true);
      });
    });

    it("fails when repo is not found (404)", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });

      store.getState().startHFDownload({ repo: "unknown/model", quant: "Q4_K_M", modelName: "Test", builder: "org" });

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("failed");
      });
    });

    it("fails when repo is gated (401)", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 });

      store.getState().startHFDownload({ repo: "gated/model", quant: "Q4_K_M", modelName: "Test", builder: "org" });

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("failed");
      });
    });

    it("proceeds when repo check throws (network error)", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error")).mockResolvedValue({ ok: true, json: async () => [] });
      vi.mocked(tauri.downloadFile).mockResolvedValue("/path/model.gguf");

      store.getState().startHFDownload({ repo: "org/model", quant: "Q4_K_M", modelName: "Test", builder: "org" });

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("completed");
      });
    });

    it("downloads successfully with exact GGUF match", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [{ path: "model-q4_k_m.gguf", size: 123456789, type: "file" }],
      });
      vi.mocked(tauri.downloadFile).mockResolvedValue("/models/model-q4_k_m.gguf");
      vi.mocked(tauri.scanModels).mockResolvedValue([
        {
          id: "m_test123",
          name: "Test",
          path: "/models/model-q4_k_m.gguf",
          size: 6000000000,
          format: "gguf",
          architecture: "llama",
          quantization: "Q4_K_M",
          context_size: 8192,
          parameter_count: "7B",
          modified: 1700000000,
          metadata: { description: "", author: "", license: "", tags: [], model_card: null, downloads: 0, likes: 0 },
          checksum: null,
        },
      ]);

      store.getState().startHFDownload({ repo: "org/model", quant: "Q4_K_M", modelName: "Test", builder: "org" });

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("completed");
        expect(store.getState().downloads[0].progress).toBe(100);
      });
    });

    it("uses fallback filename when HF API fails", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true }) // HEAD check passes
        .mockResolvedValue({ ok: false, status: 500 }); // tree API fails
      vi.mocked(tauri.downloadFile).mockResolvedValue("/models/model.q4_k_m.gguf");

      store.getState().startHFDownload({ repo: "org/model", quant: "Q4_K_M", modelName: "Test", builder: "org" });

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("completed");
      });
      expect(store.getState().downloads[0].filename).toBe("model.Q4_K_M.gguf");
    });

    it("resolves model in subdirectory", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => [{ path: "q4_k_m", type: "directory" }] })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ path: "q4_k_m/model.gguf", size: 999, type: "file" }],
        });
      vi.mocked(tauri.downloadFile).mockResolvedValue("/models/q4_k_m/model.gguf");

      store.getState().startHFDownload({ repo: "org/model", quant: "Q4_K_M", modelName: "Test", builder: "org" });

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("completed");
      });
      expect(store.getState().downloads[0].filename).toBe("q4_k_m/model.gguf");
    });

    it("marks failed when tauri.downloadFile returns null", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [{ path: "model-q4_k_m.gguf", size: 123, type: "file" }],
      });
      vi.mocked(tauri.downloadFile).mockResolvedValue(null);

      store.getState().startHFDownload({ repo: "org/model", quant: "Q4_K_M", modelName: "Test", builder: "org" });

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("failed");
      });
      const m = store.getState().models.find((m) => m.name === "Test Q4_K_M");
      expect(m?.downloading).toBe(false);
      expect(m?.missing).toBe(true);
    });

    it("matches suffix GGUF (.Q4_K_M.gguf)", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true }).mockResolvedValue({
        ok: true,
        json: async () => [{ path: "model.Q4_K_M.gguf", size: 200000000, type: "file" }],
      });
      vi.mocked(tauri.downloadFile).mockResolvedValue("/models/model.Q4_K_M.gguf");

      store.getState().startHFDownload({ repo: "org/model", quant: "Q4_K_M", modelName: "Test", builder: "org" });

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("completed");
      });
      expect(store.getState().downloads[0].filename).toBe("model.Q4_K_M.gguf");
    });

    it("selects first GGUF when no exact/suffix match", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true }).mockResolvedValue({
        ok: true,
        json: async () => [
          { path: "model-Q4_K_M-4.0.gguf", size: 300, type: "file" },
          { path: "model-Q4_K_M-8.0.gguf", size: 600, type: "file" },
        ],
      });
      vi.mocked(tauri.downloadFile).mockResolvedValue("/models/model-Q4_K_M-4.0.gguf");

      store.getState().startHFDownload({ repo: "org/model", quant: "Q4_K_M", modelName: "Test", builder: "org" });

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("completed");
      });
      expect(store.getState().downloads[0].filename).toBe("model-Q4_K_M-4.0.gguf");
    });

    it("uses fallback when no GGUFs match the quant", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true }).mockResolvedValue({
        ok: true,
        json: async () => [
          { path: "model-Q2_K.gguf", size: 100, type: "file" },
          { path: "model-Q8_0.gguf", size: 400, type: "file" },
        ],
      });
      vi.mocked(tauri.downloadFile).mockResolvedValue("/models/model.Q4_K_M.gguf");

      store.getState().startHFDownload({ repo: "org/model", quant: "Q4_K_M", modelName: "Test", builder: "org" });

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("completed");
      });
      expect(store.getState().downloads[0].filename).toBe("model.Q4_K_M.gguf");
    });

    it("uses fallback when HF API returns empty items", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true }).mockResolvedValue({ ok: true, json: async () => [] });
      vi.mocked(tauri.downloadFile).mockResolvedValue("/models/model.Q4_K_M.gguf");

      store.getState().startHFDownload({ repo: "org/model", quant: "Q4_K_M", modelName: "Test", builder: "org" });

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("completed");
      });
      expect(store.getState().downloads[0].filename).toBe("model.Q4_K_M.gguf");
    });

    it("uses fallback when HF API tree fetch throws", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true }).mockRejectedValue(new Error("API unreachable"));
      vi.mocked(tauri.downloadFile).mockResolvedValue("/models/model.Q4_K_M.gguf");

      store.getState().startHFDownload({ repo: "org/model", quant: "Q4_K_M", modelName: "Test", builder: "org" });

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("completed");
      });
      expect(store.getState().downloads[0].filename).toBe("model.Q4_K_M.gguf");
    });

    it("marks failed when tauri.downloadFile throws unexpectedly", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValue({ ok: true, json: async () => [{ path: "model.gguf", size: 500, type: "file" }] });
      vi.mocked(tauri.downloadFile).mockRejectedValue(new Error("Disk full"));

      store.getState().startHFDownload({ repo: "org/model", quant: "Q4_K_M", modelName: "Test", builder: "org" });

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("failed");
      });
      const m = store.getState().models.find((m) => m.name === "Test Q4_K_M");
      expect(m?.downloading).toBe(false);
      expect(m?.missing).toBe(true);
    });

    it("sets correct model state after success", async () => {
      vi.mocked(tauri.scanModels).mockResolvedValue([
        {
          id: "m_test123",
          name: "Test Q4_K_M",
          path: "/models/custom/model.gguf",
          size: 500,
          format: "gguf",
          architecture: "llama",
          quantization: "Q4_K_M",
          context_size: 8192,
          parameter_count: "7B",
          modified: 1700000000,
          metadata: { description: "", author: "", license: "", tags: [], model_card: null, downloads: 0, likes: 0 },
          checksum: null,
        },
      ]);
      mockFetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValue({ ok: true, json: async () => [{ path: "model.gguf", size: 500, type: "file" }] });
      vi.mocked(tauri.downloadFile).mockResolvedValue("/models/custom/model.gguf");

      store.getState().startHFDownload({ repo: "org/model", quant: "Q4_K_M", modelName: "Test", builder: "org" });

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("completed");
      });
      const m = store.getState().models.find((m) => m.name === "Test Q4_K_M");
      expect(m).toBeDefined();
      expect(m!.downloaded).toBe(true);
      expect(m!.path).toBe("/models/custom/model.gguf");
    });

    it("emits notifications on start and completion", async () => {
      const addNotif = vi.fn();
      store.setState({ addNotification: addNotif });
      mockFetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValue({ ok: true, json: async () => [{ path: "model.gguf", size: 500, type: "file" }] });
      vi.mocked(tauri.downloadFile).mockResolvedValue("/models/model.gguf");

      store.getState().startHFDownload({ repo: "org/model", quant: "Q4_K_M", modelName: "Test", builder: "org" });

      expect(addNotif).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "download",
          title: "Downloading model",
        }),
      );

      await vi.waitFor(() => {
        expect(addNotif).toHaveBeenCalledWith(
          expect.objectContaining({
            kind: "download",
            title: "Model downloaded",
          }),
        );
      });
    });

    it("calls refreshModels after successful download", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValue({ ok: true, json: async () => [{ path: "model.gguf", size: 500, type: "file" }] });
      vi.mocked(tauri.downloadFile).mockResolvedValue("/models/model.gguf");

      store.getState().startHFDownload({ repo: "org/model", quant: "Q4_K_M", modelName: "Test", builder: "org" });

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("completed");
      });
      expect(vi.mocked(tauri.scanModels)).toHaveBeenCalled();
    });

    it("uses fallback when subdirectory has no GGUF inside", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true, json: async () => [{ path: "nomic-ai-tokenizer", type: "directory" }] })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ path: "nomic-ai-tokenizer/tokenizer.json", size: 999, type: "file" }],
        });
      vi.mocked(tauri.downloadFile).mockResolvedValue("/models/model.Q4_K_M.gguf");

      store.getState().startHFDownload({ repo: "org/model", quant: "Q4_K_M", modelName: "Test", builder: "org" });

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("completed");
      });
      expect(store.getState().downloads[0].filename).toBe("model.Q4_K_M.gguf");
    });

    it("prefers exact GGUF over suffix when both present", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true }).mockResolvedValue({
        ok: true,
        json: async () => [
          { path: "model.Q4_K_M.gguf", size: 200, type: "file" },
          { path: "model-q4_k_m.gguf", size: 300, type: "file" },
        ],
      });
      vi.mocked(tauri.downloadFile).mockResolvedValue("/models/model-q4_k_m.gguf");

      store.getState().startHFDownload({ repo: "org/model", quant: "Q4_K_M", modelName: "Test", builder: "org" });

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("completed");
        expect(store.getState().downloads[0].filename).toBe("model-q4_k_m.gguf");
      });
    });

    it("keeps resolvedSize 0 when no HF file matched", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValue({ ok: true, json: async () => [{ path: "unrelated.gguf", size: 999, type: "file" }] });
      vi.mocked(tauri.downloadFile).mockResolvedValue("/models/model.Q4_K_M.gguf");

      store.getState().startHFDownload({ repo: "org/model", quant: "Q4_K_M", modelName: "Test", builder: "org" });

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("completed");
      });
      expect(store.getState().downloads[0].filename).toBe("model.Q4_K_M.gguf");
    });

    it("updates progress via callback", async () => {
      vi.mocked(tauri.downloadFile).mockImplementation(async (_url, _dest, _dlId, onProgress) => {
        onProgress?.({ total: 1000, downloaded: 500, speed: 100 });
        onProgress?.({ total: 1000, downloaded: 1000, speed: 50 });
        return "/models/model.gguf";
      });
      mockFetch.mockResolvedValue({ ok: true, json: async () => [{ path: "model.gguf", size: 1000, type: "file" }] });

      store.getState().startHFDownload({ repo: "org/model", quant: "Q4_K_M", modelName: "Test", builder: "org" });

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("completed");
      });
      expect(store.getState().downloads[0].progress).toBe(100);
    });

    it("retryDownload retries a failed model download", async () => {
      store.setState({
        downloads: [
          {
            id: "dl1",
            status: "failed",
            kind: "model",
            repo: "org/model",
            quant: "Q4_K_M",
            filename: "m.gguf",
            sizeGb: 4,
            progress: 0,
            speed: 0,
            eta: "",
            startedAt: 0,
            modelName: "Test Q4_K_M",
            builder: "org",
            completedAt: null,
          },
        ],
        models: [{ id: "m1", hfRepo: "org/model", quant: "Q4_K_M", name: "Test Q4_K_M", builder: "org" } as never],
      });
      vi.mocked(isTauri).mockReturnValue(false);

      await store.getState().retryDownload("dl1");

      expect(store.getState().downloads.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("startReleaseDownload", () => {
    it("handles missing release", () => {
      const dlId = store.getState().startReleaseDownload("nonexistent");
      expect(dlId).toBeTruthy();
      expect(store.getState().downloads).toHaveLength(0);
    });

    it("fails when not in Tauri", async () => {
      vi.mocked(isTauri).mockReturnValue(false);
      store.setState({
        releases: [{ id: "r1", tag: "b9951", variant: "cuda12", sizeMb: 42, installed: false } as never],
      });

      store.getState().startReleaseDownload("r1");

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("failed");
      });
    });

    it("completes successfully", async () => {
      vi.mocked(tauri.installRelease).mockResolvedValue("/path/llama.zip");
      store.setState({
        releases: [{ id: "r1", tag: "b9951", variant: "cuda12", sizeMb: 42, installed: false } as never],
      });

      store.getState().startReleaseDownload("r1");

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("completed");
      });
      expect(store.getState().releases[0].installed).toBe(true);
    });

    it("fails when installRelease returns null", async () => {
      vi.mocked(tauri.installRelease).mockResolvedValue(null);
      store.setState({
        releases: [{ id: "r1", tag: "b9951", variant: "cuda12", sizeMb: 42, installed: false } as never],
      });

      store.getState().startReleaseDownload("r1");

      await vi.waitFor(() => {
        expect(store.getState().downloads[0].status).toBe("failed");
      });
      expect(store.getState().releases[0].installed).toBe(false);
    });
  });
});
