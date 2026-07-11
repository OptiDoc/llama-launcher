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
  Activity,
  Snowflake,
  Zap,
  Moon,
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
  { label: string; icon: React.ReactNode; accent: string }
> = {
  active: {
    label: "Active",
    icon: <Activity className="size-3" />,
    accent: "bg-emerald-500",
  },
  idle: {
    label: "Idle",
    icon: <Moon className="size-3" />,
    accent: "bg-amber-500",
  },
  hibernating: {
    label: "Hibernating",
    icon: <Snowflake className="size-3" />,
    accent: "bg-sky-500",
  },
  waking: {
    label: "Waking up",
    icon: <Zap className="size-3" />,
    accent: "bg-violet-500",
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

/** Animated equalizer bars — live activity indicator inside the status tab. */
function Equalizer({ active }: { active: boolean }) {
  return (
    <div className="flex h-3 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            "w-[2px] rounded-full bg-current",
            active ? "eq-bar" : "h-[3px] opacity-40",
          )}
          style={active ? { height: "100%" } : undefined}
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
  const { minimize, toggleMaximize, close } = useWindowControls();
  const [idleSecs, setIdleSecs] = React.useState(0);
  const [maximized, setMaximized] = React.useState(false);
  const tauriMode = isTauri();

  React.useEffect(() => {
    if (!tauriMode) return;
    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        setMaximized(await win.isMaximized());
        await win.onResized(() => {
          win.isMaximized().then(setMaximized);
        });
      } catch { /* ignore */ }
    })();
  }, [tauriMode]);

  React.useEffect(() => {
    const t = setInterval(() => {
      setIdleSecs(Math.floor((Date.now() - lastActivityAt) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [lastActivityAt]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0] ?? null;
  const runningCount = instances.filter((i) => i.status === "running" || i.status === "starting").length;
  const statusCfg = STATUS_CONFIG[appStatus];
  const isActive = appStatus === "active";
  const isHibernating = appStatus === "hibernating";
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    // Reference-style title bar: flat white (light) / dark navy (dark),
    // ~48px tall, with a black border on top. The center contains a dark
    // "bookmark/tab" shaped status element on a black/navy background.
    <div className="title-bar relative flex h-12 items-center justify-between border-b border-border bg-card select-none">
      {/* ===== Left: sidebar toggle + red logo + workspace ===== */}
      <div className="title-bar-no-drag flex h-full items-center gap-2 pl-2">
        <button
          onClick={onToggleSidebar}
          className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>

        {/* Red square logo — reference style */}
        <div className="grid size-6 place-items-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
          L
        </div>

        <div className="mx-1 h-5 w-px bg-border" />

        {/* Workspace dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-7 items-center gap-1.5 rounded px-2 text-xs font-medium text-foreground hover:bg-accent">
              {activeWorkspace ? (
                <>
                  <span className={cn("size-2 rounded-full", workspaceColorDot(activeWorkspace.color))} />
                  <span className="max-w-[120px] truncate">{activeWorkspace.name}</span>
                </>
              ) : (
                <span className="text-muted-foreground">No workspace</span>
              )}
              <ChevronDown className="size-3 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-[10px] text-muted-foreground">Workspaces</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.map((w) => (
              <DropdownMenuItem key={w.id} onClick={() => setActiveWorkspace(w.id)} className="gap-2 py-1.5">
                <span className={cn("size-2 rounded-full", workspaceColorDot(w.color))} />
                <div className="flex flex-1 flex-col">
                  <span className="text-xs font-medium">{w.name}</span>
                  {w.description && <span className="text-[10px] text-muted-foreground">{w.description}</span>}
                </div>
                {w.id === activeWorkspaceId && <span className="text-[9px] text-primary">active</span>}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => addWorkspace({ name: `Workspace ${workspaces.length + 1}`, color: "orange", description: "New workspace" })}
              className="gap-2 py-1.5 text-[11px]"
            >
              <Plus className="size-3" /> New workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ===== Center: dark "bookmark tab" status element =====
          A dark (black/navy) tab-shaped element sitting in the center of the
          light top bar, spanning ~1/3 of the window width, with slanted
          (skewed) vertical edges like a ribbon/bookmark. Shows the app status
          (Active / Idle / Hibernating / Waking), live equalizer, idle timer,
          and instance count. */}
      <div className="title-bar-no-drag pointer-events-none absolute inset-x-0 top-0 flex justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="pointer-events-auto relative mt-0 flex h-12 w-[33vw] max-w-[520px] items-center justify-center gap-3 border-x border-b border-black/60 bg-[oklch(0.14_0.015_250)] px-8 text-zinc-200 shadow-md transition-colors hover:bg-[oklch(0.18_0.015_250)]"
              style={{
                /* Slanted vertical edges (ribbon/bookmark shape):
                   top edge is the full width of the bar, bottom edge is
                   slightly narrower, creating angled side edges. */
                clipPath: "polygon(3% 0, 97% 0, 94% 100%, 6% 100%)",
              }}
            >
              {/* Status icon + label */}
              <span className={cn("flex items-center gap-1.5 text-xs font-semibold", statusCfg.accent.replace("bg-", "text-"))}>
                <span className={cn(isHibernating && "animate-pulse")}>{statusCfg.icon}</span>
                <span className="text-zinc-100">{statusCfg.label}</span>
              </span>

              {/* Divider */}
              <span className="h-3 w-px bg-white/15" />

              {/* Live equalizer */}
              <div className={cn("flex items-center gap-1.5", isActive ? "text-emerald-400" : "text-zinc-500")}>
                <Equalizer active={isActive} />
                <span className="font-mono text-[9px] uppercase tracking-wide opacity-70">
                  {isActive ? "live" : isHibernating ? "frozen" : appStatus}
                </span>
              </div>

              {/* Divider */}
              <span className="h-3 w-px bg-white/15" />

              {/* Instance count */}
              <span className="flex items-center gap-1 text-xs">
                <span className="font-mono font-bold text-zinc-100">{runningCount}</span>
                <span className="text-[9px] text-zinc-400">{runningCount === 1 ? "inst" : "insts"}</span>
                {runningCount > 0 && (
                  <span className="relative ml-0.5 flex size-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
                  </span>
                )}
              </span>

              {/* Idle timer — only when not active */}
              {!isActive && (
                <>
                  <span className="h-3 w-px bg-white/15" />
                  <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                    <Moon className="size-2.5" />
                    <span className="font-mono">{idleSecs}s</span>
                  </span>
                </>
              )}

              <ChevronDown className="size-3 text-zinc-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-64">
            <DropdownMenuLabel className="text-[10px] text-muted-foreground">Power management</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={forceWake} className="gap-2 py-1.5" disabled={appStatus === "active"}>
              <Activity className="size-3.5 text-emerald-500" />
              <div className="flex flex-1 flex-col">
                <span className="text-xs font-medium">Force active</span>
                <span className="text-[10px] text-muted-foreground">Wake hibernated models</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={forceHibernate} className="gap-2 py-1.5" disabled={appStatus === "hibernating"}>
              <Snowflake className="size-3.5 text-sky-500" />
              <div className="flex flex-1 flex-col">
                <span className="text-xs font-medium">Hibernate now</span>
                <span className="text-[10px] text-muted-foreground">Unload models from VRAM</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-[10px] text-muted-foreground">
              Status: <span className="font-medium text-foreground">{statusCfg.label}</span> · {runningCount} running · idle {idleSecs}s
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ===== Right: notifications + window controls ===== */}
      <div className="title-bar-no-drag relative z-10 flex h-full items-center gap-1 pr-1">
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="relative grid size-8 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
              title="Notifications"
            >
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 grid min-w-[14px] place-items-center rounded-full bg-primary px-0.5 text-[8px] font-bold text-primary-foreground">
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

        {!tauriMode && (
          <span className="hidden rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-medium text-amber-600 dark:text-amber-400 sm:inline">
            browser
          </span>
        )}

        <div className="mx-0.5 h-5 w-px bg-border" />

        {/* Window controls */}
        <div className="flex items-center">
          <button
            onClick={minimize}
            className="grid size-8 place-items-center text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Minimize"
            title="Minimize"
          >
            <Minus className="size-4" />
          </button>
          <button
            onClick={toggleMaximize}
            className="grid size-8 place-items-center text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={maximized ? "Restore" : "Maximize"}
            title={maximized ? "Restore" : "Maximize"}
          >
            {maximized ? (
              <svg className="size-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="2" y="3.5" width="6.5" height="6.5" rx="0.5" />
                <path d="M4 3.5V2h6v6H8.5" />
              </svg>
            ) : (
              <Square className="size-3" />
            )}
          </button>
          <button
            onClick={close}
            className="grid size-8 place-items-center text-muted-foreground hover:bg-red-500 hover:text-white"
            aria-label="Close"
            title="Close"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
