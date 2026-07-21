import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import type { LlamaStore } from "@/stores/types";
import { createNotificationsSlice } from "@/stores/notifications-slice";
import { createModelsSlice } from "@/stores/models-slice";
import { createInstancesSlice } from "@/stores/instances-slice";
import { createDownloadsSlice } from "@/stores/downloads-slice";
import { createProfilesSlice } from "@/stores/profiles-slice";
import { createReleasesSlice } from "@/stores/releases-slice";
import { createWorkspacesSlice } from "@/stores/workspaces-slice";
import { createSystemSlice } from "@/stores/system-slice";

function createTestStore() {
  return create<LlamaStore>((set, get) => ({
    ...createNotificationsSlice(set, get),
    ...createModelsSlice(set, get),
    ...createInstancesSlice(set, get),
    ...createDownloadsSlice(set, get),
    ...createProfilesSlice(set, get),
    ...createReleasesSlice(set, get),
    ...createWorkspacesSlice(set, get),
    ...createSystemSlice(set, get),
    globalSettings: {} as never,
    logs: {},
  }));
}

describe("notifications-slice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("starts with empty notifications", () => {
    expect(store.getState().notifications).toEqual([]);
  });

  it("adds a notification", () => {
    store.getState().addNotification({ kind: "info", title: "Test", body: "Hello" });

    const n = store.getState().notifications;
    expect(n).toHaveLength(1);
    expect(n[0].title).toBe("Test");
    expect(n[0].read).toBe(false);
    expect(n[0].id).toMatch(/^notif_/);
  });

  it("marks a notification as read", () => {
    store.getState().addNotification({ kind: "info", title: "T", body: "B" });
    const id = store.getState().notifications[0].id;

    store.getState().markNotificationRead(id);

    expect(store.getState().notifications[0].read).toBe(true);
  });

  it("marks all notifications as read", () => {
    store.getState().addNotification({ kind: "info", title: "A", body: "1" });
    store.getState().addNotification({ kind: "warning", title: "B", body: "2" });

    store.getState().markAllNotificationsRead();

    store.getState().notifications.forEach((n) => {
      expect(n.read).toBe(true);
    });
  });

  it("clears all notifications", () => {
    store.getState().addNotification({ kind: "info", title: "T", body: "B" });

    store.getState().clearNotifications();

    expect(store.getState().notifications).toEqual([]);
  });

  it("caps notifications at 50", () => {
    for (let i = 0; i < 60; i++) {
      store.getState().addNotification({ kind: "info", title: `N${i}`, body: "" });
    }

    expect(store.getState().notifications).toHaveLength(50);
  });
});
