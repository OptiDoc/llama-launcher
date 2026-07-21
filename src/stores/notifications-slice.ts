import type { AppNotification, NotificationKind } from "@/lib/types";
import { uid, nowTs } from "@/lib/helpers";
import type { StoreApi } from "zustand";
import type { LlamaStore } from "@/stores/types";

export interface NotificationsSlice {
  notifications: AppNotification[];
  addNotification: (n: Omit<AppNotification, "id" | "ts" | "read">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  syncFromBackend: (backendNotifs: AppNotification[]) => void;
}

export function createNotificationsSlice(
  set: StoreApi<LlamaStore>["setState"],
  get: StoreApi<LlamaStore>["getState"],
): NotificationsSlice {
  return {
    notifications: [],

    addNotification: (n) =>
      set((s) => ({
        notifications: [{ ...n, id: uid("notif"), ts: nowTs(), read: false }, ...s.notifications].slice(0, 50),
      })),

    markNotificationRead: (id) =>
      set((s) => ({
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      })),

    markAllNotificationsRead: () =>
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, read: true })),
      })),

    clearNotifications: () => set({ notifications: [] }),

    syncFromBackend: (backendNotifs) =>
      set((s) => {
        const existingIds = new Set(s.notifications.map((n) => n.id));
        const incoming = backendNotifs.filter((n) => !existingIds.has(n.id));
        if (incoming.length === 0) return s;
        const merged = [...incoming, ...s.notifications].slice(0, 50);
        return { notifications: merged };
      }),
  };
}
