"use client";

import * as React from "react";
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
    // Fill the entire native window — no padding, no decorative frame.
    // The window is borderless (decorations: false in tauri.conf.json),
    // so the TopBar serves as the title bar.
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* Top bar: drag region + status tab + workspace + window controls */}
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
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full p-3 md:p-4 lg:p-5">
              {children}
            </div>
          </main>

          {/* Bottom collapsible console - one tab per running llama server */}
          <BottomConsole />
          <ConsoleShowPill />
        </div>
      </div>
    </div>
  );
}
