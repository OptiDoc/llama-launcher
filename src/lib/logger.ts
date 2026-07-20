/**
 * Simple logger for the frontend.
 * Uses console with structured format and level filtering.
 * Persists to disk via Tauri backend when available.
 */

export type LogKind = "info" | "success" | "warn" | "error" | "debug" | "system";

interface LogEntry {
  ts: number;
  kind: LogKind;
  category: string;
  message: string;
  context?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogKind, number> = {
  debug: 0,
  info: 1,
  success: 1,
  warn: 2,
  error: 3,
  system: 1,
};

let currentLevel: LogKind = "debug";

export function setLogLevel(level: LogKind) {
  currentLevel = level;
}

function shouldLog(kind: LogKind): boolean {
  return LOG_LEVELS[kind] >= LOG_LEVELS[currentLevel];
}

function format(kind: LogKind, category: string, message: string, context?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const ctx = context ? ` ${JSON.stringify(context)}` : "";
  return `[${timestamp}] [${kind.toUpperCase()}] [${category}] ${message}${ctx}`;
}

/** Persist a log entry to disk via the Rust backend. Fire-and-forget. */
export function persistToBackend(kind: LogKind, category: string, message: string) {
  if (typeof window === "undefined") return;
  const tauriAvailable = Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__?.core?.invoke);
  if (!tauriAvailable) {
    console.warn(`[LOGGER] persistToBackend: Tauri not available, skipping [${kind}] ${message}`);
    return;
  }
  try {
    const fn = window.__TAURI__?.core?.invoke;
    if (!fn) {
      console.warn(`[LOGGER] persistToBackend: invoke function not found, skipping [${kind}] ${message}`);
      return;
    }
    fn("write_frontend_log", { entry: { level: kind, category, message } }).catch((e) => {
      console.error(`[LOGGER] persistToBackend failed for [${kind}] ${message}:`, e);
    });
  } catch (e) {
    console.error(`[LOGGER] persistToBackend invoke error:`, e);
  }
}

export const log = {
  debug: (message: string, options?: { category?: string; context?: Record<string, unknown> }) => {
    const cat = options?.category ?? "app";
    if (shouldLog("debug")) {
      console.debug(format("debug", cat, message, options?.context));
    }
    persistToBackend("debug", cat, message);
  },
  info: (message: string, options?: { category?: string; context?: Record<string, unknown> }) => {
    const cat = options?.category ?? "app";
    if (shouldLog("info")) {
      console.info(format("info", cat, message, options?.context));
    }
    persistToBackend("info", cat, message);
  },
  success: (message: string, options?: { category?: string; context?: Record<string, unknown> }) => {
    const cat = options?.category ?? "app";
    if (shouldLog("success")) {
      console.log(format("success", cat, message, options?.context));
    }
    persistToBackend("success", cat, message);
  },
  warn: (message: string, options?: { category?: string; context?: Record<string, unknown> }) => {
    const cat = options?.category ?? "app";
    if (shouldLog("warn")) {
      console.warn(format("warn", cat, message, options?.context));
    }
    persistToBackend("warn", cat, message);
  },
  error: (message: string, options?: { category?: string; context?: Record<string, unknown> }) => {
    const cat = options?.category ?? "app";
    if (shouldLog("error")) {
      console.error(format("error", cat, message, options?.context));
    }
    persistToBackend("error", cat, message);
  },
};

/** Console logger for system messages (used by llama-store). Persists to disk. */
export function emitLog(consoleId: string, kind: LogKind, message: string) {
  console.log(`[${new Date().toISOString()}] [${kind.toUpperCase()}] [${consoleId}] ${message}`);
  persistToBackend(kind, consoleId, message);
}
