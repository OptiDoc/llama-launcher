/**
 * Top bar status component.
 */

import { cn } from "@/lib/utils";
import { STATUS_CONFIG } from "./top-bar-types";
import type { AppStatus } from "@/lib/llama-store";

interface TopBarStatusProps {
  appStatus: AppStatus;
}

export function TopBarStatus({ appStatus }: TopBarStatusProps) {
  const statusCfg = STATUS_CONFIG[appStatus];
  const isHibernating = appStatus === "hibernating";

  return (
    <div
      className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium", statusCfg.textColor)}
    >
      <span className={cn("size-1.5 rounded-full", statusCfg.dotColor, isHibernating && "animate-pulse")} />
      {statusCfg.label}
    </div>
  );
}
