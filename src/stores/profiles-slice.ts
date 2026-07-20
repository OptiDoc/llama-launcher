import type { LlamaProfile } from "@/lib/types";
import { uid } from "@/lib/helpers";
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

    addProfile: (p) => set((s) => ({ profiles: [...s.profiles, { ...p, id: uid("prof") }] })),

    removeProfile: (id) => set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) })),

    shareProfile: (id) =>
      set((s) => ({
        profiles: s.profiles.map((p) =>
          p.id === id ? { ...p, shared: true, shareId: p.shareId ?? `sh_${id}_v1` } : p,
        ),
      })),

    calibrateProfile: (id) =>
      set((s) => ({
        profiles: s.profiles.map((p) =>
          p.id === id
            ? { ...p, calibrationScore: Math.min(100, (p.calibrationScore ?? 70) + 5 + Math.floor(Math.random() * 8)) }
            : p,
        ),
      })),
  };
}
