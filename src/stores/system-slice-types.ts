/**
 * System slice types.
 */

import type { SystemCapabilities, AppStatus, MetricSample, GlobalSettings, WorkspaceSettings } from "@/lib/types";

export interface SystemSlice {
  tauriReady: boolean;
  systemCapabilities: SystemCapabilities;
  appStatus: AppStatus;
  lastActivityAt: number;
  hibernatedInstanceIds: string[];
  metrics: MetricSample[];
  registerActivity: () => void;
  setAppStatus: (s: AppStatus) => void;
  forceHibernate: () => void;
  forceWake: () => void;
  pushMetric: (m: MetricSample) => void;
  refreshSystem: () => Promise<void>;
  bootstrap: () => Promise<void>;
}
