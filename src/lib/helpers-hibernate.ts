/**
 * Hibernation persistence helpers.
 */

import { log } from "@/lib/logger";
import type { LlamaInstance } from "@/lib/types";

const HIBERNATION_STORAGE_KEY = "llama-launcher-hibernation";
const LAST_ACTIVITY_STORAGE_KEY = "llama-launcher-last-activity";

interface PersistedHibernationState {
  hibernatedInstanceIds: string[];
  hibernatedConfigs: Record<string, LlamaInstance["hibernatedConfig"]>;
  lastActivityAt: number;
}

export function persistHibernatedState(
  hibernatedInstanceIds: string[],
  instances: LlamaInstance[],
  lastActivityAt: number,
) {
  try {
    const hibernatedConfigs: Record<string, LlamaInstance["hibernatedConfig"]> = {};
    hibernatedInstanceIds.forEach((id) => {
      const inst = instances.find((i) => i.id === id);
      if (inst?.hibernatedConfig) hibernatedConfigs[id] = inst.hibernatedConfig;
    });
    const state: PersistedHibernationState = {
      hibernatedInstanceIds,
      hibernatedConfigs,
      lastActivityAt,
    };
    localStorage.setItem(HIBERNATION_STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(lastActivityAt));
  } catch (e) {
    log.error("[STORE] hibernate: failed to persist state", { category: "store", context: { error: e instanceof Error ? e.message : String(e) } });
  }
}

export function restoreHibernatedState(): PersistedHibernationState | null {
  try {
    const raw = localStorage.getItem(HIBERNATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedHibernationState;
    if (!Array.isArray(parsed.hibernatedInstanceIds)) return null;
    if (typeof parsed.lastActivityAt !== "number") return null;
    return parsed;
  } catch (e) {
    log.error("[STORE] hibernate: failed to restore state", { category: "store", context: { error: e instanceof Error ? e.message : String(e) } });
    return null;
  }
}

export function persistLastActivity(ts: number) {
  try {
    localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(ts));
  } catch (e) {
    log.error("[STORE] hibernate: failed to persist lastActivityAt", { category: "store", context: { error: e instanceof Error ? e.message : String(e) } });
  }
}
