/**
 * Tauri notification listener — bridges Rust backend events to frontend store.
 */

import { isTauri } from "./invoke";

export interface BackendNotification {
  id: string;
  level: "info" | "success" | "warning" | "error";
  source: string;
  title: string;
  body: string;
  timestamp: number;
  instance_id?: string;
  action_label?: string;
}

type NotificationListener = (n: BackendNotification) => void;
type UnlistenFn = () => void;

let listener: NotificationListener | null = null;
let unsubscribe: UnlistenFn | null = null;

function mapLevel(level: BackendNotification["level"]): "info" | "success" | "warning" | "error" {
  return level;
}

function mapSource(source: string): "model" | "process" | "system" | "release" | "download" | "workspace" | "config" {
  const valid: Array<"model" | "process" | "system" | "release" | "download" | "workspace" | "config"> = [
    "model", "process", "system", "release", "download", "workspace", "config",
  ];
  return (valid.includes(source as typeof valid[number]) ? source : "system") as typeof valid[number];
}

export async function listenForNotifications(cb: NotificationListener): Promise<void> {
  if (!isTauri()) return;
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  try {
    const { listen } = await import("@tauri-apps/api/event");
    const unlisten = await listen<string>("notification", (event: { payload: string }) => {
      try {
        const parsed = JSON.parse(event.payload) as BackendNotification;
        cb({
          ...parsed,
          level: mapLevel(parsed.level),
          source: mapSource(parsed.source),
        });
      } catch {
        // ignore malformed payloads
      }
    });
    unsubscribe = unlisten;
  } catch {
    // @tauri-apps/api/event not available
  }
}

export function stopListening(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
