/**
 * LlamaLauncher state store + simulator.
 *
 * This is a client-side simulation of llama.cpp server instances.
 * Each "instance" represents a llama-server process that streams
 * realistic startup logs to its own console buffer.
 */

import { create } from "zustand";

// ---------- Types ----------

export type InstanceStatus = "stopped" | "starting" | "running" | "stopping" | "error";

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
}

export interface LlamaModel {
  id: string;
  name: string;
  family: string;
  sizeGb: number;
  quant: string;
  downloaded: boolean;
  path: string;
}

export interface LlamaProfile {
  id: string;
  name: string;
  description: string;
  ctxSize: number;
  threads: number;
  gpuLayers: number;
  flashAttention: boolean;
  extraArgs: string;
}

export interface LlamaRelease {
  id: string;
  tag: string;
  publishedAt: string;
  commit: string;
  notes: string;
  installed: boolean;
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

/**
 * Stream realistic llama-server startup logs to an instance's console.
 * Returns when the simulated startup sequence finishes and the server
 * is "running". Keeps streaming periodic request logs while running.
 */
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

  // Mark running after startup sequence
  setTimeout(() => {
    if (cancelled) return;
    store.markRunning(instance.id);
    emitLog(instance.id, "success", `[${fmtTime(new Date())}] ✓ Server ready. Listening on http://${instance.host}:${instance.port}/completions`);

    // Stream periodic request logs
    const tick = () => {
      if (cancelled || !sim.running) return;
      sim.ticks += 1;
      const t = sim.ticks;
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

// ---------- Seed data ----------

const seedModels: LlamaModel[] = [
  { id: "m1", name: "Llama 3.1 8B Q4_K_M", family: "llama3", sizeGb: 4.9, quant: "Q4_K_M", downloaded: true, path: "/models/llama-3.1-8b-instruct-q4_k_m.gguf" },
  { id: "m2", name: "Qwen2.5 7B Q5_K_M", family: "qwen2", sizeGb: 5.2, quant: "Q5_K_M", downloaded: true, path: "/models/qwen2.5-7b-instruct-q5_k_m.gguf" },
  { id: "m3", name: "Mistral 7B Q4_0", family: "mistral", sizeGb: 4.1, quant: "Q4_0", downloaded: true, path: "/models/mistral-7b-instruct-q4_0.gguf" },
  { id: "m4", name: "Phi 3.1 Mini Q8", family: "phi3", sizeGb: 3.8, quant: "Q8_0", downloaded: false, path: "/models/phi-3.1-mini-128k-instruct-q8.gguf" },
  { id: "m5", name: "Gemma 2 9B Q6_K", family: "gemma2", sizeGb: 6.6, quant: "Q6_K", downloaded: false, path: "/models/gemma-2-9b-it-q6_k.gguf" },
  { id: "m6", name: "DeepSeek R1 Distill 7B", family: "deepseek", sizeGb: 4.4, quant: "Q4_K_M", downloaded: true, path: "/models/deepseek-r1-distill-qwen-7b-q4_k_m.gguf" },
];

const seedProfiles: LlamaProfile[] = [
  { id: "p1", name: "Balanced", description: "Good defaults for 7B–13B models on a single GPU", ctxSize: 8192, threads: 8, gpuLayers: 99, flashAttention: true, extraArgs: "--parallel 4 --cont-batching" },
  { id: "p2", name: "Long Context", description: "Optimised for RAG and long documents", ctxSize: 32768, threads: 6, gpuLayers: 99, flashAttention: true, extraArgs: "--cache-type-k q8_0 --cache-type-v q8_0" },
  { id: "p3", name: "High Throughput", description: "Maximise concurrent requests", ctxSize: 4096, threads: 12, gpuLayers: 99, flashAttention: true, extraArgs: "--parallel 8 --cont-batching -np 8" },
  { id: "p4", name: "CPU Only", description: "No GPU layers, full CPU inference", ctxSize: 4096, threads: 16, gpuLayers: 0, flashAttention: false, extraArgs: "" },
];

const seedReleases: LlamaRelease[] = [
  { id: "r1", tag: "b4402", publishedAt: "2025-01-14", commit: "8f1f7e1", notes: "KV cache quantisation, faster prompt processing, RPC server fixes", installed: true },
  { id: "r2", tag: "b4390", publishedAt: "2024-12-20", commit: "a2c4f90", notes: "Improved FlashAttention path, new --cache-type-v flag", installed: false },
  { id: "r3", tag: "b4378", publishedAt: "2024-11-28", commit: "7bd12aa", notes: "Speculative decoding via draft models, multi-GPU tensor split fixes", installed: false },
  { id: "r4", tag: "b4360", publishedAt: "2024-10-15", commit: "3f8e221", notes: "Initial Qwen2.5 support, llama-server OpenAI-compatible refactor", installed: false },
];

const seedInstances: LlamaInstance[] = [];

// ---------- Store ----------

interface LlamaStore {
  instances: LlamaInstance[];
  models: LlamaModel[];
  profiles: LlamaProfile[];
  releases: LlamaRelease[];
  logs: Record<string, ConsoleLine[]>;
  activeConsoleId: string; // instance id, or "system"
  consoleOpen: boolean;
  consoleHeight: number;

  // actions
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
  downloadModel: (id: string) => void;
  installRelease: (id: string) => void;
  addProfile: (p: Omit<LlamaProfile, "id">) => void;
  removeProfile: (id: string) => void;
  appendLog: (line: ConsoleLine) => void;
}

const SYSTEM_CONSOLE_ID = "system";

const initialSystemLogs: ConsoleLine[] = [
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 5000, kind: "info", text: "[boot] LlamaLauncher v0.4.2 ready" },
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 4800, kind: "debug", text: "[boot] detected 1 CUDA device: NVIDIA RTX 4070 (12 GB)" },
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 4600, kind: "info", text: "[boot] llama.cpp build b4402 (8f1f7e1) installed at /opt/llama.cpp" },
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 4400, kind: "success", text: "[boot] 3 models available, 4 profiles configured" },
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 200, kind: "info", text: "[ready] start an instance to launch a llama-server process" },
];

export const SYSTEM_CONSOLE = SYSTEM_CONSOLE_ID;

export const useLlamaStore = create<LlamaStore>((set, get) => {
  // Subscribe to log emitter to push into store state
  logSubscribers.add((line) => {
    get().appendLog(line);
  });

  return {
    instances: seedInstances,
    models: seedModels,
    profiles: seedProfiles,
    releases: seedReleases,
    logs: { [SYSTEM_CONSOLE_ID]: initialSystemLogs },
    activeConsoleId: SYSTEM_CONSOLE_ID,
    consoleOpen: false,
    consoleHeight: 240,

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
      }));
      emitLog(id, "info", `[${fmtTime(new Date())}] starting llama-server for "${name}" (model: ${model})`);
      runStartupSequence(instance, get());
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

    installRelease: (id) =>
      set((s) => ({
        releases: s.releases.map((r) => (r.id === id ? { ...r, installed: true } : { ...r, installed: false })),
      })),

    addProfile: (p) =>
      set((s) => ({ profiles: [...s.profiles, { ...p, id: uid("prof") }] })),

    removeProfile: (id) =>
      set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) })),

    appendLog: (line) =>
      set((s) => {
        const list = s.logs[line.instanceId] ?? [];
        const next = list.length > 800 ? list.slice(list.length - 800) : list;
        return { logs: { ...s.logs, [line.instanceId]: [...next, line] } };
      }),
  };
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
