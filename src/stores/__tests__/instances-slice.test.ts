import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import type { LlamaStore } from "@/stores/types";
import { createInstancesSlice } from "@/stores/instances-slice";
import { createModelsSlice } from "@/stores/models-slice";
import { createDownloadsSlice } from "@/stores/downloads-slice";
import { createProfilesSlice } from "@/stores/profiles-slice";
import { createReleasesSlice } from "@/stores/releases-slice";
import { createWorkspacesSlice } from "@/stores/workspaces-slice";
import { createNotificationsSlice } from "@/stores/notifications-slice";
import { createSystemSlice } from "@/stores/system-slice";
import { SYSTEM_CONSOLE_ID } from "@/lib/types";

function createTestStore() {
  return create<LlamaStore>((set, get) => ({
    ...createInstancesSlice(set, get),
    ...createModelsSlice(set, get),
    ...createDownloadsSlice(set, get),
    ...createProfilesSlice(set, get),
    ...createReleasesSlice(set, get),
    ...createWorkspacesSlice(set, get),
    ...createNotificationsSlice(set, get),
    ...createSystemSlice(set, get),
    globalSettings: {} as never,
    logs: {},
  }));
}

describe("instances-slice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("starts with empty instances and default console state", () => {
    const s = store.getState();
    expect(s.instances).toEqual([]);
    expect(s.logs).toEqual({});
    expect(s.activeConsoleId).toBe(SYSTEM_CONSOLE_ID);
    expect(s.consoleOpen).toBe(false);
    expect(s.consoleHeight).toBe(240);
  });

  it("setActiveConsole changes activeConsoleId", () => {
    store.getState().setActiveConsole("inst1");
    const s = store.getState();
    expect(s.activeConsoleId).toBe("inst1");
  });

  it("toggleConsole toggles consoleOpen", () => {
    expect(store.getState().consoleOpen).toBe(false);
    store.getState().toggleConsole();
    expect(store.getState().consoleOpen).toBe(true);
    store.getState().toggleConsole();
    expect(store.getState().consoleOpen).toBe(false);
  });

  it("setConsoleOpen sets consoleOpen", () => {
    store.getState().setConsoleOpen(true);
    expect(store.getState().consoleOpen).toBe(true);
    store.getState().setConsoleOpen(false);
    expect(store.getState().consoleOpen).toBe(false);
  });

  it("setConsoleHeight sets console height", () => {
    store.getState().setConsoleHeight(50);
    expect(store.getState().consoleHeight).toBe(50);
    store.getState().setConsoleHeight(300);
    expect(store.getState().consoleHeight).toBe(300);
    store.getState().setConsoleHeight(999);
    expect(store.getState().consoleHeight).toBe(999);
  });

  it("clearConsole clears logs for an instance", () => {
    store.setState({ logs: { inst1: [{ id: "l1", instanceId: "inst1", ts: 1, kind: "info", text: "hello" }] } });
    store.getState().clearConsole("inst1");
    expect(store.getState().logs["inst1"]).toEqual([]);
  });

  it("appendLog appends to existing logs", () => {
    store.setState({
      logs: { inst1: [{ id: "l1", instanceId: "inst1", ts: 1, kind: "info", text: "hello" }] },
    });
    store.getState().appendLog({ id: "l2", instanceId: "inst1", ts: 2, kind: "info", text: "world" });
    expect(store.getState().logs["inst1"]).toHaveLength(2);
    expect(store.getState().logs["inst1"][1].text).toBe("world");
  });

  it("appendLog creates new log entry if instanceId missing", () => {
    store.getState().appendLog({ id: "l1", instanceId: "newInst", ts: 1, kind: "info", text: "first" });
    expect(store.getState().logs["newInst"]).toHaveLength(1);
    expect(store.getState().logs["newInst"][0].text).toBe("first");
  });

  it("appendLog caps at 800+1 entries", () => {
    const existing = Array.from({ length: 800 }, (_, i) => ({
      id: `l${i}`, instanceId: "inst1", ts: i, kind: "info" as const, text: `line${i}`,
    }));
    store.setState({ logs: { inst1: existing } });
    store.getState().appendLog({ id: "new", instanceId: "inst1", ts: 801, kind: "info", text: "overflow" });
    expect(store.getState().logs["inst1"]).toHaveLength(801);
    expect(store.getState().logs["inst1"][800].text).toBe("overflow");
  });

  it("markRunning sets status and startedAt", () => {
    store.setState({
      instances: [{
        id: "inst1", name: "test", model: "m1", profile: "default",
        port: 8080, host: "127.0.0.1", status: "starting", gpu: "cuda",
        ctxSize: 8192, threads: 8, color: "green",
        promptTokens: 0, generatedTokens: 0, requestsPerMin: 0,
        tokensPerSec: 0, memoryMb: 0, peakTokensPerSec: 0,
        totalRequests: 0, errorCount: 0, workspaceId: "ws1",
        metrics: null, startedAt: 0, log: [], hibernatedConfig: undefined,
      }],
    });
    store.getState().markRunning("inst1");
    const inst = store.getState().instances[0];
    expect(inst.status).toBe("running");
    expect(inst.startedAt).toBeDefined();
  });

  it("markStopped clears status and startedAt", () => {
    store.setState({
      instances: [{
        id: "inst1", name: "test", model: "m1", profile: "default",
        port: 8080, host: "127.0.0.1", status: "running", gpu: "cuda",
        ctxSize: 8192, threads: 8, color: "green", startedAt: 1000,
        promptTokens: 10, generatedTokens: 20, requestsPerMin: 1,
        tokensPerSec: 5, memoryMb: 100, peakTokensPerSec: 5,
        totalRequests: 1, errorCount: 0, workspaceId: "ws1",
        metrics: null, log: [], hibernatedConfig: undefined,
      }],
    });
    store.getState().markStopped("inst1");
    const inst = store.getState().instances[0];
    expect(inst.status).toBe("stopped");
    expect(inst.startedAt).toBe(0);
  });

  it("bumpStats increments prompt, generated tokens and tps", () => {
    store.setState({
      instances: [{
        id: "inst1", name: "test", model: "m1", profile: "default",
        port: 8080, host: "127.0.0.1", status: "running", gpu: "cuda",
        ctxSize: 8192, threads: 8, color: "green",
        promptTokens: 10, generatedTokens: 20, requestsPerMin: 1,
        tokensPerSec: 5, memoryMb: 100, peakTokensPerSec: 5,
        totalRequests: 1, errorCount: 0, workspaceId: "ws1",
        metrics: null, startedAt: 0, log: [], hibernatedConfig: undefined,
      }],
    });
    store.getState().bumpStats("inst1", 5, 10, 8.5);
    const inst = store.getState().instances[0];
    expect(inst.promptTokens).toBe(15);
    expect(inst.generatedTokens).toBe(30);
    expect(inst.tokensPerSec).toBe(8.5);
    expect(inst.peakTokensPerSec).toBe(8.5);
    expect(inst.totalRequests).toBe(2);
    expect(inst.requestsPerMin).toBe(2);
  });

  it("bumpStats preserves peak tps when lower", () => {
    store.setState({
      instances: [{
        id: "inst1", name: "test", model: "m1", profile: "default",
        port: 8080, host: "127.0.0.1", status: "running", gpu: "cuda",
        ctxSize: 8192, threads: 8, color: "green",
        promptTokens: 0, generatedTokens: 0, requestsPerMin: 0,
        tokensPerSec: 0, memoryMb: 0, peakTokensPerSec: 20,
        totalRequests: 0, errorCount: 0, workspaceId: "ws1",
        metrics: null, startedAt: 0, log: [], hibernatedConfig: undefined,
      }],
    });
    store.getState().bumpStats("inst1", 0, 0, 15);
    expect(store.getState().instances[0].peakTokensPerSec).toBe(20);
  });

  it("removeInstance removes instance and its logs", () => {
    store.setState({
      instances: [{
        id: "inst1", name: "test", model: "m1", profile: "default",
        port: 8080, host: "127.0.0.1", status: "stopped", gpu: "cuda",
        ctxSize: 8192, threads: 8, color: "green",
        promptTokens: 0, generatedTokens: 0, requestsPerMin: 0,
        tokensPerSec: 0, memoryMb: 0, peakTokensPerSec: 0,
        totalRequests: 0, errorCount: 0, workspaceId: "ws1",
        metrics: null, startedAt: 0, log: [], hibernatedConfig: undefined,
      }],
      logs: { inst1: [{ id: "l1", instanceId: "inst1", ts: 1, kind: "info", text: "log" }] },
    });
    store.getState().removeInstance("inst1");
    expect(store.getState().instances).toHaveLength(0);
    expect(store.getState().logs["inst1"]).toBeUndefined();
  });

  it("removeInstance switches activeConsole if current removed", () => {
    store.setState({
      instances: [
        {
          id: "inst1", name: "a", model: "m1", profile: "default",
          port: 8080, host: "127.0.0.1", status: "stopped", gpu: "cuda",
          ctxSize: 8192, threads: 8, color: "green",
          promptTokens: 0, generatedTokens: 0, requestsPerMin: 0,
          tokensPerSec: 0, memoryMb: 0, peakTokensPerSec: 0,
          totalRequests: 0, errorCount: 0, workspaceId: "ws1",
          metrics: null, startedAt: 0, log: [], hibernatedConfig: undefined,
        },
        {
          id: "inst2", name: "b", model: "m2", profile: "default",
          port: 8081, host: "127.0.0.1", status: "stopped", gpu: "cuda",
          ctxSize: 8192, threads: 8, color: "blue",
          promptTokens: 0, generatedTokens: 0, requestsPerMin: 0,
          tokensPerSec: 0, memoryMb: 0, peakTokensPerSec: 0,
          totalRequests: 0, errorCount: 0, workspaceId: "ws1",
          metrics: null, startedAt: 0, log: [], hibernatedConfig: undefined,
        },
      ],
      activeConsoleId: "inst1",
    });
    store.getState().removeInstance("inst1");
    expect(store.getState().activeConsoleId).toBe(SYSTEM_CONSOLE_ID);
  });
});
