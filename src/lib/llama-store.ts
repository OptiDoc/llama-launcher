import { create } from "zustand";
import { isTauri, listenForNotifications } from "@/lib/tauri-api";
import { emitLog, nowTs, initialSystemLogs, persistHibernatedState, NOTIF_MESSAGES } from "@/lib/helpers";
import { fmtTime } from "@/lib/utils";
import { SYSTEM_CONSOLE_ID, defaultGlobalSettings, defaultWorkspaceSettings } from "@/lib/types";
import type { LlamaStore } from "@/stores/types";
import { createModelsSlice } from "@/stores/models-slice";
import { createInstancesSlice } from "@/stores/instances-slice";
import { createDownloadsSlice } from "@/stores/downloads-slice";
import { createProfilesSlice } from "@/stores/profiles-slice";
import { createReleasesSlice } from "@/stores/releases-slice";
import { createWorkspacesSlice } from "@/stores/workspaces-slice";
import { createNotificationsSlice } from "@/stores/notifications-slice";
import { createSystemSlice } from "@/stores/system-slice";

let watchdogTimer: ReturnType<typeof setInterval> | null = null;
let metricsTimer: ReturnType<typeof setInterval> | null = null;
let releaseCheckTimer: ReturnType<typeof setTimeout> | null = null;

function isRunning(inst: { status: string }) {
  return inst.status === "running" || inst.status === "starting";
}

function startWatchdog() {
  if (watchdogTimer) clearInterval(watchdogTimer);
  watchdogTimer = setInterval(async () => {
    const s = useLlamaStore.getState();
    if (!isTauri()) return;
    const since = Date.now() - s.lastActivityAt;
    const wsSettings = s.workspaceSettings[s.activeWorkspaceId] ?? defaultWorkspaceSettings;
    const hibernateAfterMs = wsSettings.hibernate_after_sec * 1000;
    const running = s.instances.filter(isRunning);

    if (s.appStatus === "waking" || s.appStatus === "hibernating") return;

    if (since >= hibernateAfterMs && running.length > 0) {
      s.setAppStatus("hibernating");
      emitLog(SYSTEM_CONSOLE_ID, "warn", `idle ${Math.round(since / 1000)}s — unloading ${running.length} model(s)`);
      const newHibernatedIds = running.map((inst: { id: string }) => inst.id);
      await Promise.all(running.map((inst: { id: string }) => s.stopInstance(inst.id)));
      useLlamaStore.setState((st: LlamaStore) => ({
        hibernatedInstanceIds: [...st.hibernatedInstanceIds, ...newHibernatedIds],
        instances: st.instances.map((i) => {
          const match = running.find((r) => r.id === i.id);
          return match
            ? {
                ...i,
                hibernatedConfig: {
                  name: i.name,
                  model: i.model,
                  profile: i.profile,
                  port: i.port,
                  host: i.host,
                  gpu: i.gpu,
                },
              }
            : i;
        }),
      }));
      s.addNotification(NOTIF_MESSAGES.hibernationStarted(running.length, Math.round(since / 1000)));
      const state = useLlamaStore.getState();
      persistHibernatedState(state.hibernatedInstanceIds, state.instances, state.lastActivityAt);
    } else if (since >= hibernateAfterMs * 0.6 && s.appStatus === "active") {
      s.setAppStatus("idle");
    } else if (since < hibernateAfterMs * 0.6 && s.appStatus === "idle") {
      s.setAppStatus("active");
    }
  }, 3000);
}

function startMetricsTicker() {
  if (metricsTimer) clearInterval(metricsTimer);
  metricsTimer = setInterval(() => {
    if (isTauri()) {
      useLlamaStore.getState().refreshSystem();
      useLlamaStore.getState().refreshProcesses();
    }
  }, 2000);
}

function startReleaseChecker() {
  if (releaseCheckTimer) clearTimeout(releaseCheckTimer);
  releaseCheckTimer = setTimeout(async () => {
    const s = useLlamaStore.getState();
    if (!s.globalSettings.checkForReleases) return;
    await s.refreshReleases();
    const releases = useLlamaStore.getState().releases;
    if (releases.length > 0) {
      const latest = releases[0];
      if (s.globalSettings.notifyOnNewRelease && !latest.installed) {
        s.addNotification(NOTIF_MESSAGES.newReleaseAvailable(latest.tag, latest.notes));
      }
    }
  }, 5000);
}

export const useLlamaStore = create<LlamaStore>((set, get) => {
  const store: LlamaStore = {
    ...createModelsSlice(set, get),
    ...createInstancesSlice(set, get),
    ...createDownloadsSlice(set, get),
    ...createProfilesSlice(set, get),
    ...createReleasesSlice(set, get),
    ...createWorkspacesSlice(set, get),
    ...createNotificationsSlice(set, get),
    ...createSystemSlice(set, get),
    globalSettings: defaultGlobalSettings,
    logs: { [SYSTEM_CONSOLE_ID]: initialSystemLogs },
  } as LlamaStore;

  return store;
});

if (typeof window !== "undefined") {
  setTimeout(async () => {
    useLlamaStore.getState().bootstrap();
    startWatchdog();
    startMetricsTicker();
    startReleaseChecker();
    await listenForNotifications((backendNotif) => {
      useLlamaStore.getState().addNotification({
        kind:
          backendNotif.level === "error"
            ? "error"
            : backendNotif.level === "warning"
              ? "warning"
              : backendNotif.level === "success"
                ? "success"
                : "info",
        title: backendNotif.title,
        body: backendNotif.body,
        ...(backendNotif.action_label ? { actionLabel: backendNotif.action_label } : {}),
      });
    });
  }, 300);
}

import type {
  LlamaModel,
  LlamaInstance,
  InstanceStatus,
  LlamaProfile,
  ProfileScope,
  LlamaRelease,
  ReleaseVariant,
  MetricSample,
  HFDownload,
  AppNotification,
  NotificationKind,
  ConsoleLine,
  LogKind,
  AppStatus,
  GlobalSettings,
  Workspace,
  WorkspaceSettings,
  ViewMode,
} from "@/lib/types";
import type { HFSearchResult } from "@/lib/catalog";

import { HF_CATALOG, HF_QUANTS, RELEASE_VARIANTS, searchHFModels } from "@/lib/catalog";
import { uptimeString, pickPort, fmtNum, fmtBytes } from "@/lib/helpers";

export const SYSTEM_CONSOLE = SYSTEM_CONSOLE_ID;

export type {
  LlamaModel,
  LlamaInstance,
  InstanceStatus,
  LlamaProfile,
  ProfileScope,
  LlamaRelease,
  ReleaseVariant,
  MetricSample,
  HFDownload,
  AppNotification,
  NotificationKind,
  ConsoleLine,
  LogKind,
  AppStatus,
  GlobalSettings,
  Workspace,
  WorkspaceSettings,
  ViewMode,
};
export type { HFSearchResult } from "@/lib/catalog";

export { HF_CATALOG, HF_QUANTS, RELEASE_VARIANTS, searchHFModels, uptimeString, pickPort, fmtNum, fmtBytes };
