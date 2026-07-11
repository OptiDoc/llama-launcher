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
  Bell,
  Download,
  Rocket,
  Info,
  AlertTriangle,
  CheckCheck,
  Trash2,
  RefreshCw,
  Power,
  ChevronDown,
  Minus,
  Square,
  X,
} from "lucide-react";
import { useLlamaStore, isTauri } from "@/lib/llama-store";
import type { AppNotificationKind } from "@/lib/llama-store";

interface TopBarProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
}

const NOTIF_ICON: Record<AppNotificationKind, React.ReactNode> = {
  release: <Rocket className="size-4" />,
  download: <Download className="size-4" />,
  info: <Info className="size-4" />,
  success: <CheckCheck className="size-4" />,
  warn: <AlertTriangle className="size-4" />,
  error: <AlertTriangle className="size-4" />,
};

const NOTIF_COLOR: Record<AppNotificationKind, string> = {
  release: "text-violet-500",
  download: "text-emerald-500",
  info: "text-sky-500",
  success: "text-emerald-500",
  warn: "text-amber-500",
  error: "text-red-500",
};

export function TopBar({ collapsed, onToggleSidebar }: TopBarProps) {
  const processes = useLlamaStore((s) => s.processes);
  const system = useLlamaStore((s) => s.system);
  const gpus = useLlamaStore((s) => s.gpus);
  const llamaBinary = useLlamaStore((s) => s.llamaBinary);
  const notifications = useLlamaStore((s) => s.notifications);
  const markNotificationRead = useLlamaStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useLlamaStore((s) => s.markAllNotificationsRead);
  const clearNotifications = useLlamaStore((s) => s.clearNotifications);
  const refreshAll = useLlamaStore((s) => s.refreshAll);

  const runningCount = processes.filter((p) => p.status === "running" || p.status === "starting").length;
  const unreadCount = notifications.filter((n) => !n.read).length;
  const tauriMode = isTauri();

  const memPct = system && system.memory_total_mb > 0
    ? Math.round((system.memory_used_mb / system.memory_total_mb) * 100)
    : 0;
  const memDisplay = system ? `${Math.round(system.memory_used_mb / 1024)} / ${Math.round(system.memory_total_mb / 1024)} GB` : "--";

  return (
    <div className="title-bar flex h-11 items-center justify-between border-b border-black/80 bg-[oklch(0.14_0.005_250)] px-3 text-zinc-200 select-none">
      {/* ===== Left cluster ===== */}
      <div className="title-bar-no-drag flex items-center gap-2">
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

        <div className="flex items-center gap-2 pr-2">
          <div className="grid size-6 place-items-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
            L
          </div>
          <span className="hidden text-xs font-semibold tracking-tight text-zinc-100 sm:inline">
            LlamaLauncher
          </span>
          {!tauriMode && (
            <Badge variant="secondary" className="ml-1 h-4 gap-1 px-1 text-[9px] bg-amber-500/20 text-amber-300">
              browser
            </Badge>
          )}
        </div>
      </div>

      {/* ===== Center: live system status strip ===== */}
      <div className="title-bar-no-drag mx-3 flex min-w-0 flex-1 items-center justify-center gap-3">
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

        {/* CPU */}
        <div className="hidden h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 text-xs md:flex">
          <Cpu className="size-3 text-zinc-400" />
          <span className="font-mono text-zinc-200">{system ? `${Math.round(system.cpu_percent)}%` : "--"}</span>
        </div>

        {/* RAM */}
        <div className="hidden h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 text-xs md:flex">
          <MemoryStick className="size-3 text-zinc-400" />
          <span className="font-mono text-zinc-200">{memDisplay}</span>
          {system && (
            <div className="ml-1 h-1 w-10 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-emerald-400" style={{ width: `${memPct}%` }} />
            </div>
          )}
        </div>

        {/* GPU */}
        {gpus.length > 0 && (
          <div className="hidden h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 text-xs lg:flex">
            <Activity className="size-3 text-zinc-400" />
            <span className="font-mono text-zinc-200">{gpus[0].name}</span>
          </div>
        )}

        {/* llama binary status */}
        <div className="hidden h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 text-xs lg:flex">
          <Power className={cn("size-3", llamaBinary ? "text-emerald-400" : "text-amber-400")} />
          <span className="text-[10px] text-zinc-400">
            {llamaBinary ? "llama-server ready" : "llama-server not found"}
          </span>
        </div>
      </div>

      {/* ===== Right cluster ===== */}
      <div className="title-bar-no-drag flex items-center gap-1">
        {/* Refresh */}
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-zinc-300 hover:bg-white/10 hover:text-zinc-100"
          onClick={() => refreshAll()}
          aria-label="Refresh data"
          title="Refresh models, processes & system"
        >
          <RefreshCw className="size-3.5" />
        </Button>

        {/* Notifications */}
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
                    Downloads, launches and system alerts appear here.
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

        <div className="mx-1 h-5 w-px bg-white/15" />

        {/* Window controls */}
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
