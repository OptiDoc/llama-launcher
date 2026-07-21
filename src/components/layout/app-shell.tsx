"use client";

import * as React from "react";
import { Sidebar, type Page } from "./sidebar";
import { TopBar } from "./top-bar";
import { BottomConsole } from "@/components/console/bottom-console";

interface AppShellProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  children: React.ReactNode;
}

export function AppShell({ activePage, onNavigate, children }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <TopBar collapsed={collapsed} onToggleSidebar={() => setCollapsed((c) => !c)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar collapsed={collapsed} activePage={activePage} onNavigate={onNavigate} />
        {/* Content area — relative container for console overlay */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-350 px-5 py-4">{children}</div>
          </main>

          {/* Console: absolute overlay, slides up from bottom */}
          <BottomConsole />
        </div>
      </div>
    </div>
  );
}
