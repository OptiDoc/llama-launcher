import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import type { LlamaStore } from "@/stores/types";
import { createWorkspacesSlice } from "@/stores/workspaces-slice";
import { createModelsSlice } from "@/stores/models-slice";
import { createInstancesSlice } from "@/stores/instances-slice";
import { createDownloadsSlice } from "@/stores/downloads-slice";
import { createProfilesSlice } from "@/stores/profiles-slice";
import { createReleasesSlice } from "@/stores/releases-slice";
import { createNotificationsSlice } from "@/stores/notifications-slice";
import { createSystemSlice } from "@/stores/system-slice";
import { defaultWorkspaceSettings } from "@/lib/types";

function createTestStore() {
  return create<LlamaStore>((set, get) => ({
    ...createWorkspacesSlice(set, get),
    ...createModelsSlice(set, get),
    ...createInstancesSlice(set, get),
    ...createDownloadsSlice(set, get),
    ...createProfilesSlice(set, get),
    ...createReleasesSlice(set, get),
    ...createNotificationsSlice(set, get),
    ...createSystemSlice(set, get),
    globalSettings: {} as never,
    logs: {},
  }));
}

describe("workspaces-slice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("starts with empty workspaces and no active id", () => {
    expect(store.getState().workspaces).toEqual([]);
    expect(store.getState().activeWorkspaceId).toBe("");
  });

  it("setActiveWorkspace sets activeWorkspaceId", () => {
    store.setState({ workspaces: [{ id: "ws1", name: "Test", color: "blue", description: null }] });
    store.getState().setActiveWorkspace("ws1");
    expect(store.getState().activeWorkspaceId).toBe("ws1");
  });

  it("addWorkspace adds with id and default settings", () => {
    const id = store.getState().addWorkspace({ name: "My WS", description: "desc", color: "green" });
    const ws = store.getState().workspaces[0];
    expect(ws.id).toBe(id);
    expect(ws.name).toBe("My WS");
    expect(ws.color).toBe("green");
    expect(store.getState().workspaceSettings[id]).toEqual(defaultWorkspaceSettings);
  });

  it("updateWorkspace patches a workspace", () => {
    store.setState({ workspaces: [{ id: "ws1", name: "Old", color: "blue", description: null }] });
    store.getState().updateWorkspace("ws1", { name: "New Name" });
    expect(store.getState().workspaces[0].name).toBe("New Name");
    expect(store.getState().workspaces[0].color).toBe("blue");
  });

  it("removeWorkspace removes workspace and switches active if current removed", () => {
    store.setState({
      workspaces: [
        { id: "ws1", name: "A", color: "blue", description: null },
        { id: "ws2", name: "B", color: "green", description: null },
      ],
      activeWorkspaceId: "ws1",
    });
    store.getState().removeWorkspace("ws1");
    expect(store.getState().workspaces).toHaveLength(1);
    expect(store.getState().workspaces[0].id).toBe("ws2");
    expect(store.getState().activeWorkspaceId).toBe("ws2");
  });

  it("removeWorkspace does nothing if last remaining", () => {
    store.setState({
      workspaces: [{ id: "ws1", name: "Only", color: "blue", description: null }],
      activeWorkspaceId: "ws1",
    });
    store.getState().removeWorkspace("ws1");
    expect(store.getState().workspaces).toHaveLength(1);
    expect(store.getState().activeWorkspaceId).toBe("ws1");
  });

  it("updateGlobalSettings patches globalSettings", () => {
    store.getState().updateGlobalSettings({ defaultHost: "0.0.0.0" });
    expect(store.getState().globalSettings.defaultHost).toBe("0.0.0.0");
  });
});
