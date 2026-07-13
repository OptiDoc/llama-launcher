"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
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
  Zap,
  Snowflake,
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
  Plus,
  ChevronDown,
  Moon,
  ChevronRight,
} from "lucide-react";
import {
  useLlamaStore,
  type AppStatus,
  type Workspace,
  type NotificationKind,
} from "@/lib/llama-store";
import { isTauri } from "@/lib/tauri-api";
import { useShallow } from "zustand/react/shallow";

interface TopBarProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
}

const STATUS_CONFIG: Record<
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
  waking: {
    label: "Waking",
    icon: <Zap className="size-3" />,
    dotColor: "bg-violet-500",
    textColor: "text-violet-600",
  },
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
  release: "text-violet-500",
  download: "text-emerald-500",
  info: "text-sky-500",
  success: "text-emerald-500",
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
  const {
    appStatus, instances, workspaces, activeWorkspaceId,
    setActiveWorkspace, addWorkspace, forceHibernate, forceWake,
    lastActivityAt, notifications, markNotificationRead,
    markAllNotificationsRead, clearNotifications,
  } = useLlamaStore(useShallow((s) => ({
    appStatus: s.appStatus,
    instances: s.instances,
    workspaces: s.workspaces,
    activeWorkspaceId: s.activeWorkspaceId,
    setActiveWorkspace: s.setActiveWorkspace,
    addWorkspace: s.addWorkspace,
    forceHibernate: s.forceHibernate,
    forceWake: s.forceWake,
    lastActivityAt: s.lastActivityAt,
    notifications: s.notifications,
    markNotificationRead: s.markNotificationRead,
    markAllNotificationsRead: s.markAllNotificationsRead,
    clearNotifications: s.clearNotifications,
  })));
  const { minimize, toggleMaximize, close } = useWindowControls();
  const [idleSecs, setIdleSecs] = React.useState(0);
  const [maximized, setMaximized] = React.useState(false);

  React.useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        setMaximized(await win.isMaximized());
        unlisten = await win.onResized(() => { win.isMaximized().then(setMaximized); });
      } catch { /* ignore */ }
    })();
    return () => { unlisten?.(); };
  }, []);

  React.useEffect(() => {
    const t = setInterval(() => {
      setIdleSecs(Math.floor((Date.now() - lastActivityAt) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [lastActivityAt]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0] ?? null;
  const runningCount = instances.filter((i) => i.status === "running" || i.status === "starting").length;
  const statusCfg = STATUS_CONFIG[appStatus];
  const isHibernating = appStatus === "hibernating";
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="title-bar flex h-12 shrink-0 items-center justify-between bg-background px-2 select-none">
      {/* Left */}
      <div className="title-bar-no-drag flex h-full items-center gap-1">
        <button
          onClick={onToggleSidebar}
          className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>

        {/* Logo + app name */}
        <div className="flex items-center gap-2 pl-1">
          <div className="grid size-6 place-items-center rounded-md bg-linear-to-br from-blue-400 to-blue-500 text-[13px] font-bold text-white shadow-sm">
            LL
          </div>
          <span className="text-[14px] font-semibold text-foreground tracking-tight">Llama launcher</span>
        </div>

        <div className="mx-1 h-4 w-px " />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium text-foreground/80 hover:bg-accent transition-colors">
              {activeWorkspace && (
                <span className="grid size-4.5 place-items-center rounded-md border">
                  <span className={cn("size-1.5 rounded-sm", workspaceColorDot(activeWorkspace.color))} />
                </span>
              )}
              <span className="max-w-25 truncate">{activeWorkspace?.name ?? "Workspace"}</span>
              <ChevronDown className="size-3 opacity-40" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Workspaces</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.map((w) => (
              <DropdownMenuItem key={w.id} onClick={() => setActiveWorkspace(w.id)} className="gap-2 py-1.5">
                <span className="grid size-4.5 place-items-center border rounded-md">
                  <span className={cn("size-1.5 rounded-sm", workspaceColorDot(w.color))} />
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-[12px] font-medium">{w.name}</span>
                  {w.description && <span className="text-[10px] text-muted-foreground">{w.description}</span>}
                </div>
                {w.id === activeWorkspaceId && <span className="text-[9px] font-medium text-primary">active</span>}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => addWorkspace({ name: `Workspace ${workspaces.length + 1}`, color: "orange", description: "New workspace" })} className="gap-2 py-1.5 text-[11px]">
              <Plus className="size-3" /> New workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ChevronRight className="size-3 text-muted-foreground/40" />
        <div className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium", statusCfg.textColor)}>
          <span className={cn("size-1.5 rounded-full", statusCfg.dotColor, isHibernating && "animate-pulse")} />
          {statusCfg.label}
        </div>
      </div>

      {/* Center */}
      <div className="title-bar-no-drag flex h-full items-center gap-3">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Server className="size-3" />
          <span className="font-mono font-semibold text-foreground">{runningCount}</span>
          <span>{runningCount === 1 ? "instance" : "instances"}</span>
          {runningCount > 0 && (
            <span className="relative ml-0.5 flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
          )}
        </div>
        {appStatus !== "active" && (
          <div className="hidden items-center gap-1.5 text-[10px] text-muted-foreground/60 lg:flex">
            <Moon className="size-3" />
            <span className="font-mono">idle {idleSecs}s</span>
          </div>
        )}
      </div>

      {/* Right */}
      <div className="title-bar-no-drag flex h-full items-center gap-0.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <Zap className="size-3" />
              <span className="hidden md:inline">Power</span>
              <ChevronDown className="size-2.5 opacity-40" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Power management</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={forceWake} className="gap-2 py-1.5" disabled={appStatus === "active"}>
              <Activity className="size-3.5 text-emerald-500" />
              <div className="flex flex-1 flex-col">
                <span className="text-[12px] font-medium">Force active</span>
                <span className="text-[10px] text-muted-foreground">Wake hibernated models</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={forceHibernate} className="gap-2 py-1.5" disabled={appStatus === "hibernating"}>
              <Snowflake className="size-3.5 text-sky-500" />
              <div className="flex flex-1 flex-col">
                <span className="text-[12px] font-medium">Hibernate now</span>
                <span className="text-[10px] text-muted-foreground">Unload models from VRAM</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}>
              <Bell className="size-3.5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 grid min-w-[14px] place-items-center rounded-full bg-primary px-1 text-[8px] font-bold text-primary-foreground leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-0">
            <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
              <span className="text-[11px] font-semibold">Notifications</span>
              <div className="flex items-center gap-0.5">
                <button onClick={markAllNotificationsRead} className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" title="Mark all read">
                  <CheckCheck className="size-3" />
                </button>
                <button onClick={clearNotifications} className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive" title="Clear all">
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
                  <Bell className="size-5 text-muted-foreground/25" />
                  <p className="text-[11px] text-muted-foreground">No notifications</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <button key={n.id} onClick={() => markNotificationRead(n.id)} className={cn("flex w-full items-start gap-2.5 border-b border-border/40 px-3 py-2.5 text-left transition-colors hover:bg-accent/40", !n.read && "bg-primary/5")}>
                    <span className={cn("mt-0.5 shrink-0", NOTIF_COLOR[n.kind])}>{NOTIF_ICON[n.kind]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[11px] font-semibold">{n.title}</span>
                        {!n.read && <span className="size-1 shrink-0 rounded-full bg-primary" />}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{n.body}</p>
                      <span className="mt-0.5 block text-[9px] text-muted-foreground/40">{new Date(n.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1 h-4 w-px bg-border/60" />

        <div className="flex items-center">
          <button onClick={minimize} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" aria-label="Minimize">
            <Minus className="size-3.5" />
          </button>
          <button onClick={toggleMaximize} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" aria-label={maximized ? "Restore" : "Maximize"}>
            {maximized ? (
              <svg className="size-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="2" y="3.5" width="6.5" height="6.5" rx="0.5" /><path d="M4 3.5V2h6v6H8.5" /></svg>
            ) : (
              <Square className="size-2.5" />
            )}
          </button>
          <button onClick={close} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-red-500 hover:text-white transition-colors" aria-label="Close">
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
