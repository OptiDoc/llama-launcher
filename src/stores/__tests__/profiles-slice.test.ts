import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import type { LlamaStore } from "@/stores/types";
import type { LlamaProfile } from "@/lib/types";
import { createProfilesSlice } from "@/stores/profiles-slice";
import { createModelsSlice } from "@/stores/models-slice";
import { createInstancesSlice } from "@/stores/instances-slice";
import { createDownloadsSlice } from "@/stores/downloads-slice";
import { createNotificationsSlice } from "@/stores/notifications-slice";
import { createReleasesSlice } from "@/stores/releases-slice";
import { createWorkspacesSlice } from "@/stores/workspaces-slice";
import { createSystemSlice } from "@/stores/system-slice";

function createTestStore() {
  return create<LlamaStore>((set, get) => ({
    ...createProfilesSlice(set, get),
    ...createModelsSlice(set, get),
    ...createInstancesSlice(set, get),
    ...createDownloadsSlice(set, get),
    ...createNotificationsSlice(set, get),
    ...createReleasesSlice(set, get),
    ...createWorkspacesSlice(set, get),
    ...createSystemSlice(set, get),
    globalSettings: {} as never,
    logs: {},
  }));
}

describe("profiles-slice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("starts with empty profiles", () => {
    expect(store.getState().profiles).toEqual([]);
  });

  it("adds a profile", () => {
    store.getState().addProfile({
      name: "Test Profile",
      description: "A test",
      scope: "global",
      ctxSize: "8192",
      gpuLayers: "-1",
      threads: "8",
      batchSize: "512",
      ubatchSize: "512",
      flashAttention: true,
      mmap: true,
      mlock: false,
      numa: false,
      parallel: "-1",
      contBatching: true,
      nPredict: "-1",
      timeout: "3600",
      metrics: false,
      apiKey: "",
      threadsBatch: "-1",
      cacheTypeK: "f16",
      cacheTypeV: "f16",
      splitMode: "layer",
      tensorSplit: "",
      mainGpu: "0",
      kvOffload: true,
      fit: true,
      temperature: "0.8",
      topK: "40",
      topP: "0.95",
      minP: "0.05",
      repeatPenalty: "1.1",
      repeatLastN: "64",
      presencePenalty: "0",
      frequencyPenalty: "0",
      seed: "-1",
      lora: "",
      mmproj: "",
      jinja: true,
      reasoningFormat: "auto",
      reasoningBudget: "-1",
      chatTemplate: "",
      ropeScaling: "",
      ropeScale: "0",
      ropeFreqBase: "0",
      ropeFreqScale: "0",
      grammar: "",
      jsonSchema: "",
      logLevel: "3",
      extraArgs: "",
      createdAt: 0,
      updatedAt: 0,
    } as never);

    const profiles = store.getState().profiles;
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe("Test Profile");
    expect(profiles[0].id).toMatch(/^prof_/);
  });

  it("removes a profile by id", () => {
    store.getState().addProfile({ name: "P1", scope: "global" } as never);
    const id = store.getState().profiles[0].id;

    store.getState().removeProfile(id);

    expect(store.getState().profiles).toHaveLength(0);
  });

  it("shares a profile", () => {
    store.getState().addProfile({ name: "P1", scope: "global" } as never);
    const p = store.getState().profiles[0];

    store.getState().shareProfile(p.id);

    const updated = store.getState().profiles[0];
    expect(updated.shared).toBe(true);
    expect(updated.shareId).toMatch(/^sh_/);
  });

  it("calibrates a profile", () => {
    store.getState().addProfile({ name: "P1", scope: "global" } as never);
    const p = store.getState().profiles[0];
    const oldScore = p.calibrationScore;

    store.getState().calibrateProfile(p.id);

    const updated = store.getState().profiles[0];
    expect(updated.calibrationScore).toBeGreaterThanOrEqual(oldScore ?? 70);
  });

  it("does nothing when removing non-existent profile", () => {
    store.getState().removeProfile("nonexistent");
    expect(store.getState().profiles).toHaveLength(0);
  });
});
