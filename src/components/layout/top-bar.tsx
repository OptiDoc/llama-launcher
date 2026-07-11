"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Server,
  Activity,
  Moon,
  Zap,
  Snowflake,
  Plus,
  ChevronDown,
  Circle,
  Minus,
  Square,
  X,
  Bell,
  Download,
  Rocket,
  Info,
  AlertTriangle,
  CheckCheck,
  Trash2,
} from "lucide-react";
import {
  useLlamaStore,
  type AppStatus,
  type Workspace,
  type NotificationKind,
} from "@/lib/llama-store";

interface TopBarProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
}

const STATUS_CONFIG: Record<
  AppStatus,
  { label: string; color: string; bg: string; icon: React.ReactNode; description: string }
> = {
  active: {
    label: "Active",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    icon: <Activity className="size-3.5" />,
    description: "Serving requests",
  },
  idle: {
    label: "Idle",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/30",
    icon: <Circle className="size-3.5" />,
    description: "No recent activity · will hibernate soon",
  },
  hibernating: {
    label: "Hibernating",
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/30",
    icon: <Snowflake className="size-3.5" />,
    description: "Models unloaded · will hot-reload on next request",
  },
  waking: {
    label: "Waking up",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/30",
    icon: <Zap className="size-3.5" />,
    description: "Hot-reloading hibernated models",
  },
};

const NOTIF_ICON: Record<NotificationKind, React.ReactNode> = {
  release: <Rocket className="size-4" />,
  download: <Download className="size-4" />,
  info: <Info className="size-4" />,
  warn: <AlertTriangle className="size-4" />,
  error: <AlertTriangle className="size-4" />,
};

const NOTIF_COLOR: Record<NotificationKind, string> = {
  release: "text-violet-500",
  download: "text-emerald-500",
  info: "text-sky-500",
  warn: "text-amber-500",
  error: "text-red-500",
};

function workspaceColorDot(color: Workspace["color"]) {
  const map: Record<Workspace["color"], string> = {
    green: "bg-emerald-500",
    orange: "bg-amber-500",
    blue: "bg-sky-500",
    pink: "bg-rose-500",
    purple: "bg-violet-500",
  };
  return map[color];
}

/** Animated equalizer bars used as a live activity indicator */
function Equalizer({ active }: { active: boolean }) {
  return (
    <div className="flex h-4 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            "w-[2px] rounded-full bg-current",
            active ? "eq-bar" : "h-[3px] opacity-40",
          )}
          style={!active ? undefined : { height: "100%" }}
        />
      ))}
    </div>
  );
}

export function TopBar({ collapsed, onToggleSidebar }: TopBarProps) {
  const appStatus = useLlamaStore((s) => s.appStatus);
  const instances = useLlamaStore((s) => s.instances);
  const workspaces = useLlamaStore((s) => s.workspaces);
  const activeWorkspaceId = useLlamaStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useLlamaStore((s) => s.setActiveWorkspace);
  const addWorkspace = useLlamaStore((s) => s.addWorkspace);
  const forceHibernate = useLlamaStore((s) => s.forceHibernate);
  const forceWake = useLlamaStore((s) => s.forceWake);
  const lastActivityAt = useLlamaStore((s) => s.lastActivityAt);
  const notifications = useLlamaStore((s) => s.notifications);
  const markNotificationRead = useLlamaStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useLlamaStore((s) => s.markAllNotificationsRead);
  const clearNotifications = useLlamaStore((s) => s.clearNotifications);
  const [idleSecs, setIdleSecs] = React.useState(0);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];
  const runningCount = instances.filter((i) => i.status === "running" || i.status === "starting").length;
  const statusCfg = STATUS_CONFIG[appStatus];
  const isActive = appStatus === "active";
  const isHibernating = appStatus === "hibernating";
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Live idle timer display
  React.useEffect(() => {
    const t = setInterval(() => {
      setIdleSecs(Math.floor((Date.now() - lastActivityAt) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [lastActivityAt]);

  return (
    <div className="title-bar flex h-11 items-center justify-between border-b border-black/80 bg-[oklch(0.14_0.005_250)] px-3 text-zinc-200 select-none">
      {/* ===== Left cluster: drag handle + sidebar toggle + workspace ===== */}
      <div className="title-bar-no-drag flex items-center gap-2">
        {/* Sidebar collapse toggle (chat.z.ai style: panel icon) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="size-7 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>

        <div className="mx-1 h-5 w-px bg-white/15" />

        {/* Brand mark */}
        <div className="flex items-center gap-2 pr-2">
          <div className="grid size-6 place-items-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
            L
          </div>
          <span className="hidden text-xs font-semibold tracking-tight text-zinc-100 sm:inline">
            LlamaLauncher
          </span>
        </div>

        <div className="mx-1 h-5 w-px bg-white/15" />

        {/* Workspace dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-7 gap-2 px-2 text-xs font-medium text-zinc-200 hover:bg-white/10 hover:text-zinc-100"
            >
              <span className={cn("size-2 rounded-full", workspaceColorDot(activeWorkspace.color))} />
              <span className="max-w-[140px] truncate">{activeWorkspace.name}</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.map((w) => (
              <DropdownMenuItem
                key={w.id}
                onClick={() => setActiveWorkspace(w.id)}
                className="gap-2 py-1.5"
              >
                <span className={cn("size-2 rounded-full", workspaceColorDot(w.color))} />
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium">{w.name}</span>
                  {w.description && (
                    <span className="text-[11px] text-muted-foreground">{w.description}</span>
                  )}
                </div>
                {w.id === activeWorkspaceId && (
                  <span className="text-[10px] text-primary">active</span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                addWorkspace({
                  name: `Workspace ${workspaces.length + 1}`,
                  color: "orange",
                  description: "New workspace",
                })
              }
              className="gap-2 py-1.5 text-xs"
            >
              <Plus className="size-3.5" />
              New workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ===== Center: drag region (visual status strip) ===== */}
      <div className="title-bar-no-drag mx-3 flex min-w-0 flex-1 items-center justify-center gap-3">
        {/* Animated status pill */}
        <div
          className={cn(
            "flex h-7 items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors",
            statusCfg.bg,
            statusCfg.color,
          )}
          title={statusCfg.description}
        >
          <span className={cn(isHibernating && "animate-hibernate")}>
            {statusCfg.icon}
          </span>
          <span className="font-semibold">{statusCfg.label}</span>
          <span className="hidden text-[10px] opacity-70 md:inline">
            {statusCfg.description}
          </span>
        </div>

        {/* Live equalizer (animates when active, freezes when hibernating) */}
        <div className={cn("hidden items-center gap-1.5 sm:flex", statusCfg.color)}>
          <Equalizer active={isActive} />
          <span className="font-mono text-[10px] opacity-70">
            {isActive ? "live" : isHibernating ? "frozen" : appStatus}
          </span>
        </div>

        {/* Idle timer */}
        {!isActive && (
          <div className="hidden items-center gap-1.5 text-[11px] text-zinc-400 lg:flex">
            <Moon className="size-3" />
            <span className="font-mono">idle {idleSecs}s</span>
          </div>
        )}

        {/* Instance counter */}
        <div className="flex h-7 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-xs">
          <Server className="size-3.5 text-zinc-300" />
          <span className="font-mono font-semibold text-zinc-100">{runningCount}</span>
          <span className="text-[10px] text-zinc-400">
            {runningCount === 1 ? "instance" : "instances"}
          </span>
          {runningCount > 0 && (
            <span className="relative ml-1 flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
          )}
        </div>
      </div>

      {/* ===== Right cluster: notifications + power + window controls ===== */}
      <div className="title-bar-no-drag flex items-center gap-1">
        {/* Notifications bell */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="relative grid size-7 place-items-center rounded text-zinc-300 hover:bg-white/10 hover:text-zinc-100"
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
              title="Notifications"
            >
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid min-w-[14px] place-items-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-primary-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-xs font-semibold">Notifications</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={markAllNotificationsRead}
                  className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Mark all as read"
                >
                  <CheckCheck className="size-3.5" />
                </button>
                <button
                  onClick={clearNotifications}
                  className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-destructive"
                  title="Clear all"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <Bell className="size-6 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">No notifications yet</p>
                  <p className="text-[10px] text-muted-foreground/70">
                    New releases, downloads and system alerts appear here.
                  </p>
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markNotificationRead(n.id)}
                    className={cn(
                      "flex w-full items-start gap-2.5 border-b px-3 py-2.5 text-left transition-colors hover:bg-accent/50",
                      !n.read && "bg-primary/5",
                    )}
                  >
                    <span className={cn("mt-0.5 shrink-0", NOTIF_COLOR[n.kind])}>
                      {NOTIF_ICON[n.kind]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold">{n.title}</span>
                        {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{n.body}</p>
                      <span className="mt-1 block text-[10px] text-muted-foreground/60">
                        {new Date(n.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-0.5 h-5 w-px bg-white/15" />

        {/* Power / hibernate controls */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-zinc-300 hover:bg-white/10 hover:text-zinc-100"
            >
              <Zap className="size-3.5" />
              <span className="hidden md:inline">Power</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Power management
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={forceWake}
              className="gap-2 py-1.5"
              disabled={appStatus === "active"}
            >
              <Activity className="size-3.5 text-emerald-500" />
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium">Force active</span>
                <span className="text-[11px] text-muted-foreground">Wake all hibernated models</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={forceHibernate}
              className="gap-2 py-1.5"
              disabled={appStatus === "hibernating"}
            >
              <Snowflake className="size-3.5 text-sky-500" />
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium">Hibernate now</span>
                <span className="text-[11px] text-muted-foreground">Unload all models from VRAM</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
              Auto-hibernate after {useLlamaStore.getState().workspaceSettings[activeWorkspaceId]?.hibernateAfterSec ?? 75}s idle (configurable in Settings)
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1 h-5 w-px bg-white/15" />

        {/* Window controls (visual only — drag region for moving the window) */}
        <div className="flex items-center gap-0.5">
          <button
            className="grid size-7 place-items-center rounded text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
            aria-label="Minimize window"
            title="Minimize"
          >
            <Minus className="size-3.5" />
          </button>
          <button
            className="grid size-7 place-items-center rounded text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
            aria-label="Maximize window"
            title="Maximize"
          >
            <Square className="size-3" />
          </button>
          <button
            className="grid size-7 place-items-center rounded text-zinc-400 hover:bg-red-500 hover:text-white"
            aria-label="Close window"
            title="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
