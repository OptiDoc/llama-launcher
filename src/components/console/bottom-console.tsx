/**
 * Bottom console component.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ChevronDown,
  Trash2,
  X,
} from "lucide-react";
import {
  useLlamaStore,
  SYSTEM_CONSOLE,
} from "@/lib/llama-store";
import { StatusDot } from "./status-dot";
import { LogView } from "./log-view";
import { buildConsoleTabs } from "./console-tabs";

export function BottomConsole() {
  const consoleOpen = useLlamaStore((s) => s.consoleOpen);
  const consoleHeight = useLlamaStore((s) => s.consoleHeight);
  const setConsoleHeight = useLlamaStore((s) => s.setConsoleHeight);
  const setConsoleOpen = useLlamaStore((s) => s.setConsoleOpen);
  const toggleConsole = useLlamaStore((s) => s.toggleConsole);
  const activeConsoleId = useLlamaStore((s) => s.activeConsoleId);
  const setActiveConsole = useLlamaStore((s) => s.setActiveConsole);
  const instances = useLlamaStore((s) => s.instances);
  const logs = useLlamaStore((s) => s.logs);
  const logsAsStrings = React.useMemo(
    () => Object.fromEntries(Object.entries(logs).map(([k, v]) => [k, v.map((l) => l.text)])),
    [logs],
  );
  const clearConsole = useLlamaStore((s) => s.clearConsole);
  const removeInstance = useLlamaStore((s) => s.removeInstance);

  const resizeRef = React.useRef<{ startY: number; startH: number } | null>(null);

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startY: e.clientY, startH: consoleHeight };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = resizeRef.current.startY - ev.clientY;
      setConsoleHeight(Math.max(150, Math.min(window.innerHeight * 0.7, resizeRef.current.startH + delta)));
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const tabs = buildConsoleTabs(instances, logsAsStrings);

  React.useEffect(() => {
    if (!tabs.some((t) => t.id === activeConsoleId)) {
      setActiveConsole(SYSTEM_CONSOLE);
    }
  }, [instances.length, activeConsoleId]);

  return (
    <div
      className={cn(
        "absolute bottom-0 z-20 flex flex-col border border-border/60 bg-card text-card-foreground transition-[height,left,right] duration-200 ease-out rounded-t-xl shadow-lg",
        consoleOpen ? "" : "h-0 overflow-hidden",
      )}
      style={consoleOpen ? { height: consoleHeight, left: "12px", right: "12px" } : { left: "12px", right: "12px" }}
    >
      {/* Drag handle */}
      <div
        className="h-2 cursor-row-resize border-b border-border/60 bg-muted/30"
        onMouseDown={onResizeStart}
      />

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-1.5">
        <Tabs value={activeConsoleId} onValueChange={(v) => setActiveConsole(v)}>
          <TabsList className="h-7">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="h-6 gap-1.5 text-[11px]"
              >
                {tab.icon}
                {tab.label}
                {tab.logCount > 0 && (
                  <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                    {tab.logCount}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => clearConsole(activeConsoleId)}>
            <Trash2 className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setConsoleOpen(false)}>
            <ChevronDown className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <Tabs value={activeConsoleId} onValueChange={(v) => setActiveConsole(v)}>
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <LogView instanceId={tab.id} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
