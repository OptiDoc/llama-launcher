import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import type { LlamaStore } from "@/stores/types";
import { createSystemSlice } from "@/stores/system-slice";
import { createModelsSlice } from "@/stores/models-slice";
import { createInstancesSlice } from "@/stores/instances-slice";
import { createDownloadsSlice } from "@/stores/downloads-slice";
import { createProfilesSlice } from "@/stores/profiles-slice";
import { createReleasesSlice } from "@/stores/releases-slice";
import { createWorkspacesSlice } from "@/stores/workspaces-slice";
import { createNotificationsSlice } from "@/stores/notifications-slice";

function createTestStore() {
  return create<LlamaStore>((set, get) => ({
    ...createSystemSlice(set, get),
    ...createModelsSlice(set, get),
    ...createInstancesSlice(set, get),
    ...createDownloadsSlice(set, get),
    ...createProfilesSlice(set, get),
    ...createReleasesSlice(set, get),
    ...createWorkspacesSlice(set, get),
    ...createNotificationsSlice(set, get),
    globalSettings: {} as never,
    logs: {},
  }));
}

describe("system-slice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("starts with default values", () => {
    const s = store.getState();
    expect(s.appStatus).toBe("active");
    expect(s.tauriReady).toBe(false);
    expect(s.hibernatedInstanceIds).toEqual([]);
    expect(s.metrics.length).toBe(60);
  });

  it("setAppStatus changes status", () => {
    store.getState().setAppStatus("idle");
    expect(store.getState().appStatus).toBe("idle");
    store.getState().setAppStatus("hibernating");
    expect(store.getState().appStatus).toBe("hibernating");
    store.getState().setAppStatus("active");
    expect(store.getState().appStatus).toBe("active");
  });

  it("forceHibernate sets lastActivityAt in the past to trigger hibernation", () => {
    store.getState().forceHibernate();
    const s = store.getState();
    expect(s.lastActivityAt).toBeLessThan(Date.now() - 60 * 1000);
  });

  it("pushMetric adds sample and keeps last 60", () => {
    for (let i = 0; i < 10; i++) {
      store.getState().pushMetric({ t: i, cpu: i, ram: 0, gpu: 0, gpuMem: 0, tps: 0, reqPerMin: 0 });
    }
    expect(store.getState().metrics).toHaveLength(60);
    expect(store.getState().metrics[store.getState().metrics.length - 1].cpu).toBe(9);
  });

  it("registerActivity updates lastActivityAt", () => {
    const before = store.getState().lastActivityAt;
    store.getState().registerActivity();
    expect(store.getState().lastActivityAt).toBeGreaterThanOrEqual(before);
  });

  it("registerActivity wakes from hibernation", () => {
    store.setState({ appStatus: "hibernating", hibernatedInstanceIds: ["inst1"] });
    store.getState().registerActivity();
    const s = store.getState();
    expect(s.appStatus).toBe("waking");
    expect(s.hibernatedInstanceIds).toEqual([]);
  });

  it("refreshSystem resolves without crashing", async () => {
    await expect(store.getState().refreshSystem()).resolves.toBeUndefined();
  });
});
