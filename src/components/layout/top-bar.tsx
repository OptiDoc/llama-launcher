"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Cpu,
  MemoryStick,
  Zap,
  Snowflake,
  ChevronDown,
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
  Copy,
} from "lucide-react";
import {
  useLlamaStore,
  type AppStatus,
  type Workspace,
  type NotificationKind,
} from "@/lib/llama-store";
import { isTauri } from "@/lib/tauri-api";

interface TopBarProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
}

const STATUS_CONFIG: Record<
  AppStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  active: { label: "Active", color: "text-emerald-400", icon: <Activity className="size-3" /> },
  idle: { label: "Idle", color: "text-amber-400", icon: <Activity className="size-3" /> },
  hibernating: { label: "Hibernating", color: "text-sky-400", icon: <Snowflake className="size-3" /> },
  waking: { label: "Waking", color: "text-violet-400", icon: <Zap className="size-3" /> },
};

const NOTIF_ICON: Record<NotificationKind, React.ReactNode> = {
  release: <Rocket className="size-3.5" />,
  download: <Download className="size-3.5" />,
  info: <Info className="size-3.5" />,
  success: <CheckCheck className="size-3.5" />,
  warn: <AlertTriangle className="size-3.5" />,
  error: <AlertTriangle className="size-3.5" />,
};

const NOTIF_COLOR: Record<NotificationKind, string> = {
  release: "text-violet-400",
  download: "text-emerald-400",
  info: "text-sky-400",
  success: "text-emerald-400",
  warn: "text-amber-400",
  error: "text-red-400",
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

/** Window control actions via Tauri. In browser mode they're no-ops. */
function useWindowControls() {
  const minimize = React.useCallback(async () => {
    if (!isTauri()) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch (e) { console.error(e); }
  }, []);
  const toggleMaximize = React.useCallback(async () => {
    if (!isTauri()) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().toggleMaximize();
    } catch (e) { console.error(e); }
  }, []);
  const close = React.useCallback(async () => {
    if (!isTauri()) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch (e) { console.error(e); }
  }, []);
  return { minimize, toggleMaximize, close };
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
  const notifications = useLlamaStore((s) => s.notifications);
  const markNotificationRead = useLlamaStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useLlamaStore((s) => s.markAllNotificationsRead);
  const clearNotifications = useLlamaStore((s) => s.clearNotifications);
  const metrics = useLlamaStore((s) => s.metrics);
  const systemCapabilities = useLlamaStore((s) => s.systemCapabilities);
  const { minimize, toggleMaximize, close } = useWindowControls();
  const [idleSecs, setIdleSecs] = React.useState(0);
  const [maximized, setMaximized] = React.useState(false);
  const tauriMode = isTauri();

  // Track maximized state for the toggle icon
  React.useEffect(() => {
    if (!tauriMode) return;
    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        setMaximized(await win.isMaximized());
        const unlisten = await win.onResized(() => {
          win.isMaximized().then(setMaximized);
        });
        return unlisten;
      } catch { /* ignore */ }
    })();
  }, [tauriMode]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0] ?? null;
  const runningCount = instances.filter((i) => i.status === "running" || i.status === "starting").length;
  const statusCfg = STATUS_CONFIG[appStatus];
  const unreadCount = notifications.filter((n) => !n.read).length;

  React.useEffect(() => {
    const t = setInterval(() => {
      setIdleSecs(Math.floor((Date.now() - useLlamaStore.getState().lastActivityAt) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    // Thin dark title bar — flat, no gradient. Serves as the window drag region.
    // Interactive elements use title-bar-no-drag so they remain clickable.
    <div className="title-bar flex h-9 items-center justify-between border-b border-black bg-[oklch(0.12_0.005_250)] px-2 text-zinc-300 select-none">
      {/* ===== Left: sidebar toggle + brand + workspace ===== */}
      <div className="title-bar-no-drag flex items-center gap-1.5">
        <button
          onClick={onToggleSidebar}
          className="grid size-7 place-items-center rounded text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>

        <div className="mx-0.5 h-4 w-px bg-white/10" />

        <div className="flex items-center gap-1.5">
          <div className="grid size-5 place-items-center rounded bg-primary text-[9px] font-bold text-primary-foreground">
            L
          </div>
          <span className="hidden text-[11px] font-semibold tracking-tight text-zinc-100 sm:inline">
            LlamaLauncher
          </span>
          {!tauriMode && (
            <span className="rounded bg-amber-500/20 px-1 text-[8px] font-medium text-amber-300">browser</span>
          )}
        </div>

        <div className="mx-0.5 h-4 w-px bg-white/10" />

        {/* Workspace dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-6 items-center gap-1.5 rounded px-1.5 text-[11px] font-medium text-zinc-300 hover:bg-white/10 hover:text-zinc-100">
              {activeWorkspace ? (
                <>
                  <span className={cn("size-1.5 rounded-full", workspaceColorDot(activeWorkspace.color))} />
                  <span className="max-w-[100px] truncate">{activeWorkspace.name}</span>
                </>
              ) : (
                <span className="text-zinc-500">No workspace</span>
              )}
              <ChevronDown className="size-2.5 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-[10px] text-muted-foreground">Workspaces</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.map((w) => (
              <DropdownMenuItem
                key={w.id}
                onClick={() => setActiveWorkspace(w.id)}
                className="gap-2 py-1"
              >
                <span className={cn("size-2 rounded-full", workspaceColorDot(w.color))} />
                <div className="flex flex-1 flex-col">
                  <span className="text-xs font-medium">{w.name}</span>
                  {w.description && (
                    <span className="text-[10px] text-muted-foreground">{w.description}</span>
                  )}
                </div>
                {w.id === activeWorkspaceId && <span className="text-[9px] text-primary">active</span>}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => addWorkspace({ name: `Workspace ${workspaces.length + 1}`, color: "orange", description: "New workspace" })}
              className="gap-2 py-1 text-[11px]"
            >
              <Copy className="size-3" /> New workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ===== Center: status strip (drag region) ===== */}
      <div className="title-bar-no-drag mx-2 flex min-w-0 flex-1 items-center justify-center gap-2">
        {/* Status pill */}
        <div className={cn("flex h-5 items-center gap-1 rounded border px-1.5 text-[10px] font-medium", "border-white/10 bg-white/5", statusCfg.color)}>
          {statusCfg.icon}
          <span>{statusCfg.label}</span>
        </div>

        {/* Instance count */}
        <div className="flex h-5 items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 text-[10px]">
          <Server className="size-2.5 text-zinc-400" />
          <span className="font-mono font-semibold text-zinc-100">{runningCount}</span>
          <span className="text-zinc-500">{runningCount === 1 ? "inst" : "insts"}</span>
          {runningCount > 0 && (
            <span className="relative ml-0.5 flex size-1">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-1 rounded-full bg-emerald-400" />
            </span>
          )}
        </div>

        {/* CPU */}
        <div className="hidden h-5 items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 text-[10px] md:flex">
          <Cpu className="size-2.5 text-zinc-400" />
          <span className="font-mono text-zinc-200">{metrics.length > 0 ? `${Math.round(metrics[metrics.length - 1].cpu)}%` : "--"}</span>
        </div>

        {/* RAM */}
        <div className="hidden h-5 items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 text-[10px] lg:flex">
          <MemoryStick className="size-2.5 text-zinc-400" />
          <span className="font-mono text-zinc-200">
            {systemCapabilities.ramGb > 0 ? `${Math.round(metrics[metrics.length - 1]?.ram ?? 0)}%` : "--"}
          </span>
        </div>

        {/* Idle timer */}
        {appStatus !== "active" && (
          <span className="hidden text-[9px] text-zinc-500 lg:inline">idle {idleSecs}s</span>
        )}
      </div>

      {/* ===== Right: notifications + power + window controls ===== */}
      <div className="title-bar-no-drag flex items-center gap-0.5">
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="relative grid size-6 place-items-center rounded text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
              title="Notifications"
            >
              <Bell className="size-3.5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid min-w-[12px] place-items-center rounded-full bg-primary px-0.5 text-[8px] font-bold text-primary-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-0">
            <div className="flex items-center justify-between border-b px-2.5 py-1.5">
              <span className="text-[11px] font-semibold">Notifications</span>
              <div className="flex items-center gap-0.5">
                <button onClick={markAllNotificationsRead} className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground" title="Mark all read">
                  <CheckCheck className="size-3" />
                </button>
                <button onClick={clearNotifications} className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-destructive" title="Clear all">
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
                  <Bell className="size-5 text-muted-foreground/40" />
                  <p className="text-[11px] text-muted-foreground">No notifications</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markNotificationRead(n.id)}
                    className={cn(
                      "flex w-full items-start gap-2 border-b px-2.5 py-2 text-left hover:bg-accent/50",
                      !n.read && "bg-primary/5",
                    )}
                  >
                    <span className={cn("mt-0.5 shrink-0", NOTIF_COLOR[n.kind])}>{NOTIF_ICON[n.kind]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[11px] font-semibold">{n.title}</span>
                        {!n.read && <span className="size-1 shrink-0 rounded-full bg-primary" />}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{n.body}</p>
                      <span className="mt-0.5 block text-[9px] text-muted-foreground/60">
                        {new Date(n.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Power */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-6 items-center gap-1 rounded px-1.5 text-[10px] font-medium text-zinc-400 hover:bg-white/10 hover:text-zinc-100">
              <Zap className="size-3" />
              <span className="hidden md:inline">Power</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-[10px] text-muted-foreground">Power management</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={forceWake} className="gap-2 py-1" disabled={appStatus === "active"}>
              <Activity className="size-3 text-emerald-500" />
              <div className="flex flex-1 flex-col">
                <span className="text-xs font-medium">Force active</span>
                <span className="text-[10px] text-muted-foreground">Wake hibernated models</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={forceHibernate} className="gap-2 py-1" disabled={appStatus === "hibernating"}>
              <Snowflake className="size-3 text-sky-500" />
              <div className="flex flex-1 flex-col">
                <span className="text-xs font-medium">Hibernate now</span>
                <span className="text-[10px] text-muted-foreground">Unload models from VRAM</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-0.5 h-4 w-px bg-white/10" />

        {/* Window controls — work via Tauri window API */}
        <div className="flex items-center">
          <button
            onClick={minimize}
            className="grid size-7 place-items-center text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
            aria-label="Minimize"
            title="Minimize"
          >
            <Minus className="size-3.5" />
          </button>
          <button
            onClick={toggleMaximize}
            className="grid size-7 place-items-center text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
            aria-label={maximized ? "Restore" : "Maximize"}
            title={maximized ? "Restore" : "Maximize"}
          >
            {maximized ? (
              <svg className="size-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="2" y="3.5" width="6.5" height="6.5" rx="0.5" />
                <path d="M4 3.5V2h6v6H8.5" />
              </svg>
            ) : (
              <Square className="size-2.5" />
            )}
          </button>
          <button
            onClick={close}
            className="grid size-7 place-items-center text-zinc-400 hover:bg-red-500 hover:text-white"
            aria-label="Close"
            title="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
