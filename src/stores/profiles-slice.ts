import type { LlamaProfile } from "@/lib/types";
import { uid, NOTIF_MESSAGES } from "@/lib/helpers";
import type { StoreApi } from "zustand";
import type { LlamaStore } from "@/stores/types";

export interface ProfilesSlice {
  profiles: LlamaProfile[];
  addProfile: (p: Omit<LlamaProfile, "id">) => void;
  removeProfile: (id: string) => void;
  shareProfile: (id: string) => void;
  calibrateProfile: (id: string) => void;
}

export function createProfilesSlice(
  set: StoreApi<LlamaStore>["setState"],
  get: StoreApi<LlamaStore>["getState"],
): ProfilesSlice {
  return {
    profiles: [],

    addProfile: (p) => {
      set((s) => ({ profiles: [...s.profiles, { ...p, id: uid("prof") }] }));
      get().addNotification?.(NOTIF_MESSAGES.configUpdated(`Profile "${p.name}" created`));
    },

    removeProfile: (id) => {
      const profile = get().profiles.find((p) => p.id === id);
      set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) }));
      if (profile) {
        get().addNotification?.(NOTIF_MESSAGES.configUpdated(`Profile "${profile.name}" removed`));
      }
    },

    shareProfile: (id) => {
      const profile = get().profiles.find((p) => p.id === id);
      set((s) => ({
        profiles: s.profiles.map((p) =>
          p.id === id ? { ...p, shared: true, shareId: p.shareId ?? `sh_${id}_v1` } : p,
        ),
      }));
      if (profile) {
        get().addNotification?.(NOTIF_MESSAGES.configUpdated(`Profile "${profile.name}" shared`));
      }
    },

    calibrateProfile: (id) => {
      const profile = get().profiles.find((p) => p.id === id);
      set((s) => ({
        profiles: s.profiles.map((p) =>
          p.id === id
            ? { ...p, calibrationScore: Math.min(100, (p.calibrationScore ?? 70) + 5 + Math.floor(Math.random() * 8)) }
            : p,
        ),
      }));
      if (profile) {
        const score = Math.min(100, (profile.calibrationScore ?? 70) + 5 + Math.floor(Math.random() * 8));
        get().addNotification?.({ kind: "success", title: "Profile calibrated", body: `${profile.name}: ${score}%` });
      }
    },
  };
}
