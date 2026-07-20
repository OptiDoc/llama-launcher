/**
 * Seed data — initial system logs, seed metrics.
 */

import type { ConsoleLine, MetricSample } from "@/lib/types";
import { SYSTEM_CONSOLE_ID } from "@/lib/types";
import { uid, nowTs } from "./helpers-utils";

export const initialSystemLogs: ConsoleLine[] = [
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 5000, kind: "info", text: "[boot] LlamaLauncher v0.4.2 ready" },
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 4800, kind: "info", text: "[boot] connecting to Tauri backend…" },
  { id: uid("log"), instanceId: SYSTEM_CONSOLE_ID, ts: nowTs() - 200, kind: "info", text: "[ready] start an instance to launch a llama-server process" },
];

export function seedMetrics(): MetricSample[] {
  const now = Date.now();
  const out: MetricSample[] = [];
  for (let i = 59; i >= 0; i--) {
    out.push({ t: now - i * 1000, cpu: 0, ram: 0, gpu: 0, gpuMem: 0, tps: 0, reqPerMin: 0 });
  }
  return out;
}
