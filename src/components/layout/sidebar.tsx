"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Boxes,
  Cpu,
  Server,
  Rocket,
  ScrollText,
  Settings,
  TerminalSquare,
  Download,
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

export function Sidebar({ collapsed, activePage, onNavigate }: SidebarProps) {
  const downloads = useLlamaStore((s) => s.downloads);
  const activeDownloads = downloads.filter((d) => d.status === "downloading").length;
  const toggleConsole = useLlamaStore((s) => s.toggleConsole);
  const consoleOpen = useLlamaStore((s) => s.consoleOpen);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out",
        collapsed ? "w-[60px]" : "w-[232px]",
      )}
    >
      <ScrollArea className="flex-1 py-3">
        <nav className={cn("flex flex-col gap-0.5", collapsed ? "items-center px-2" : "px-3")}>
          {navItems.map(({ page, label, icon }) => {
            const active = activePage === page;
            return (
              <Button
                key={page}
                variant={active ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onNavigate(page)}
                className={cn(
                  "h-8 w-full justify-start gap-2.5 text-[13px] font-medium",
                  collapsed && "justify-center px-0 w-9 h-9",
                  active
                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title={collapsed ? label : undefined}
              >
                {icon}
                {!collapsed && (
                  <span className="flex-1 text-left">{label}</span>
                )}
                {!collapsed && activeDownloads > 0 && page === "models" && (
                  <Badge variant="secondary" className="h-4 gap-0.5 px-1 text-[10px]">
                    <Download className="size-2.5 animate-pulse" />
                    {activeDownloads}
                  </Badge>
                )}
              </Button>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer: console toggle */}
      <div className="border-t border-border p-3">
        <div className={cn("flex flex-col gap-0.5", collapsed && "items-center")}>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleConsole}
            className={cn(
              "h-8 justify-start gap-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground",
              collapsed && "justify-center px-0 w-9 h-9",
              consoleOpen && "bg-primary/10 text-primary",
            )}
            title={collapsed ? "Toggle console" : undefined}
          >
            <TerminalSquare className="size-4" />
            {!collapsed && <span>Console</span>}
          </Button>
        </div>
      </div>
    </aside>
  );
}
