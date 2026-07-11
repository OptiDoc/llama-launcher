/**
 * LlamaLauncher state store — wired to the real Tauri 2 backend.
 *
 * All data (models, processes, system info, config) comes from Rust commands
 * in `src-tauri/src/commands.rs` via `src/lib/tauri-api.ts`. When running
 * outside Tauri (plain browser / Next.js dev server) the calls return null
 * and the UI renders honest empty states — there is NO fake/seed data.
 *
 * The store holds the last-fetched snapshot and exposes actions that call
 * Tauri then refresh the relevant slice. A background poller keeps process
 * list + system metrics fresh.
 */

import { create } from "zustand";
import {
  tauri,
  isTauri,
  formatBytes,
  formatUptime,
  type ModelInfo,
  type ProcessInfo,
  type ProcessConfig,
  type ProcessMetrics,
  type SystemSnapshot,
  type GpuInfo,
  type AppConfig,
  type DownloadProgress,
  type BenchmarkResult,
  type BenchmarkConfig,
} from "@/lib/tauri-api";

// Re-export the Tauri types so existing UI imports keep working
export type {
  ModelInfo,
  ProcessInfo,
  ProcessConfig,
  ProcessMetrics,
  SystemSnapshot,
  GpuInfo,
  AppConfig,
  DownloadProgress,
  BenchmarkResult,
  BenchmarkConfig,
  ModelFormat,
  ProcessStatus,
  GpuVendor,
  Theme,
} from "@/lib/tauri-api";

export { isTauri, formatBytes, formatUptime };

// ---------- UI-only types (frontend concepts, not in backend) ----------

export type ViewMode = "grid" | "table";

/** A model download tracked in the frontend while in progress. */
export interface ModelDownload {
  id: string;
  repo: string;
  file: string;
  modelName: string;
  progress: number; // 0..100
  downloadedBytes: number;
  totalBytes: number;
  speed: number; // bytes/sec
  status: "downloading" | "completed" | "failed";
  startedAt: number;
  modelId?: string;
}

export type AppNotificationKind = "info" | "success" | "warn" | "error" | "release" | "download";

export interface AppNotification {
  id: string;
  kind: AppNotificationKind;
  title: string;
  body: string;
  ts: number;
  read: boolean;
}

/** A launch profile is a frontend-only convenience preset stored in localStorage. */
export interface LaunchProfile {
  id: string;
  name: string;
  description: string;
  config: Partial<ProcessConfig>;
}

// ---------- Store ----------

interface LlamaStore {
  // backend data
  models: ModelInfo[];
  processes: ProcessInfo[];
  system: SystemSnapshot | null;
  gpus: GpuInfo[];
  config: AppConfig | null;
  llamaBinary: string | null;

  // frontend-only
  downloads: ModelDownload[];
  notifications: AppNotification[];
  profiles: LaunchProfile[];

  // console (process stdout/stderr — kept as a simple ring buffer per process)
  consoleLogs: Record<string, string[]>;
  activeConsoleId: string;
  consoleOpen: boolean;
  consoleHeight: number;

  // loading flags
  loadingModels: boolean;
  loadingProcesses: boolean;
  loadingSystem: boolean;
  lastError: string | null;

  // actions — data fetching
  refreshModels: () => Promise<void>;
  refreshProcesses: () => Promise<void>;
  refreshSystem: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  refreshAll: () => Promise<void>;

  // actions — mutations
  deleteModel: (id: string) => Promise<void>;
  verifyModel: (id: string) => Promise<boolean | null>;
  startModel: (modelId: string, config?: Partial<ProcessConfig>) => Promise<ProcessInfo | null>;
  stopModel: (id: string) => Promise<void>;
  restartModel: (id: string) => Promise<ProcessInfo | null>;
  downloadModel: (repo: string, file: string, modelName: string) => Promise<void>;
  saveConfig: (config: AppConfig) => Promise<void>;

  // console
  setActiveConsole: (id: string) => void;
  toggleConsole: () => void;
  setConsoleOpen: (open: boolean) => void;
  setConsoleHeight: (h: number) => void;
  clearConsole: (id: string) => void;
  appendConsoleLog: (id: string, line: string) => void;

  // notifications
  addNotification: (n: Omit<AppNotification, "id" | "ts" | "read">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;

  // profiles (localStorage)
  addProfile: (p: Omit<LaunchProfile, "id">) => void;
  removeProfile: (id: string) => void;
}

const SYSTEM_CONSOLE_ID = "system";
export const SYSTEM_CONSOLE = SYSTEM_CONSOLE_ID;

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

// Profiles persisted to localStorage
const PROFILES_KEY = "ll-launcher-profiles";
function loadProfiles(): LaunchProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    return raw ? (JSON.parse(raw) as LaunchProfile[]) : [];
  } catch {
    return [];
  }
}
function saveProfiles(profiles: LaunchProfile[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  } catch {
    /* ignore */
  }
}

// Background pollers
let processPoller: ReturnType<typeof setInterval> | null = null;
let systemPoller: ReturnType<typeof setInterval> | null = null;

function startPollers(store: LlamaStore) {
  if (typeof window === "undefined") return;
  if (processPoller) clearInterval(processPoller);
  if (systemPoller) clearInterval(systemPoller);
  // Only poll when running in Tauri (real data). In browser, no point.
  if (!isTauri()) return;
  processPoller = setInterval(() => {
    useLlamaStore.getState().refreshProcesses();
  }, 3000);
  systemPoller = setInterval(() => {
    useLlamaStore.getState().refreshSystem();
  }, 2000);
}

export const useLlamaStore = create<LlamaStore>((set, get) => ({
  models: [],
  processes: [],
  system: null,
  gpus: [],
  config: null,
  llamaBinary: null,

  downloads: [],
  notifications: [],
  profiles: loadProfiles(),

  consoleLogs: {
    [SYSTEM_CONSOLE_ID]: [
      isTauri()
        ? "[boot] LlamaLauncher ready — connected to Tauri backend"
        : "[boot] Running in browser mode — start the Tauri desktop app to scan real models.",
    ],
  },
  activeConsoleId: SYSTEM_CONSOLE_ID,
  consoleOpen: false,
  consoleHeight: 240,

  loadingModels: false,
  loadingProcesses: false,
  loadingSystem: false,
  lastError: null,

  refreshModels: async () => {
    set({ loadingModels: true });
    const models = await tauri.scanModels();
    set({ models: models ?? [], loadingModels: false });
    if (models === null) {
      set({ lastError: "Not running in Tauri — model scan unavailable." });
    }
  },

  refreshProcesses: async () => {
    const processes = await tauri.listProcesses();
    set({ processes: processes ?? [] });
  },

  refreshSystem: async () => {
    const [sys, gpus] = await Promise.all([
      tauri.getSystemInfo(),
      tauri.getGpuInfo(),
    ]);
    set({ system: sys, gpus: gpus ?? [] });
  },

  refreshConfig: async () => {
    const [config, binary] = await Promise.all([
      tauri.getConfig(),
      tauri.detectLlamaBinary(),
    ]);
    set({ config, llamaBinary: binary });
  },

  refreshAll: async () => {
    await Promise.all([
      get().refreshModels(),
      get().refreshProcesses(),
      get().refreshSystem(),
      get().refreshConfig(),
    ]);
    startPollers(get());
  },

  deleteModel: async (id) => {
    await tauri.deleteModel(id);
    await get().refreshModels();
    get().addNotification({ kind: "success", title: "Model deleted", body: "The model file was removed from disk." });
  },

  verifyModel: async (id) => {
    const result = await tauri.verifyModel(id);
    return result?.valid ?? null;
  },

  startModel: async (modelId, config) => {
    const proc = await tauri.startModel(modelId, config);
    if (proc) {
      set((s) => ({
        processes: [...s.processes.filter((p) => p.id !== proc.id), proc],
        activeConsoleId: proc.id,
        consoleOpen: true,
        consoleLogs: { ...s.consoleLogs, [proc.id]: [] },
      }));
      get().appendConsoleLog(
        proc.id,
        `[launch] started llama-server · model=${modelId} · port=${proc.port} · pid=${proc.pid ?? "?"}`,
      );
      get().addNotification({ kind: "success", title: "Instance started", body: `llama-server listening on port ${proc.port}.` });
    }
    return proc;
  },

  stopModel: async (id) => {
    get().appendConsoleLog(id, "[stop] sending stop signal…");
    await tauri.stopModel(id);
    await get().refreshProcesses();
    get().addNotification({ kind: "info", title: "Instance stopped", body: "The llama-server process was terminated." });
  },

  restartModel: async (id) => {
    const proc = await tauri.restartModel(id);
    if (proc) {
      await get().refreshProcesses();
      get().addNotification({ kind: "info", title: "Instance restarted", body: `llama-server restarted on port ${proc.port}.` });
    }
    return proc;
  },

  downloadModel: async (repo, file, modelName) => {
    const dlId = uid("dl");
    set((s) => ({
      downloads: [
        ...s.downloads,
        {
          id: dlId, repo, file, modelName,
          progress: 0, downloadedBytes: 0, totalBytes: 0, speed: 0,
          status: "downloading", startedAt: Date.now(),
        },
      ],
    }));
    get().appendConsoleLog(SYSTEM_CONSOLE_ID, `[hf] downloading ${file} from ${repo}…`);

    const result = await tauri.downloadModel(repo, file, (p: DownloadProgress) => {
      const pct = p.total > 0 ? (p.downloaded / p.total) * 100 : 0;
      set((s) => ({
        downloads: s.downloads.map((d) =>
          d.id === dlId
            ? { ...d, progress: pct, downloadedBytes: p.downloaded, totalBytes: p.total, speed: p.speed }
            : d,
        ),
      }));
    });

    if (result) {
      set((s) => ({
        downloads: s.downloads.map((d) =>
          d.id === dlId ? { ...d, status: "completed", progress: 100, modelId: result.id } : d,
        ),
      }));
      get().appendConsoleLog(SYSTEM_CONSOLE_ID, `[hf] download complete: ${file} (${formatBytes(result.size)})`);
      get().addNotification({ kind: "download", title: "Model downloaded", body: `${modelName} is ready to use.` });
      await get().refreshModels();
    } else {
      set((s) => ({
        downloads: s.downloads.map((d) =>
          d.id === dlId ? { ...d, status: "failed" } : d,
        ),
      }));
      get().appendConsoleLog(SYSTEM_CONSOLE_ID, `[hf] download failed for ${file}`);
    }
  },

  saveConfig: async (config) => {
    await tauri.updateConfig(config);
    set({ config });
    get().addNotification({ kind: "success", title: "Settings saved", body: "Configuration updated." });
  },

  // ---------- console ----------
  setActiveConsole: (id) => set({ activeConsoleId: id, consoleOpen: true }),
  toggleConsole: () => set((s) => ({ consoleOpen: !s.consoleOpen })),
  setConsoleOpen: (open) => set({ consoleOpen: open }),
  setConsoleHeight: (h) => set({ consoleHeight: Math.max(120, Math.min(600, h)) }),
  clearConsole: (id) => set((s) => ({ consoleLogs: { ...s.consoleLogs, [id]: [] } })),
  appendConsoleLog: (id, line) =>
    set((s) => {
      const list = s.consoleLogs[id] ?? [];
      const next = list.length > 800 ? list.slice(list.length - 800) : list;
      return { consoleLogs: { ...s.consoleLogs, [id]: [...next, line] } };
    }),

  // ---------- notifications ----------
  addNotification: (n) =>
    set((s) => ({
      notifications: [{ ...n, id: uid("notif"), ts: Date.now(), read: false }, ...s.notifications].slice(0, 50),
    })),
  markNotificationRead: (id) =>
    set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
  markAllNotificationsRead: () =>
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  clearNotifications: () => set({ notifications: [] }),

  // ---------- profiles (localStorage) ----------
  addProfile: (p) => {
    const profile = { ...p, id: uid("prof") };
    set((s) => {
      const profiles = [...s.profiles, profile];
      saveProfiles(profiles);
      return { profiles };
    });
  },
  removeProfile: (id) => {
    set((s) => {
      const profiles = s.profiles.filter((p) => p.id !== id);
      saveProfiles(profiles);
      return { profiles };
    });
  },
}));

// Kick off the initial data fetch + pollers when running in the browser.
if (typeof window !== "undefined") {
  // Defer so the first paint isn't blocked.
  setTimeout(() => {
    useLlamaStore.getState().refreshAll();
  }, 300);
}

// ---------- Backwards-compat helpers used by older UI code ----------

/** Derived: running process count. */
export function useRunningCount(): number {
  return useLlamaStore((s) => s.processes.filter((p) => p.status === "running" || p.status === "starting").length);
}

/** Derived: total tokens/sec across running processes. */
export function useTotalTps(): number {
  return useLlamaStore((s) =>
    s.processes
      .filter((p) => p.status === "running")
      .reduce((sum, p) => sum + (p.tokens_per_sec || 0), 0),
  );
}
