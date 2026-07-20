import { tauri } from "@/lib/tauri-api";
import { isTauri } from "@/lib/tauri-api";
import type { Workspace, WorkspaceSettings, GlobalSettings } from "@/lib/types";
import { emitLog } from "@/lib/helpers";
import { SYSTEM_CONSOLE_ID, defaultWorkspaceSettings, defaultGlobalSettings } from "@/lib/types";
import { nowTs } from "@/lib/helpers";
import type { StoreApi } from "zustand";
import type { LlamaStore } from "@/stores/types";

export interface WorkspacesSlice {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  workspaceSettings: Record<string, WorkspaceSettings>;
  globalSettings: GlobalSettings;
  setActiveWorkspace: (id: string) => void;
  addWorkspace: (w: { name: string; description: string; color: Workspace["color"] }) => string;
  updateWorkspace: (id: string, patch: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
  updateGlobalSettings: (patch: Partial<GlobalSettings>) => void;
  updateWorkspaceSettings: (workspaceId: string, patch: Partial<WorkspaceSettings>) => void;
}

export function createWorkspacesSlice(
  set: StoreApi<LlamaStore>["setState"],
  get: StoreApi<LlamaStore>["getState"],
): WorkspacesSlice {
  return {
    workspaces: [],
    activeWorkspaceId: "",
    workspaceSettings: {},
    globalSettings: defaultGlobalSettings,

    setActiveWorkspace: (id) => {
      set({ activeWorkspaceId: id });
      const ws = get().workspaces.find((w) => w.id === id);
      if (ws) emitLog(SYSTEM_CONSOLE_ID, "info", `switched to workspace "${ws.name}"`);
    },

    addWorkspace: (w) => {
      const id = `ws_${Math.random().toString(36).slice(2, 8)}`;
      set((s) => ({
        workspaces: [...s.workspaces, { ...w, id }],
        workspaceSettings: { ...s.workspaceSettings, [id]: { ...defaultWorkspaceSettings } },
      }));
      return id;
    },

    updateWorkspace: (id, patch) =>
      set((s) => ({ workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),

    removeWorkspace: (id) =>
      set((s) => {
        if (s.workspaces.length <= 1) return s;
        const remaining = s.workspaces.filter((w) => w.id !== id);
        const newActive = s.activeWorkspaceId === id ? (remaining[0]?.id ?? "") : s.activeWorkspaceId;
        return {
          workspaces: remaining,
          instances: s.instances.filter((i) => i.workspaceId !== id),
          models: s.models.filter((m) => m.workspaceId !== id),
          activeWorkspaceId: newActive,
        };
      }),

    refreshWorkspaces: async () => {
      const tauriWorkspaces = await tauri.listWorkspaces();
      if (!tauriWorkspaces) {
        return;
      }
      const mapped: Workspace[] = tauriWorkspaces.map((w) => ({
        id: w.id,
        name: w.name,
        color: w.color as Workspace["color"],
        description: w.description ?? null,
      }));
      set({ workspaces: mapped });
    },

    updateGlobalSettings: (patch) => {
      set((s) => ({ globalSettings: { ...s.globalSettings, ...patch } }));
      if (isTauri() && (patch.modelsDir || patch.llamaCppPath || patch.cudaLibsDir)) {
        const s = get().globalSettings;
        tauri.getConfig().then((cfg) => {
          if (!cfg) return;
          tauri.updateConfig({
            ...cfg,
            models_directory: s.modelsDir,
            llama_binary_path: s.llamaCppPath || null,
          });
        });
      }
    },

    updateWorkspaceSettings: (workspaceId, patch) =>
      set((s) => ({
        workspaceSettings: {
          ...s.workspaceSettings,
          [workspaceId]: { ...(s.workspaceSettings[workspaceId] ?? defaultWorkspaceSettings), ...patch },
        },
      })),
  };
}
