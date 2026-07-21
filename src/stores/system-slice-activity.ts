/**
 * System slice — activity management.
 */

import { SYSTEM_CONSOLE_ID } from "@/lib/types";
import { nowTs, persistLastActivity, NOTIF_MESSAGES } from "@/lib/helpers";
import { emitLog } from "@/lib/helpers";
import type { StoreApi } from "zustand";
import type { LlamaStore } from "@/stores/types";
import type { SystemSlice } from "./system-slice-types";

let wakeInProgress = false;

export function createActivitySlice(
  set: StoreApi<LlamaStore>["setState"],
  get: StoreApi<LlamaStore>["getState"],
): Pick<SystemSlice, "registerActivity" | "forceHibernate" | "forceWake"> {
  return {
    registerActivity: () => {
      if (wakeInProgress) return;
      const s = get();
      const wasHibernating = s.appStatus === "hibernating";
      const now = nowTs();
      set({ lastActivityAt: now });
      persistLastActivity(now);
      if (wasHibernating) {
        wakeInProgress = true;
        set({ appStatus: "waking" });
        emitLog(
          SYSTEM_CONSOLE_ID,
          "info",
          `wake: activity detected — hot-reloading ${s.hibernatedInstanceIds.length} hibernated model(s)`,
        );
        get().addNotification?.(
          NOTIF_MESSAGES.configUpdated(`Waking up — reloading ${s.hibernatedInstanceIds.length} model(s)`),
        );
        const hibernatedIds = [...s.hibernatedInstanceIds];
        set({ hibernatedInstanceIds: [] });
        if (typeof window !== "undefined") {
          localStorage.removeItem("llama-launcher-hibernation");
        }
        const totalDelay = hibernatedIds.length * 400;
        hibernatedIds.forEach((oldId, idx) => {
          const oldInst = s.instances?.find((i) => i.id === oldId);
          const cfg = oldInst?.hibernatedConfig;
          if (!cfg) return;
          setTimeout(() => {
            get().removeInstance?.(oldId);
            get().startInstance?.(cfg);
            emitLog(oldId, "info", `hot-reloaded from hibernation`);
          }, idx * 400);
        });
        setTimeout(() => {
          get().setAppStatus?.("active");
          emitLog(SYSTEM_CONSOLE_ID, "success", `all models reloaded, resuming normal operation`);
          get().addNotification?.(NOTIF_MESSAGES.configUpdated("All models reloaded, resuming normal operation"));
          wakeInProgress = false;
        }, totalDelay + 2000);
        setTimeout(() => {
          const st = get();
          if (st.appStatus === "waking") {
            emitLog(SYSTEM_CONSOLE_ID, "warn", `wake timeout — forcing active state`);
            get().addNotification?.(NOTIF_MESSAGES.systemError("Wake timed out — forced active state"));
            st.setAppStatus?.("active");
            wakeInProgress = false;
          }
        }, 30000);
      } else if (s.appStatus === "idle") {
        set({ appStatus: "active" });
      }
    },

    forceHibernate: () => {
      const wsSettings = get().workspaceSettings?.[get().activeWorkspaceId];
      set({ lastActivityAt: nowTs() - (wsSettings?.hibernate_after_sec ?? 75) * 1000 - 1000 });
    },

    forceWake: () => {
      get().registerActivity();
    },
  };
}
