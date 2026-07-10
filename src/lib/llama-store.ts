/**
 * LlamaLauncher state store + simulator.
 *
 * This is a client-side simulation of llama.cpp server instances.
 * Each "instance" represents a llama-server process that streams
 * realistic startup logs to its own console buffer.
 *
 * Extended with:
 * - Workspaces (isolated environments)
 * - App status / hibernation (auto-unload models after idle period,
 *   hot-reload on next request)
 * - Profiles with scope: 'global' | 'model' (for sharing + auto-calibration)
 * - HuggingFace model download queue with quantization picker
 * - Real-time system metrics stream (CPU/RAM/GPU/tok/s) for the dashboard
 */

import { create } from "zustand";

// ---------- Types ----------

export type InstanceStatus = "stopped" | "starting" | "running" | "stopping" | "error";

export type AppStatus = "active" | "idle" | "hibernating" | "waking";

export type LogKind = "info" | "success" | "warn" | "error" | "debug";

export interface ConsoleLine {
  id: string;
  instanceId: string;
  ts: number;
  kind: LogKind;
  text: string;
}

export interface LlamaInstance {
  id: string;
  name: string;
  model: string;
  profile: string;
  port: number;
  host: string;
  status: InstanceStatus;
  gpu: string;
  ctxSize: number;
  threads: number;
  color: "green" | "orange" | "blue" | "pink" | "purple";
  startedAt?: number;
  uptimeSec?: number;
  promptTokens: number;
  generatedTokens: number;
  requestsPerMin: number;
  tokensPerSec: number;
  memoryMb: number;
  /** snapshot used to restore after hibernation */
  hibernatedConfig?: { name: string; model: string; profile: string; port: number; host: string; gpu: string };
}

export interface LlamaModel {
  id: string;
  name: string;
  family: string;
  sizeGb: number;
  quant: string;
  downloaded: boolean;
  path: string;
  /** HuggingFace source repo, when known */
  hfRepo?: string;
}

export type ProfileScope = "global" | "model";

export interface LlamaProfile {
  id: string;
  name: string;
  description: string;
  ctxSize: number;
  threads: number;
  gpuLayers: number;
  flashAttention: boolean;
  extraArgs: string;
  scope: ProfileScope;
  /** when scope === 'model', the model id this profile is tuned for */
  modelId?: string;
  /** sharing metadata */
  shared?: boolean;
  shareId?: string;
  /** auto-calibration score 0..100 */
  calibrationScore?: number;
}

export interface LlamaRelease {
  id: string;
  tag: string;
  publishedAt: string;
  commit: string;
  notes: string;
  installed: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  color: "green" | "orange" | "blue" | "pink" | "purple";
  description?: string;
}

export interface HFDownload {
  id: string;
  repo: string;
  quant: string;
  filename: string;
  sizeGb: number;
  progress: number; // 0..100
  status: "queued" | "downloading" | "completed" | "failed";
  startedAt: number;
  modelName: string;
}

export interface MetricSample {
  t: number;
  cpu: number;
  ram: number;
  gpu: number;
  gpuMem: number;
  tps: number;
  reqPerMin: number;
}

// ---------- Simulator ----------

interface SimState {
  running: boolean;
  ticks: number;
  stop: () => void;
}

const instanceSims = new Map<string, SimState>();
const logSubscribers = new Set<(line: ConsoleLine) => void>();

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowTs() {
  return Date.now();
}

function emitLog(instanceId: string, kind: LogKind, text: string) {
  const line: ConsoleLine = {
    id: uid("log"),
    instanceId,
    ts: nowTs(),
    kind,
    text,
  };
  logSubscribers.forEach((fn) => fn(line));
  return line;
}

function fmtTime(d: Date) {
  return d.toTimeString().slice(0, 8);
}

function runStartupSequence(
  instance: LlamaInstance,
  store: LlamaStore,
) {
  let cancelled = false;
  let reqTimer: ReturnType<typeof setTimeout> | null = null;

  const sim: SimState = {
    running: true,
    ticks: 0,
    stop: () => {
      cancelled = true;
      sim.running = false;
      if (reqTimer) clearTimeout(reqTimer);
    },
  };
  instanceSims.set(instance.id, sim);

  const steps: Array<[number, LogKind, string]> = [
    [50, "info", `$ llama-server --model ${instance.model} --host ${instance.host} --port ${instance.port} -c ${instance.ctxSize} -t ${instance.threads} -ngl ${instance.gpu === "cpu" ? 0 : 99}`],
    [120, "debug", "build: 4402 (8f1f7e1) with AVX2=1 AVX512=1 BMI2=1 CUDA=1"],
    [180, "info", "system_info: n_threads = " + instance.threads + " n_gpu_layers = 99"],
    [260, "info", "loading model from " + instance.model],
    [380, "debug", "llama_model_loader: loaded meta data with 24 KV pairs"],
    [440, "debug", "llama_model_loader: - kv[ 0]:                       general.name = " + instance.name],
    [520, "debug", "llama_model_loader: - kv[ 1]:          general.architecture = llama"],
    [600, "info", `llama_model_loader: - kv[12]:                      llama.context_length = ${instance.ctxSize}`],
    [680, "debug", "llama_model_loader: - type  f16:  221 tensors"],
    [760, "info", "llama_model_loader: loading model part 1/1 from '" + instance.model + "'"],
    [900, "info", "llama_model_loader: model size = " + (instance.model.includes("7b") ? "13.9" : "4.1") + " GiB"],
    [980, "success", "llama_model_loader: model loaded successfully"],
    [1060, "info", "using CUDA for GPU acceleration"],
    [1140, "debug", "llama_kv_cache:  CUDA0 KV buffer size = " + Math.round(instance.ctxSize * 0.5) + " MiB"],
    [1220, "info", "llama_new_context_with_model: n_ctx = " + instance.ctxSize + ", batch = 512"],
    [1320, "success", "llama_new_context_with_model: graph initialized"],
    [1400, "info", `llama server: listening on ${instance.host}:${instance.port}`],
    [1480, "info", "llama server: loading model took " + (1200 + Math.floor(Math.random() * 600)) + " ms"],
    [1560, "success", `llama server: model loaded, ready for requests at http://${instance.host}:${instance.port}`],
  ];

  let elapsed = 0;
  steps.forEach(([delay, kind, text]) => {
    if (cancelled) return;
    setTimeout(() => {
      if (cancelled) return;
      emitLog(instance.id, kind, `[${fmtTime(new Date())}] ${text}`);
    }, delay);
    elapsed = delay;
  });

  setTimeout(() => {
    if (cancelled) return;
    store.markRunning(instance.id);
    emitLog(instance.id, "success", `[${fmtTime(new Date())}] ✓ Server ready. Listening on http://${instance.host}:${instance.port}/completions`);

    const tick = () => {
      if (cancelled || !sim.running) return;
      sim.ticks += 1;
      const t = sim.ticks;
      // Each request bumps activity -> resets idle timer
      store.registerActivity();
      if (t % 3 === 0) {
        const promptTok = 8 + Math.floor(Math.random() * 80);
        const genTok = 12 + Math.floor(Math.random() * 120);
        const tps = 18 + Math.random() * 24;
        emitLog(instance.id, "info", `[${fmtTime(new Date())}] POST /v1/chat/completions 200 - prompt: ${promptTok} tok, gen: ${genTok} tok, ${tps.toFixed(1)} tok/s`);
        store.bumpStats(instance.id, promptTok, genTok, tps);
      } else if (t % 5 === 0) {
        emitLog(instance.id, "debug", `[${fmtTime(new Date())}] slot 0: cache reused, kv tokens = ${100 + Math.floor(Math.random() * 400)}`);
      } else if (t % 7 === 0) {
        emitLog(instance.id, "warn", `[${fmtTime(new Date())}] request queue depth = ${1 + Math.floor(Math.random() * 3)}`);
      }
      reqTimer = setTimeout(tick, 1800 + Math.random() * 1200);
    };
    reqTimer = setTimeout(tick, 1800);
  }, elapsed + 200);
}

function runShutdownSequence(
  instance: LlamaInstance,
  store: LlamaStore,
) {
  const sim = instanceSims.get(instance.id);
  if (sim) sim.stop();

  emitLog(instance.id, "warn", `[${fmtTime(new Date())}] received SIGINT, shutting down...`);
  setTimeout(() => {
    emitLog(instance.id, "info", `[${fmtTime(new Date())}] waiting for in-flight requests to finish`);
  }, 200);
  setTimeout(() => {
    emitLog(instance.id, "info", `[${fmtTime(new Date())}] freeing KV cache and model buffers`);
  }, 450);
  setTimeout(() => {
    emitLog(instance.id, "success", `[${fmtTime(new Date())}] server stopped cleanly. goodbye.`);
    store.markStopped(instance.id);
  }, 700);
}

// ---------- HuggingFace quantization catalog ----------

export const HF_QUANTS: { id: string; label: string; sizeFactor: number; note: string }[] = [
  { id: "Q4_0", label: "Q4_0 · 4-bit (smallest, fastest)", sizeFactor: 0.55, note: "Most compressed. Good for limited VRAM." },
  { id: "Q4_K_M", label: "Q4_K_M · 4-bit (balanced)", sizeFactor: 0.62, note: "Recommended default for most users." },
  { id: "Q5_K_M", label: "Q5_K_M · 5-bit (higher quality)", sizeFactor: 0.72, note: "Better quality, ~15% more memory." },
  { id: "Q6_K", label: "Q6_K · 6-bit (near-lossless)", sizeFactor: 0.82, note: "Close to fp16 quality." },
  { id: "Q8_0", label: "Q8_0 · 8-bit (very high quality)", sizeFactor: 0.95, note: "Nearly indistinguishable from fp16." },
  { id: "F16", label: "F16 · 16-bit (uncompressed)", sizeFactor: 1.0, note: "Full precision. Largest size." },
];

export const HF_POPULAR_REPOS: { repo: string; family: string; baseSizeGb: number; description: string }[] = [
  { repo: "bartowski/Llama-3.1-8B-Instruct-GGUF", family: "llama3", baseSizeGb: 16.0, description: "Meta Llama 3.1 8B Instruct" },
  { repo: "bartowski/Qwen2.5-7B-Instruct-GGUF", family: "qwen2", baseSizeGb: 14.5, description: "Qwen 2.5 7B Instruct" },
  { repo: "bartowski/mistral-7b-instruct-v0.3-GGUF", family: "mistral", baseSizeGb: 14.5, description: "Mistral 7B Instruct v0.3" },
  { repo: "bartowski/Phi-3.1-mini-128k_instruct-GGUF", family: "phi3", baseSizeGb: 7.5, description: "Microsoft Phi 3.1 Mini 128k" },
  { repo: "bartowski/gemma-2-9b-it-GGUF", family: "gemma2", baseSizeGb: 18.0, description: "Google Gemma 2 9B IT" },
  { repo: "bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF", family: "deepseek", baseSizeGb: 14.5, description: "DeepSeek R1 Distill Qwen 7B" },
  { repo: "bartowski/Mistral-Nemo-Instruct-2407-GGUF", family: "mistral", baseSizeGb: 24.0, description: "Mistral Nemo 12B Instruct" },
  { repo: "bartowski/Llama-3.3-70B-Instruct-GGUF", family: "llama3", baseSizeGb: 140.0, description: "Meta Llama 3.3 70B Instruct" },
];

// ---------- Seed data ----------

const seedModels: LlamaModel[] = [
  { id: "m1", name: "Llama 3.1 8B Q4_K_M", family: "llama3", sizeGb: 4.9, quant: "Q4_K_M", downloaded: true, path: "/models/llama-3.1-8b-instruct-q4_k_m.gguf", hfRepo: "bartowski/Llama-3.1-8B-Instruct-GGUF" },
  { id: "m2", name: "Qwen2.5 7B Q5_K_M", family: "qwen2", sizeGb: 5.2, quant: "Q5_K_M", downloaded: true, path: "/models/qwen2.5-7b-instruct-q5_k_m.gguf", hfRepo: "bartowski/Qwen2.5-7B-Instruct-GGUF" },
  { id: "m3", name: "Mistral 7B Q4_0", family: "mistral", sizeGb: 4.1, quant: "Q4_0", downloaded: true, path: "/models/mistral-7b-instruct-q4_0.gguf", hfRepo: "bartowski/mistral-7b-instruct-v0.3-GGUF" },
  { id: "m4", name: "Phi 3.1 Mini Q8", family: "phi3", sizeGb: 3.8, quant: "Q8_0", downloaded: false, path: "/models/phi-3.1-mini-128k-instruct-q8.gguf", hfRepo: "bartowski/Phi-3.1-mini-128k_instruct-GGUF" },
  { id: "m5", name: "Gemma 2 9B Q6_K", family: "gemma2", sizeGb: 6.6, quant: "Q6_K", downloaded: false, path: "/models/gemma-2-9b-it-q6_k.gguf", hfRepo: "bartowski/gemma-2-9b-it-GGUF" },
  { id: "m6", name: "DeepSeek R1 Distill 7B", family: "deepseek", sizeGb: 4.4, quant: "Q4_K_M", downloaded: true, path: "/models/deepseek-r1-distill-qwen-7b-q4_k_m.gguf", hfRepo: "bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF" },
];

const seedProfiles: LlamaProfile[] = [
  { id: "p1", name: "Balanced", description: "Good defaults for 7B–13B models on a single GPU", ctxSize: 8192, threads: 8, gpuLayers: 99, flashAttention: true, extraArgs: "--parallel 4 --cont-batching", scope: "global", shared: true, shareId: "sh_balanced_v1", calibrationScore: 88 },
  { id: "p2", name: "Long Context", description: "Optimised for RAG and long documents", ctxSize: 32768, threads: 6, gpuLayers: 99, flashAttention: true, extraArgs: "--cache-type-k q8_0 --cache-type-v q8_0", scope: "global", calibrationScore: 82 },
  { id: "p3", name: "High Throughput", description: "Maximise concurrent requests", ctxSize: 4096, threads: 12, gpuLayers: 99, flashAttention: true, extraArgs: "--parallel 8 --cont-batching -np 8", scope: "global", calibrationScore: 91 },
  { id: "p4", name: "CPU Only", description: "No GPU layers, full CPU inference", ctxSize: 4096, threads: 16, gpuLayers: 0, flashAttention: false, extraArgs: "", scope: "global", calibrationScore: 74 },
  { id: "p5", name: "Llama 3.1 Tuned", description: "Auto-calibrated for Llama 3.1 8B on RTX 4070", ctxSize: 16384, threads: 8, gpuLayers: 99, flashAttention: true, extraArgs: "--parallel 4 --cont-batching --no-mmap", scope: "model", modelId: "m1", calibrationScore: 96 },
  { id: "p6", name: "Qwen 2.5 Tuned", description: "Auto-calibrated for Qwen 2.5 7B", ctxSize: 8192, threads: 8, gpuLayers: 99, flashAttention: true, extraArgs: "--parallel 4 --cont-batching", scope: "model", modelId: "m2", calibrationScore: 93 },
];

const seedReleases: LlamaRelease[] = [
  { id: "r1", tag: "b4402", publishedAt: "2025-01-14", commit: "8f1f7e1", notes: "KV cache quantisation, faster prompt processing, RPC server fixes", installed: true },
  { id: "r2", tag: "b4390", publishedAt: "2024-12-20", commit: "a2c4f90", notes: "Improved FlashAttention path, new --cache-type-v flag", installed: false },
  { id: "r3", tag: "b4378", publishedAt: "2024-11-28", commit: "7bd12aa", notes: "Speculative decoding via draft models, multi-GPU tensor split fixes", installed: false },
  { id: "r4", tag: "b4360", publishedAt: "2024-10-15", commit: "3f8e221", notes: "Initial Qwen2.5 support, llama-server OpenAI-compatible refactor", installed: false },
];

const seedWorkspaces: Workspace[] = [
  { id: "ws1", name: "Personal", color: "blue", description: "Local dev & experiments" },
  { id: "ws2", name: "Team Production", color: "green", description: "Shared serving profiles" },
  { id: "ws3", name: "Research", color: "purple", description: "Benchmarks & calibration" },
];

const seedInstances: LlamaInstance[] = [];

// ---------- Store ----------

const IDLE_THRESHOLD_MS = 45_000; // go idle after 45s inactivity
const HIBERNATE_THRESHOLD_MS = 30_000; // hibernate after 30s idle

interface LlamaStore {
  instances: LlamaInstance[];
  models: LlamaModel[];
  profiles: LlamaProfile[];
  releases: LlamaRelease[];
  workspaces: Workspace[];
  activeWorkspaceId: string;
  downloads: HFDownload[];
  logs: Record<string, ConsoleLine[]>;
  activeConsoleId: string;
  consoleOpen: boolean;
  consoleHeight: number;

  // app status / hibernation
  appStatus: AppStatus;
  lastActivityAt: number;
  hibernatedInstanceIds: string[];
  metrics: MetricSample[];
  registerActivity: () => void;
  setAppStatus: (s: AppStatus) => void;
  forceHibernate: () => void;
  forceWake: () => void;
  pushMetric: (m: MetricSample) => void;

  // workspace
  setActiveWorkspace: (id: string) => void;
  addWorkspace: (w: Omit<Workspace, "id">) => void;

  // instance actions
  startInstance: (config: { name: string; model: string; profile: string; port: number; host: string; gpu: string }) => string;
  stopInstance: (id: string) => void;
  removeInstance: (id: string) => void;
  markRunning: (id: string) => void;
  markStopped: (id: string) => void;
  bumpStats: (id: string, prompt: number, gen: number, tps: number) => void;
  setActiveConsole: (id: string) => void;
  toggleConsole: () => void;
  setConsoleOpen: (open: boolean) => void;
  setConsoleHeight: (h: number) => void;
  clearConsole: (id: string) => void;

  // models & releases
  downloadModel: (id: string) => void;
  startHFDownload: (config: { repo: string; quant: string; modelName: string }) => string;
  installRelease: (id: string) => void;

  // profiles
  addProfile: (p: Omit<LlamaProfile, "id">) => void;
  removeProfile: (id: string) => void;
  shareProfile: (id: string) => void;
  calibrateProfile: (id: string) => void;

  appendLog: (line: ConsoleLine) => void;
}

const SYSTEM_CONSOLE_ID = "system";

const initialSystemLogs: ConsoleLine[] = [
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 5000, kind: "info", text: "[boot] LlamaLauncher v0.4.2 ready" },
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 4800, kind: "debug", text: "[boot] detected 1 CUDA device: NVIDIA RTX 4070 (12 GB)" },
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 4600, kind: "info", text: "[boot] llama.cpp build b4402 (8f1f7e1) installed at /opt/llama.cpp" },
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 4400, kind: "success", text: "[boot] 3 models available, 6 profiles configured (4 global, 2 model-tuned)" },
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 4200, kind: "info", text: "[hibernate] auto-hibernation enabled: idle 45s → idle, +30s → hibernate (models unloaded)" },
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 200, kind: "info", text: "[ready] start an instance to launch a llama-server process" },
];

export const SYSTEM_CONSOLE = SYSTEM_CONSOLE_ID;

// Helper: generate initial metric history (last 60 samples, 1s apart)
function seedMetrics(): MetricSample[] {
  const now = Date.now();
  const out: MetricSample[] = [];
  for (let i = 59; i >= 0; i--) {
    out.push({
      t: now - i * 1000,
      cpu: 4 + Math.random() * 6,
      ram: 30 + Math.random() * 8,
      gpu: 0,
      gpuMem: 0,
      tps: 0,
      reqPerMin: 0,
    });
  }
  return out;
}

// Idle/hibernate watchdog
let watchdogTimer: ReturnType<typeof setInterval> | null = null;

function startWatchdog(store: LlamaStore) {
  if (watchdogTimer) clearInterval(watchdogTimer);
  watchdogTimer = setInterval(() => {
    const s = useLlamaStore.getState();
    const since = Date.now() - s.lastActivityAt;
    const running = s.instances.filter((i) => i.status === "running" || i.status === "starting");

    if (s.appStatus === "waking" || s.appStatus === "hibernating") return;

    if (since >= IDLE_THRESHOLD_MS + HIBERNATE_THRESHOLD_MS && running.length > 0 && s.appStatus !== "hibernating") {
      // Hibernate: unload all running models
      s.setAppStatus("hibernating");
      emitLog(SYSTEM_CONSOLE_ID, "warn", `[${fmtTime(new Date())}] [hibernate] idle ${Math.round(since / 1000)}s — unloading ${running.length} model(s) from VRAM`);
      running.forEach((inst) => {
        useLlamaStore.getState().stopInstance(inst.id);
        useLlamaStore.setState((st) => ({
          hibernatedInstanceIds: [...st.hibernatedInstanceIds, inst.id],
          instances: st.instances.map((i) =>
            i.id === inst.id
              ? {
                  ...i,
                  hibernatedConfig: { name: i.name, model: i.model, profile: i.profile, port: i.port, host: i.host, gpu: i.gpu },
                }
              : i,
          ),
        }));
      });
      setTimeout(() => {
        emitLog(SYSTEM_CONSOLE_ID, "info", `[${fmtTime(new Date())}] [hibernate] all models unloaded. VRAM freed. Awaiting next request to hot-reload.`);
      }, 1200);
    } else if (since >= IDLE_THRESHOLD_MS && s.appStatus === "active") {
      s.setAppStatus("idle");
      emitLog(SYSTEM_CONSOLE_ID, "debug", `[${fmtTime(new Date())}] [idle] no activity for ${Math.round(since / 1000)}s — will hibernate in ${Math.round(HIBERNATE_THRESHOLD_MS / 1000)}s`);
    } else if (since < IDLE_THRESHOLD_MS && s.appStatus === "idle") {
      s.setAppStatus("active");
    }
  }, 3000);
}

// Real-time metrics generator (1s tick)
let metricsTimer: ReturnType<typeof setInterval> | null = null;
function startMetricsTicker(store: LlamaStore) {
  if (metricsTimer) clearInterval(metricsTimer);
  metricsTimer = setInterval(() => {
    const s = useLlamaStore.getState();
    const running = s.instances.filter((i) => i.status === "running");
    const totalTps = running.reduce((sum, i) => sum + i.tokensPerSec, 0);
    const totalMem = running.reduce((sum, i) => sum + i.memoryMb, 0);
    const totalReq = running.reduce((sum, i) => sum + i.requestsPerMin, 0);
    const isHibernating = s.appStatus === "hibernating";

    const sample: MetricSample = {
      t: Date.now(),
      cpu: isHibernating ? 1 + Math.random() * 2 : 8 + Math.random() * 18 + running.length * 3,
      ram: isHibernating ? 18 + Math.random() * 4 : 32 + Math.random() * 6 + totalMem / 1024,
      gpu: isHibernating ? 0 : Math.min(100, 15 + running.length * 22 + Math.random() * 18),
      gpuMem: isHibernating ? 0 : Math.min(100, (totalMem / 12288) * 100),
      tps: totalTps,
      reqPerMin: totalReq,
    };
    store.pushMetric(sample);
  }, 1500);
}

export const useLlamaStore = create<LlamaStore>((set, get) => {
  logSubscribers.add((line) => {
    get().appendLog(line);
  });

  const store: LlamaStore = {
    instances: seedInstances,
    models: seedModels,
    profiles: seedProfiles,
    releases: seedReleases,
    workspaces: seedWorkspaces,
    activeWorkspaceId: seedWorkspaces[0].id,
    downloads: [],
    logs: { [SYSTEM_CONSOLE_ID]: initialSystemLogs },
    activeConsoleId: SYSTEM_CONSOLE_ID,
    consoleOpen: false,
    consoleHeight: 240,

    appStatus: "active",
    lastActivityAt: nowTs(),
    hibernatedInstanceIds: [],
    metrics: seedMetrics(),

    registerActivity: () => {
      const s = get();
      const wasHibernating = s.appStatus === "hibernating";
      set({ lastActivityAt: nowTs() });
      if (wasHibernating) {
        // Wake: hot-reload hibernated instances
        set({ appStatus: "waking" });
        emitLog(SYSTEM_CONSOLE_ID, "info", `[${fmtTime(new Date())}] [wake] activity detected — hot-reloading ${s.hibernatedInstanceIds.length} hibernated model(s)`);
        const hibernatedIds = [...s.hibernatedInstanceIds];
        set({ hibernatedInstanceIds: [] });
        let delay = 0;
        hibernatedIds.forEach((oldId) => {
          const oldInst = s.instances.find((i) => i.id === oldId);
          const cfg = oldInst?.hibernatedConfig;
          if (!cfg) return;
          setTimeout(() => {
            // remove old stopped record, start fresh
            get().removeInstance(oldId);
            const newId = get().startInstance(cfg);
            emitLog(newId, "info", `[${fmtTime(new Date())}] [wake] hot-reloaded from hibernation`);
          }, delay);
          delay += 400;
        });
        setTimeout(() => {
          get().setAppStatus("active");
          emitLog(SYSTEM_CONSOLE_ID, "success", `[${fmtTime(new Date())}] [wake] all models reloaded, resuming normal operation`);
        }, delay + 2000);
      } else if (s.appStatus === "idle") {
        set({ appStatus: "active" });
      }
    },

    setAppStatus: (st) => set({ appStatus: st }),
    forceHibernate: () => {
      set({ lastActivityAt: nowTs() - IDLE_THRESHOLD_MS - HIBERNATE_THRESHOLD_MS - 1000 });
    },
    forceWake: () => {
      get().registerActivity();
    },
    pushMetric: (m) =>
      set((s) => ({
        metrics: [...s.metrics.slice(-59), m],
      })),

    setActiveWorkspace: (id) => {
      set({ activeWorkspaceId: id });
      const ws = get().workspaces.find((w) => w.id === id);
      if (ws) emitLog(SYSTEM_CONSOLE_ID, "info", `[${fmtTime(new Date())}] [workspace] switched to "${ws.name}"`);
    },
    addWorkspace: (w) => set((s) => ({ workspaces: [...s.workspaces, { ...w, id: uid("ws") }] })),

    startInstance: ({ name, model, profile, port, host, gpu }) => {
      const id = uid("inst");
      const prof = get().profiles.find((p) => p.id === profile) ?? get().profiles[0];
      const colors: LlamaInstance["color"][] = ["green", "orange", "blue", "pink", "purple"];
      const color = colors[get().instances.length % colors.length];
      const instance: LlamaInstance = {
        id,
        name,
        model,
        profile: prof.name,
        port,
        host,
        status: "starting",
        gpu,
        ctxSize: prof.ctxSize,
        threads: prof.threads,
        color,
        startedAt: nowTs(),
        promptTokens: 0,
        generatedTokens: 0,
        requestsPerMin: 0,
        tokensPerSec: 0,
        memoryMb: 0,
      };
      set((s) => ({
        instances: [...s.instances, instance],
        logs: { ...s.logs, [id]: [] },
        activeConsoleId: id,
        consoleOpen: true,
        appStatus: "active",
        lastActivityAt: nowTs(),
      }));
      emitLog(id, "info", `[${fmtTime(new Date())}] starting llama-server for "${name}" (model: ${model})`);
      runStartupSequence(instance, get());
      get().registerActivity();
      return id;
    },

    stopInstance: (id) => {
      const inst = get().instances.find((i) => i.id === id);
      if (!inst) return;
      set((s) => ({
        instances: s.instances.map((i) => (i.id === id ? { ...i, status: "stopping" } : i)),
      }));
      runShutdownSequence(inst, get());
    },

    removeInstance: (id) => {
      const sim = instanceSims.get(id);
      if (sim) sim.stop();
      instanceSims.delete(id);
      set((s) => {
        const newLogs = { ...s.logs };
        delete newLogs[id];
        const newInstances = s.instances.filter((i) => i.id !== id);
        const newActive = s.activeConsoleId === id ? SYSTEM_CONSOLE_ID : s.activeConsoleId;
        return { instances: newInstances, logs: newLogs, activeConsoleId: newActive };
      });
    },

    markRunning: (id) =>
      set((s) => ({
        instances: s.instances.map((i) => (i.id === id ? { ...i, status: "running", startedAt: i.startedAt ?? nowTs() } : i)),
      })),

    markStopped: (id) =>
      set((s) => ({
        instances: s.instances.map((i) =>
          i.id === id ? { ...i, status: "stopped", startedAt: undefined } : i,
        ),
      })),

    bumpStats: (id, prompt, gen, tps) =>
      set((s) => ({
        instances: s.instances.map((i) =>
          i.id === id
            ? {
                ...i,
                promptTokens: i.promptTokens + prompt,
                generatedTokens: i.generatedTokens + gen,
                tokensPerSec: tps,
                requestsPerMin: i.requestsPerMin + 1,
                memoryMb: Math.round(i.ctxSize * 0.5 + 1200 + Math.random() * 200),
              }
            : i,
        ),
      })),

    setActiveConsole: (id) => set({ activeConsoleId: id, consoleOpen: true }),
    toggleConsole: () => set((s) => ({ consoleOpen: !s.consoleOpen })),
    setConsoleOpen: (open) => set({ consoleOpen: open }),
    setConsoleHeight: (h) => set({ consoleHeight: Math.max(120, Math.min(600, h)) }),
    clearConsole: (id) => set((s) => ({ logs: { ...s.logs, [id]: [] } })),

    downloadModel: (id) =>
      set((s) => ({
        models: s.models.map((m) => (m.id === id ? { ...m, downloaded: true } : m)),
      })),

    startHFDownload: ({ repo, quant, modelName }) => {
      const dlId = uid("dl");
      const q = HF_QUANTS.find((x) => x.id === quant);
      const repoInfo = HF_POPULAR_REPOS.find((r) => r.repo === repo);
      const sizeGb = (repoInfo?.baseSizeGb ?? 8) * (q?.sizeFactor ?? 0.6);
      const filename = `${repo.split("/")[1]}-${quant}.gguf`;
      const dl: HFDownload = {
        id: dlId,
        repo,
        quant,
        filename,
        sizeGb,
        progress: 0,
        status: "downloading",
        startedAt: nowTs(),
        modelName,
      };
      set((s) => ({ downloads: [...s.downloads, dl] }));
      emitLog(SYSTEM_CONSOLE_ID, "info", `[${fmtTime(new Date())}] [hf] downloading ${filename} from ${repo} (${sizeGb.toFixed(1)} GB)`);

      // Simulate progressive download
      let progress = 0;
      const tick = () => {
        progress += 2 + Math.random() * 6;
        const s = useLlamaStore.getState();
        if (progress >= 100) {
          const newModel: LlamaModel = {
            id: uid("m"),
            name: `${modelName} ${quant}`,
            family: repoInfo?.family ?? "unknown",
            sizeGb: Math.round(sizeGb * 10) / 10,
            quant,
            downloaded: true,
            path: `/models/${filename}`,
            hfRepo: repo,
          };
          set((st) => ({
            downloads: st.downloads.map((d) => (d.id === dlId ? { ...d, progress: 100, status: "completed" } : d)),
            models: [...st.models, newModel],
          }));
          emitLog(SYSTEM_CONSOLE_ID, "success", `[${fmtTime(new Date())}] [hf] download complete: ${filename} (${sizeGb.toFixed(1)} GB)`);
          return;
        }
        set((st) => ({
          downloads: st.downloads.map((d) => (d.id === dlId ? { ...d, progress } : d)),
        }));
        setTimeout(tick, 350 + Math.random() * 250);
      };
      setTimeout(tick, 600);
      return dlId;
    },

    installRelease: (id) =>
      set((s) => ({
        releases: s.releases.map((r) => (r.id === id ? { ...r, installed: true } : { ...r, installed: false })),
      })),

    addProfile: (p) => set((s) => ({ profiles: [...s.profiles, { ...p, id: uid("prof") }] })),

    removeProfile: (id) =>
      set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) })),

    shareProfile: (id) =>
      set((s) => ({
        profiles: s.profiles.map((p) =>
          p.id === id ? { ...p, shared: true, shareId: p.shareId ?? `sh_${id}_v1` } : p,
        ),
      })),
    calibrateProfile: (id) =>
      set((s) => ({
        profiles: s.profiles.map((p) =>
          p.id === id ? { ...p, calibrationScore: Math.min(100, (p.calibrationScore ?? 70) + 5 + Math.floor(Math.random() * 8)) } : p,
        ),
      })),

    appendLog: (line) =>
      set((s) => {
        const list = s.logs[line.instanceId] ?? [];
        const next = list.length > 800 ? list.slice(list.length - 800) : list;
        return { logs: { ...s.logs, [line.instanceId]: [...next, line] } };
      }),
  };

  // Start background watchdog + metrics ticker (browser-only)
  if (typeof window !== "undefined") {
    setTimeout(() => {
      startWatchdog(store);
      startMetricsTicker(store);
    }, 500);
  }

  return store;
});

// ---------- Selectors / helpers ----------

export function uptimeString(startedAt?: number) {
  if (!startedAt) return "--";
  const sec = Math.floor((Date.now() - startedAt) / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function pickPort() {
  return 8080 + Math.floor(Math.random() * 20);
}
