import { vi } from "vitest";

vi.mock("@/lib/tauri-api", () => ({
  tauri: {
    scanModels: vi.fn().mockResolvedValue([]),
    getModelInfo: vi.fn().mockResolvedValue(null),
    deleteModel: vi.fn().mockResolvedValue(null),
    verifyModel: vi.fn().mockResolvedValue(null),
    downloadModel: vi.fn().mockResolvedValue(null),
    startModel: vi.fn().mockResolvedValue(null),
    stopModel: vi.fn().mockResolvedValue(null),
    restartModel: vi.fn().mockResolvedValue(null),
    getProcessStatus: vi.fn().mockResolvedValue(null),
    listProcesses: vi.fn().mockResolvedValue([]),
    getProcessMetrics: vi.fn().mockResolvedValue(null),
    getProcessStdout: vi.fn().mockResolvedValue(null),
    getSystemInfo: vi.fn().mockResolvedValue(null),
    getGpuInfo: vi.fn().mockResolvedValue([]),
    getSystemCapabilities: vi.fn().mockResolvedValue(null),
    detectLlamaBinary: vi.fn().mockResolvedValue(null),
    getConfig: vi.fn().mockResolvedValue(null),
    updateConfig: vi.fn().mockResolvedValue(null),
    listWorkspaces: vi.fn().mockResolvedValue([]),
    createWorkspace: vi.fn().mockResolvedValue(null),
    updateWorkspace: vi.fn().mockResolvedValue(null),
    deleteWorkspace: vi.fn().mockResolvedValue(null),
    getActiveWorkspace: vi.fn().mockResolvedValue(""),
    setActiveWorkspace: vi.fn().mockResolvedValue(null),
    getWorkspaceSettings: vi.fn().mockResolvedValue(null),
    updateWorkspaceSettings: vi.fn().mockResolvedValue(null),
    listReleaseVariants: vi.fn().mockResolvedValue([]),
    listGithubReleases: vi.fn().mockResolvedValue([]),
    writeFrontendLog: vi.fn().mockResolvedValue(null),
    openModelFolder: vi.fn().mockResolvedValue(null),
    selectModelFile: vi.fn().mockResolvedValue(null),
    selectModelFiles: vi.fn().mockResolvedValue([]),
    importModelFile: vi.fn().mockResolvedValue(null),
    importModelFiles: vi.fn().mockResolvedValue([]),
    selectDirectory: vi.fn().mockResolvedValue(null),
    installRelease: vi.fn().mockResolvedValue(null),
    extractZip: vi.fn().mockResolvedValue(null),
    downloadCudaLibs: vi.fn().mockResolvedValue(null),
    ensureAppDir: vi.fn().mockResolvedValue(""),
    downloadFile: vi.fn().mockResolvedValue(null),
    scanExternalModels: vi.fn().mockResolvedValue([]),
    syncExternalModels: vi.fn().mockResolvedValue(0),
    importExternalModel: vi.fn().mockResolvedValue(null),
    cancelDownload: vi.fn().mockResolvedValue(true),
  },
  isTauri: vi.fn(() => false),
  formatBytes: vi.fn((b: number) => `${(b / 1e9).toFixed(2)} GB`),
  formatUptime: vi.fn(() => "1m 30s"),
}));

vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
  },
  persistToBackend: vi.fn(),
}));

vi.mock("@/lib/helpers", async () => {
  const actual = await vi.importActual("@/lib/helpers");
  return {
    ...(actual as Record<string, unknown>),
    uid: vi.fn((prefix = "id") => `${prefix}_test123`),
    nowTs: vi.fn(() => 1000000),
  };
});

vi.mock("@/lib/catalog", () => ({
  HF_CATALOG: [],
  HF_QUANTS: [],
  RELEASE_VARIANTS: [
    { id: "cpu", label: "CPU", priority: false, note: "" },
    { id: "cuda12", label: "CUDA 12", priority: true, note: "" },
  ],
  searchHFModels: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/utils", async () => {
  const actual = await vi.importActual("@/lib/utils");
  return {
    ...actual,
    cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  };
});
