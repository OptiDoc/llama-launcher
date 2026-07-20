"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
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
  BookOpen,
  HelpCircle,
} from "lucide-react";
import { useLlamaStore } from "@/lib/llama-store";

export type Page = "dashboard" | "models" | "profiles" | "instances" | "releases" | "logs" | "settings";

interface SidebarProps {
  collapsed: boolean;
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const navGroups: { label?: string; items: { page: Page; label: string; icon: React.ReactNode }[] }[] = [
  {
    items: [
      { page: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="size-[18px] shrink-0" /> },
      { page: "instances", label: "Instances", icon: <Server className="size-[18px] shrink-0" /> },
    ],
  },
  {
    label: "MODELS",
    items: [
      { page: "models", label: "Models", icon: <Boxes className="size-[18px] shrink-0" /> },
      { page: "profiles", label: "Profiles", icon: <Cpu className="size-[18px] shrink-0" /> },
      { page: "releases", label: "Releases", icon: <Rocket className="size-[18px] shrink-0" /> },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { page: "logs", label: "Logs", icon: <ScrollText className="size-[18px] shrink-0" /> },
      { page: "settings", label: "Settings", icon: <Settings className="size-[18px] shrink-0" /> },
    ],
  },
];

export function Sidebar({ collapsed, activePage, onNavigate }: SidebarProps) {
  const downloads = useLlamaStore((s) => s.downloads);
  const activeDownloads = downloads.filter((d) => d.status === "downloading").length;
  const toggleConsole = useLlamaStore((s) => s.toggleConsole);
  const consoleOpen = useLlamaStore((s) => s.consoleOpen);

  return (
    <div className="shrink-0 p-2 pl-2 pr-0">
      <aside
        className={cn(
          "flex h-[calc(100vh-56px-16px)] flex-col overflow-hidden transition-[width] duration-200 ease-out",
          collapsed ? "w-[60px]" : "w-[232px]",
        )}
      >
        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 pt-1">
          {navGroups.map((group, gi) => (
            <div key={gi} className={cn(gi > 0 && "mt-4")}>
              {group.label && (
                <div
                  className={cn(
                    "mb-1.5 px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/40 overflow-hidden whitespace-nowrap transition-opacity duration-200",
                    collapsed ? "opacity-0 h-0 mb-0 pb-0" : "opacity-100",
                  )}
                >
                  {group.label}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map(({ page, label, icon }) => {
                  const active = activePage === page;
                  return (
                    <button
                      key={page}
                      onClick={() => onNavigate(page)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-9 items-center gap-2.5 rounded-lg pl-2.5 text-[14px] font-medium transition-all duration-150",
                        collapsed ? "w-9 pr-0" : "w-full pr-2.5",
                        active
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-card/50 hover:text-foreground",
                      )}
                      title={collapsed ? label : undefined}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
                      )}
                      <span
                        className={cn(
                          "shrink-0 transition-colors",
                          active ? "text-foreground" : "text-muted-foreground/70",
                        )}
                      >
                        {icon}
                      </span>
                      <span
                        className={cn(
                          "flex-1 text-left overflow-hidden whitespace-nowrap transition-all duration-200",
                          collapsed ? "w-0 opacity-0 ml-0" : "opacity-100",
                        )}
                      >
                        {label}
                      </span>
                      {!collapsed && activeDownloads > 0 && page === "models" && (
                        <Badge variant="secondary" className="h-4 gap-0.5 px-1 text-[9px] font-medium shrink-0">
                          <Download className="size-2.5 animate-pulse" />
                          {activeDownloads}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-2">
          <div className="flex flex-col gap-0.5">
            <button
              onClick={toggleConsole}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-lg pl-2.5 text-[14px] font-medium transition-colors",
                collapsed ? "w-9 pr-0" : "w-full pr-2.5",
                consoleOpen
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-card/50 hover:text-foreground",
              )}
              title={collapsed ? "Toggle console" : undefined}
            >
              <TerminalSquare className="size-[18px] shrink-0" />
              <span
                className={cn(
                  "overflow-hidden whitespace-nowrap transition-all duration-200",
                  collapsed ? "w-0 opacity-0" : "opacity-100",
                )}
              >
                Console
              </span>
            </button>
            <button
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-lg pl-2.5 text-[14px] font-medium text-muted-foreground/70 transition-colors hover:bg-card/50 hover:text-foreground",
                collapsed ? "w-9 pr-0" : "w-full pr-2.5",
              )}
            >
              <BookOpen className="size-[18px] shrink-0" />
              <span
                className={cn(
                  "overflow-hidden whitespace-nowrap transition-all duration-200",
                  collapsed ? "w-0 opacity-0" : "opacity-100",
                )}
              >
                Docs
              </span>
            </button>
            <button
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-lg pl-2.5 text-[14px] font-medium text-muted-foreground/70 transition-colors hover:bg-card/50 hover:text-foreground",
                collapsed ? "w-9 pr-0" : "w-full pr-2.5",
              )}
            >
              <HelpCircle className="size-[18px] shrink-0" />
              <span
                className={cn(
                  "overflow-hidden whitespace-nowrap transition-all duration-200",
                  collapsed ? "w-0 opacity-0" : "opacity-100",
                )}
              >
                Support
              </span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
