/**
 * Log utilities — subscribers, emitLog, renameLogKey.
 */

import type { ConsoleLine } from "@/lib/types";
import { persistToBackend } from "@/lib/logger";
import { uid, nowTs } from "./helpers-utils";

export const logSubscribers = new Set<(line: ConsoleLine) => void>();

export function emitLog(instanceId: string, kind: import("@/lib/types").LogKind, text: string) {
  const line: ConsoleLine = {
    id: uid("log"),
    instanceId,
    ts: nowTs(),
    kind,
    text,
  };
  logSubscribers.forEach((fn) => fn(line));
  persistToBackend(kind, instanceId, text);
  return line;
}

export function renameLogKey(
  logs: Record<string, ConsoleLine[]>,
  oldKey: string,
  newKey: string,
): Record<string, ConsoleLine[]> {
  if (oldKey === newKey) return logs;
  const { [oldKey]: val, ...rest } = logs;
  return { ...rest, [newKey]: val ?? [] };
}
