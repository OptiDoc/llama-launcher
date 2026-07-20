import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import type { LlamaStore } from "@/stores/types";
import { createModelsSlice } from "@/stores/models-slice";
import { createInstancesSlice } from "@/stores/instances-slice";
import { createDownloadsSlice } from "@/stores/downloads-slice";
import { createProfilesSlice } from "@/stores/profiles-slice";
import { createReleasesSlice } from "@/stores/releases-slice";
import { createWorkspacesSlice } from "@/stores/workspaces-slice";
import { createNotificationsSlice } from "@/stores/notifications-slice";
import { createSystemSlice } from "@/stores/system-slice";

function createTestStore() {
  return create<LlamaStore>((set, get) => ({
    ...createModelsSlice(set, get),
    ...createInstancesSlice(set, get),
    ...createDownloadsSlice(set, get),
    ...createProfilesSlice(set, get),
    ...createReleasesSlice(set, get),
    ...createWorkspacesSlice(set, get),
    ...createNotificationsSlice(set, get),
    ...createSystemSlice(set, get),
    globalSettings: {} as never,
    logs: {},
  }));
}

describe("models-slice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("starts with empty models", () => {
    expect(store.getState().models).toEqual([]);
  });

  it("updates a model", () => {
    store.setState({
      models: [
        {
          id: "m1",
          name: "Test",
          family: "llama3",
          sizeGb: 4,
          quant: "Q4_K_M",
          downloaded: true,
          missing: false,
          downloading: false,
          downloadProgress: 0,
          path: "/models/test.gguf",
          workspaceId: "ws1",
          builder: "default",
          architecture: "llama",
          contextLength: 8192,
          parameterCount: "8B",
          quantizationBits: 4,
          license: "MIT",
          description: "",
          uploadedAt: "2024-01-01",
          hfDownloads: 0,
          tags: [],
          isMoe: false,
          addedAt: 0,
        },
      ],
    });
    store.getState().updateModel("m1", { name: "Updated" });
    expect(store.getState().models[0].name).toBe("Updated");
  });

  it("deletes a model", () => {
    store.setState({
      models: [
        {
          id: "m1",
          name: "Test",
          family: "llama3",
          sizeGb: 4,
          quant: "Q4_K_M",
          downloaded: true,
          missing: false,
          downloading: false,
          downloadProgress: 0,
          path: "/models/test.gguf",
          workspaceId: "ws1",
          builder: "default",
          architecture: "llama",
          contextLength: 8192,
          parameterCount: "8B",
          quantizationBits: 4,
          license: "MIT",
          description: "",
          uploadedAt: "2024-01-01",
          hfDownloads: 0,
          tags: [],
          isMoe: false,
          addedAt: 0,
        },
      ],
    });
    store.getState().deleteModel("m1");
    expect(store.getState().models).toHaveLength(0);
  });

  it("markModelMissing sets missing and clears downloaded", () => {
    store.setState({
      models: [
        {
          id: "m1",
          name: "Test",
          family: "llama3",
          sizeGb: 4,
          quant: "Q4_K_M",
          downloaded: true,
          missing: false,
          downloading: false,
          downloadProgress: 0,
          path: "/models/test.gguf",
          workspaceId: "ws1",
          builder: "default",
          architecture: "llama",
          contextLength: 8192,
          parameterCount: "8B",
          quantizationBits: 4,
          license: "MIT",
          description: "",
          uploadedAt: "2024-01-01",
          hfDownloads: 0,
          tags: [],
          isMoe: false,
          addedAt: 0,
        },
      ],
    });
    store.getState().markModelMissing("m1", true);
    expect(store.getState().models[0].missing).toBe(true);
    expect(store.getState().models[0].downloaded).toBe(false);
  });

  it("markModelMissing false restores downloaded", () => {
    store.setState({
      models: [
        {
          id: "m1",
          name: "Test",
          family: "llama3",
          sizeGb: 4,
          quant: "Q4_K_M",
          downloaded: true,
          missing: true,
          downloading: false,
          downloadProgress: 0,
          path: "/models/test.gguf",
          workspaceId: "ws1",
          builder: "default",
          architecture: "llama",
          contextLength: 8192,
          parameterCount: "8B",
          quantizationBits: 4,
          license: "MIT",
          description: "",
          uploadedAt: "2024-01-01",
          hfDownloads: 0,
          tags: [],
          isMoe: false,
          addedAt: 0,
        },
      ],
    });
    store.getState().markModelMissing("m1", false);
    expect(store.getState().models[0].missing).toBe(false);
    expect(store.getState().models[0].downloaded).toBe(true);
  });

  it("locateModel sets path, clears missing, marks downloaded", () => {
    store.setState({
      models: [
        {
          id: "m1",
          name: "Test",
          family: "llama3",
          sizeGb: 4,
          quant: "Q4_K_M",
          downloaded: false,
          missing: true,
          downloading: false,
          downloadProgress: 0,
          path: "/old/path.gguf",
          workspaceId: "ws1",
          builder: "default",
          architecture: "llama",
          contextLength: 8192,
          parameterCount: "8B",
          quantizationBits: 4,
          license: "MIT",
          description: "",
          uploadedAt: "2024-01-01",
          hfDownloads: 0,
          tags: [],
          isMoe: false,
          addedAt: 0,
        },
      ],
    });
    store.getState().locateModel("m1", "/new/path.gguf");
    const m = store.getState().models[0];
    expect(m.path).toBe("/new/path.gguf");
    expect(m.missing).toBe(false);
    expect(m.downloaded).toBe(true);
  });
});
