import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import type { LlamaStore } from "@/stores/types";
import { createReleasesSlice } from "@/stores/releases-slice";
import { createModelsSlice } from "@/stores/models-slice";
import { createInstancesSlice } from "@/stores/instances-slice";
import { createDownloadsSlice } from "@/stores/downloads-slice";
import { createProfilesSlice } from "@/stores/profiles-slice";
import { createWorkspacesSlice } from "@/stores/workspaces-slice";
import { createNotificationsSlice } from "@/stores/notifications-slice";
import { createSystemSlice } from "@/stores/system-slice";

function createTestStore() {
  return create<LlamaStore>((set, get) => ({
    ...createReleasesSlice(set, get),
    ...createModelsSlice(set, get),
    ...createInstancesSlice(set, get),
    ...createDownloadsSlice(set, get),
    ...createProfilesSlice(set, get),
    ...createWorkspacesSlice(set, get),
    ...createNotificationsSlice(set, get),
    ...createSystemSlice(set, get),
    globalSettings: {} as never,
    logs: {},
  }));
}

describe("releases-slice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("starts with empty releases and not refreshing", () => {
    expect(store.getState().releases).toEqual([]);
    expect(store.getState().refreshingReleases).toBe(false);
  });

  it("installRelease marks release as installed", () => {
    store.setState({
      releases: [
        {
          id: "r1",
          tag: "b9951",
          installed: false,
          variant: "cuda12",
          publishedAt: "",
          commit: "",
          notes: "",
          priority: false,
          sizeMb: 0,
          workspaceId: undefined,
          published_at: "",
          download_url: "",
          size_mb: 0,
        } as never,
      ],
    });
    store.getState().installRelease("r1");
    expect(store.getState().releases[0].installed).toBe(true);
  });

  it("uninstallRelease marks release as not installed", () => {
    store.setState({
      releases: [
        {
          id: "r1",
          tag: "b9951",
          installed: true,
          variant: "cuda12",
          publishedAt: "",
          commit: "",
          notes: "",
          priority: false,
          sizeMb: 0,
          workspaceId: undefined,
          published_at: "",
          download_url: "",
          size_mb: 0,
        } as never,
      ],
    });
    store.getState().uninstallRelease("r1");
    expect(store.getState().releases[0].installed).toBe(false);
  });

  it("refreshReleases resolves without crashing", async () => {
    await expect(store.getState().refreshReleases()).resolves.toBeUndefined();
  });
});
