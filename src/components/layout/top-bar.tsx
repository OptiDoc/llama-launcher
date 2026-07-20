/**
 * Top bar — main component.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Server,
  Activity,
  Zap,
  Snowflake,
  Moon,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  useLlamaStore,
  type AppStatus,
  type Workspace,
  type NotificationKind,
} from "@/lib/llama-store";
import { isTauri } from "@/lib/tauri-api";
import { useShallow } from "zustand/react/shallow";
import { TopBarWorkspace } from "./top-bar-workspace";
import { TopBarStatus } from "./top-bar-status";
import { TopBarNotifications } from "./top-bar-notifications";
import { TopBarWindowControls } from "./top-bar-window-controls";

interface TopBarProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
}

function useWindowControls() {
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
      } catch (e) { /* ignore */ }
    })();
    return () => { unlisten?.(); };
  }, []);

  const toggleMaximize = React.useCallback(async () => {
    if (!isTauri()) { return; }
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().toggleMaximize();
    } catch (e) { /* ignore */ }
  }, []);

  return { maximized, toggleMaximize };
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

  const { maximized, toggleMaximize } = useWindowControls();
  const [idleSecs, setIdleSecs] = React.useState(0);

  React.useEffect(() => {
    const t = setInterval(() => {
      setIdleSecs(Math.floor((Date.now() - lastActivityAt) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [lastActivityAt]);

  const runningCount = instances.filter((i) => i.status === "running" || i.status === "starting").length;
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
        <TopBarWorkspace
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          setActiveWorkspace={setActiveWorkspace}
          addWorkspace={addWorkspace}
        />
        <TopBarStatus appStatus={appStatus} />
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

        <TopBarNotifications
          notifications={notifications}
          unreadCount={unreadCount}
          markNotificationRead={markNotificationRead}
          markAllNotificationsRead={markAllNotificationsRead}
          clearNotifications={clearNotifications}
        />

        <div className="mx-1 h-4 w-px bg-border/60" />

        <TopBarWindowControls maximized={maximized} onToggleMaximize={toggleMaximize} />
      </div>
    </div>
  );
}
