"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Sidebar, type Page } from "./sidebar";
import { BottomConsole, ConsoleShowPill } from "@/components/console/bottom-console";

interface AppShellProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  children: React.ReactNode;
}

export function AppShell({ activePage, onNavigate, children }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div className="bg-pattern flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar
        collapsed={collapsed}
        activePage={activePage}
        onNavigate={onNavigate}
        onToggle={() => setCollapsed((c) => !c)}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>

        {/* Bottom collapsible console - one tab per running llama server */}
        <BottomConsole />
        <ConsoleShowPill />
      </div>
    </div>
  );
}
