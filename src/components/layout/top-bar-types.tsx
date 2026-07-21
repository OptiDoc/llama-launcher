/**
 * Top bar types and configurations.
 */

import { Activity, Zap, Snowflake, Moon, Download, Rocket, Info, AlertTriangle, CheckCheck, Cpu } from "lucide-react";
import type { AppStatus, NotificationKind, Workspace } from "@/lib/llama-store";

export interface TopBarProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
}

export const STATUS_CONFIG: Record<
  AppStatus,
  { label: string; icon: React.ReactNode; dotColor: string; textColor: string }
> = {
  active: {
    label: "Active",
    icon: <Activity className="size-3" />,
    dotColor: "bg-emerald-500",
    textColor: "text-emerald-600",
  },
  idle: {
    label: "Idle",
    icon: <Moon className="size-3" />,
    dotColor: "bg-amber-500",
    textColor: "text-amber-600",
  },
  hibernating: {
    label: "Hibernating",
    icon: <Snowflake className="size-3" />,
    dotColor: "bg-sky-500",
    textColor: "text-sky-600",
  },
  hibernated: {
    label: "Hibernated",
    icon: <Snowflake className="size-3" />,
    dotColor: "bg-sky-700",
    textColor: "text-sky-700",
  },
  waking: {
    label: "Waking",
    icon: <Zap className="size-3" />,
    dotColor: "bg-primary",
    textColor: "text-primary",
  },
};

export const NOTIF_ICON: Record<NotificationKind, React.ReactNode> = {
  release: <Rocket className="size-3.5" />,
  download: <Download className="size-3.5" />,
  info: <Info className="size-3.5" />,
  success: <CheckCheck className="size-3.5" />,
  warning: <AlertTriangle className="size-3.5" />,
  error: <AlertTriangle className="size-3.5" />,
  system: <Cpu className="size-3.5" />,
};

export const NOTIF_COLOR: Record<NotificationKind, string> = {
  release: "text-violet-500",
  download: "text-emerald-500",
  info: "text-sky-500",
  success: "text-emerald-500",
  warning: "text-amber-500",
  error: "text-red-500",
  system: "text-muted-foreground",
};

export function workspaceColorDot(color: Workspace["color"]) {
  const map: Record<Workspace["color"], string> = {
    green: "bg-emerald-500",
    orange: "bg-amber-500",
    blue: "bg-sky-500",
    pink: "bg-rose-500",
    purple: "bg-violet-500",
  };
  return map[color];
}
