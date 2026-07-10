"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard,
  Boxes,
  Cpu,
  Server,
  Rocket,
  ScrollText,
  Settings,
  TerminalSquare,
  Activity,
} from "lucide-react";
import { useLlamaStore } from "@/lib/llama-store";

export type Page =
  | "dashboard"
  | "models"
  | "profiles"
  | "instances"
  | "releases"
  | "logs"
  | "settings";

interface SidebarProps {
  collapsed: boolean;
  activePage: Page;
  onNavigate: (page: Page) => void;
  onToggle: () => void;
}

const navItems: { page: Page; label: string; icon: React.ReactNode }[] = [
  { page: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
  { page: "instances", label: "Instances", icon: <Server className="size-4" /> },
  { page: "models", label: "Models", icon: <Boxes className="size-4" /> },
  { page: "profiles", label: "Profiles", icon: <Cpu className="size-4" /> },
  { page: "releases", label: "Releases", icon: <Rocket className="size-4" /> },
  { page: "logs", label: "Logs", icon: <ScrollText className="size-4" /> },
  { page: "settings", label: "Settings", icon: <Settings className="size-4" /> },
];

export function Sidebar({ collapsed, activePage, onNavigate, onToggle }: SidebarProps) {
  const instances = useLlamaStore((s) => s.instances);
  const runningCount = instances.filter((i) => i.status === "running").length;
  const toggleConsole = useLlamaStore((s) => s.toggleConsole);
  const consoleOpen = useLlamaStore((s) => s.consoleOpen);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out",
        collapsed ? "w-[68px]" : "w-[240px]",
      )}
    >
      {/* Brand header */}
      <div className={cn("flex h-16 items-center gap-2 border-b px-4", collapsed && "justify-center px-0")}>
        <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <span className="text-sm font-bold">L</span>
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">LlamaLauncher</span>
            <span className="text-[10px] text-muted-foreground">v0.4.2 · b4402</span>
          </div>
        )}
      </div>

      {/* Running status pill */}
      {!collapsed && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg bg-accent/60 px-3 py-2 text-xs">
          <span className="relative flex size-2">
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-75",
                runningCount > 0 ? "bg-emerald-500 animate-ping" : "bg-muted-foreground/60",
              )}
            />
            <span
              className={cn(
                "relative inline-flex size-2 rounded-full",
                runningCount > 0 ? "bg-emerald-500" : "bg-muted-foreground/60",
              )}
            />
          </span>
          <span className="font-medium">
            {runningCount > 0 ? `${runningCount} running` : "Idle"}
          </span>
        </div>
      )}

      <ScrollArea className="flex-1 py-2">
        <nav className={cn("flex flex-col gap-1", collapsed ? "items-center px-2" : "px-3")}>
          {navItems.map(({ page, label, icon }) => {
            const active = activePage === page;
            return (
              <Button
                key={page}
                variant={active ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onNavigate(page)}
                className={cn(
                  "h-9 w-full justify-start gap-2.5 text-[13px] font-medium",
                  collapsed && "justify-center px-0 w-10 h-10",
                  active && "bg-primary/10 text-primary hover:bg-primary/15",
                )}
                title={collapsed ? label : undefined}
              >
                {icon}
                {!collapsed && <span>{label}</span>}
              </Button>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer actions */}
      <div className="border-t p-3">
        <div className={cn("flex flex-col gap-1", collapsed && "items-center")}>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleConsole}
            className={cn(
              "h-9 justify-start gap-2.5 text-[13px] font-medium",
              collapsed && "justify-center px-0 w-10 h-10",
              consoleOpen && "bg-primary/10 text-primary",
            )}
            title={collapsed ? "Toggle console" : undefined}
          >
            <TerminalSquare className="size-4" />
            {!collapsed && <span>Console</span>}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className={cn(
              "h-9 justify-start gap-2.5 text-[13px] font-medium text-muted-foreground",
              collapsed && "justify-center px-0 w-10 h-10",
            )}
            title={collapsed ? "Expand" : "Collapse"}
          >
            <Activity className="size-4" />
            {!collapsed && <span>Collapse</span>}
          </Button>
        </div>
      </div>
    </aside>
  );
}
