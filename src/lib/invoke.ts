/**
 * Tauri invoke helpers — typed wrappers for Tauri commands.
 */

import { log } from "./logger";
import type { DownloadProgress } from "./types";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: {
      core?: {
        invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
      };
    };
  }
}

export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__?.core?.invoke);
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  console.debug(`[TAURI] Calling command: ${cmd}`);

  if (!isTauri()) {
    console.debug(`[TAURI] Not in Tauri environment, returning null for ${cmd}`);
    return null;
  }

  try {
    const fn = window.__TAURI__?.core?.invoke;
    if (!fn) {
      log.warn(`[TAURI] No invoke function found for ${cmd}`, { category: "tauri" });
      return null;
    }
    const result = (await fn(cmd, args)) as T;
    console.debug(`[TAURI] Command ${cmd} completed successfully`);
    return result;
  } catch (error) {
    log.error(`[TAURI] Command ${cmd} failed: ${error instanceof Error ? error.message : String(error)}`, {
      category: "tauri",
      context: { error },
    });
    return null;
  }
}

async function invokeWithChannel<T>(
  cmd: string,
  args: Record<string, unknown>,
  onProgress?: (p: DownloadProgress) => void,
): Promise<T | null> {
  if (!isTauri()) return null;
  try {
    const fn = window.__TAURI__?.core?.invoke;
    if (!fn) return null;
    const { Channel } = await import("@tauri-apps/api/core");
    const channel = new Channel<DownloadProgress>();
    if (onProgress) channel.onmessage = onProgress;
    return (await fn(cmd, { ...args, progressTx: channel })) as T;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error(`[TAURI] ${cmd} failed: ${msg}`, { category: "tauri", context: { ...args, error: msg } });
    return null;
  }
}

export { invoke, invokeWithChannel };
