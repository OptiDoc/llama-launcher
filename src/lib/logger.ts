/**
 * Frontend logger — unified schema matching Rust backend.
 * Uses console with structured format, level filtering, and buffered persistence.
 */

export type LogKind = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: number;
  timestamp: number;
  level: LogKind;
  category: string;
  message: string;
  context?: Record<string, unknown>;
  tag?: string;
  stack?: string;
  correlation_id?: string;
}

export interface MeasureEntry {
  correlation_id?: string;
  category: string;
  duration_ms: number;
}

const LOG_LEVELS: Record<LogKind, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogKind = "debug";
let currentCorrelationId: string | null = null;

const LOG_QUEUE: LogEntry[] = [];
const QUEUE_FLUSH_INTERVAL_MS = 500;
const QUEUE_FLUSH_THRESHOLD = 50;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function setLogLevel(level: LogKind) {
  currentLevel = level;
}

export function setCorrelationId(id: string | null) {
  currentCorrelationId = id;
}

function shouldLog(kind: LogKind): boolean {
  return LOG_LEVELS[kind] >= LOG_LEVELS[currentLevel];
}

function format(kind: LogKind, category: string, message: string, context?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const ctx = context ? ` ${JSON.stringify(context)}` : "";
  return `[${timestamp}] [${kind.toUpperCase()}] [${category}] ${message}${ctx}`;
}

function enqueueEntry(entry: LogEntry) {
  LOG_QUEUE.push(entry);
  if (LOG_QUEUE.length >= QUEUE_FLUSH_THRESHOLD) {
    flushQueue();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushQueue, QUEUE_FLUSH_INTERVAL_MS);
  }
}

async function flushQueue() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (LOG_QUEUE.length === 0) return;

  const batch = LOG_QUEUE.splice(0);
  if (typeof window === "undefined") return;
  const tauriAvailable = Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__?.core?.invoke);
  if (!tauriAvailable) return;

  try {
    const fn = window.__TAURI__?.core?.invoke;
    if (!fn) return;
    for (const entry of batch) {
      await fn("write_frontend_log", { entry });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[LOGGER] flushQueue failed: ${msg}`);
  }
}

function buildEntry(
  level: LogKind,
  category: string,
  message: string,
  options?: {
    context?: Record<string, unknown>;
    tag?: string;
    correlation_id?: string;
    stack?: string;
  },
): LogEntry {
  return {
    id: 0,
    timestamp: Date.now(),
    level,
    category,
    message,
    context: options?.context,
    tag: options?.tag,
    stack: options?.stack,
    correlation_id: options?.correlation_id ?? currentCorrelationId ?? undefined,
  };
}

export const log = {
  debug: (
    message: string,
    options?: { category?: string; context?: Record<string, unknown>; correlation_id?: string },
  ) => {
    const cat = options?.category ?? "app";
    if (shouldLog("debug")) {
      console.debug(format("debug", cat, message, options?.context));
    }
    enqueueEntry(buildEntry("debug", cat, message, options));
  },

  info: (
    message: string,
    options?: { category?: string; context?: Record<string, unknown>; correlation_id?: string; tag?: string },
  ) => {
    const cat = options?.category ?? "app";
    if (shouldLog("info")) {
      console.info(format("info", cat, message, options?.context));
    }
    enqueueEntry(buildEntry("info", cat, message, options));
  },

  warn: (
    message: string,
    options?: { category?: string; context?: Record<string, unknown>; correlation_id?: string },
  ) => {
    const cat = options?.category ?? "app";
    if (shouldLog("warn")) {
      console.warn(format("warn", cat, message, options?.context));
    }
    enqueueEntry(buildEntry("warn", cat, message, options));
  },

  error: (
    message: string,
    options?: {
      category?: string;
      context?: Record<string, unknown>;
      correlation_id?: string;
      stack?: string;
    },
  ) => {
    const cat = options?.category ?? "app";
    const stack = options?.stack ?? new Error().stack ?? undefined;
    if (shouldLog("error")) {
      console.error(format("error", cat, message, options?.context));
    }
    enqueueEntry(buildEntry("error", cat, message, { ...options, stack }));
  },
};

export function emitLog(consoleId: string, kind: LogKind, message: string) {
  console.log(`[${new Date().toISOString()}] [${kind.toUpperCase()}] [${consoleId}] ${message}`);
  enqueueEntry(buildEntry(kind, consoleId, message, { correlation_id: currentCorrelationId ?? undefined }));
}

export function measure<T>(message: string, category: string, f: () => T): T {
  const start = Date.now();
  const result = f();
  const duration = Date.now() - start;
  const entry: MeasureEntry = {
    correlation_id: currentCorrelationId ?? undefined,
    category,
    duration_ms: duration,
  };
  log.info(`${message} - ${duration}ms`, {
    category,
    tag: "measure",
    context: entry as unknown as Record<string, unknown>,
  });
  return result;
}
