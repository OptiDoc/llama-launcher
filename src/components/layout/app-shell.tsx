"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Sidebar, type Page } from "./sidebar";
import { TopBar } from "./top-bar";
import { BottomConsole, ConsoleShowPill } from "@/components/console/bottom-console";

interface AppShellProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  children: React.ReactNode;
}

export function AppShell({ activePage, onNavigate, children }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    // Outer page: light gray backdrop so the window-frame shadow is visible
    <div className="flex h-screen w-full items-stretch justify-center bg-[oklch(0.92_0.004_250)] p-0 sm:p-3 dark:bg-[oklch(0.1_0.005_250)]">
      {/* Window frame with black border like the reference */}
      <div className="window-frame flex h-full w-full max-w-[1800px] flex-col bg-background">
        {/* Top bar: drag region + workspace dropdown + status panel + instance count */}
        <TopBar
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed((c) => !c)}
        />

        {/* Body: sidebar + main + bottom console */}
        <div className="flex min-h-0 flex-1">
          <Sidebar
            collapsed={collapsed}
            activePage={activePage}
            onNavigate={onNavigate}
          />

          <div className="relative flex min-w-0 flex-1 flex-col">
            <main className="min-h-0 flex-1 overflow-y-auto bg-pattern">
              <div className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">
                {children}
              </div>
            </main>

            {/* Bottom collapsible console - one tab per running llama server */}
            <BottomConsole />
            <ConsoleShowPill />
          </div>
        </div>
      </div>
    </div>
  );
}
