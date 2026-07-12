"use client";

import * as React from "react";
import { cn, fmtTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  TerminalSquare,
  ChevronDown,
  ChevronUp,
  X,
  Trash2,
  Circle,
  Server,
  PanelBottomClose,
} from "lucide-react";
import {
  useLlamaStore,
  SYSTEM_CONSOLE,
  type LlamaInstance,
} from "@/lib/llama-store";

function StatusDot({ status }: { status: LlamaInstance["status"] }) {
  const color =
    status === "running"
      ? "bg-emerald-500"
      : status === "starting"
        ? "bg-amber-500 animate-pulse"
        : status === "stopping"
          ? "bg-orange-500 animate-pulse"
          : status === "error"
            ? "bg-red-500"
            : "bg-muted-foreground/50";
  return <span className={cn("inline-block size-1.5 rounded-full", color)} />;
}

function LogView({ instanceId }: { instanceId: string }) {
  const logs = useLlamaStore((s) => s.logs[instanceId] ?? []);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground/70">
        Loading...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground/70">
        {instanceId === SYSTEM_CONSOLE ? "System console ready." : "No output yet. Waiting for the server to start..."}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="console-output h-full overflow-y-auto px-3 py-2"
    >
      {logs.map((l) => (
        <div key={l.id} className={cn("log-line", `log-${l.kind}`)}>
          <span className="log-time">{fmtTime(l.ts)}</span>
          <span>{l.text}</span>
        </div>
      ))}
    </div>
  );
}

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

  const tabs = [
    {
      id: SYSTEM_CONSOLE,
      label: "System",
      icon: <TerminalSquare className="size-3.5" />,
      status: undefined as undefined | LlamaInstance["status"],
      logCount: (logs[SYSTEM_CONSOLE] ?? []).length,
    },
    ...instances.map((i) => ({
      id: i.id,
      label: i.name,
      icon: <Server className="size-3.5" />,
      status: i.status,
      logCount: (logs[i.id] ?? []).length,
      instance: i,
    })),
  ];

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
        onMouseDown={onResizeStart}
        className="group flex h-1.5 cursor-row-resize items-center justify-center bg-border/60 hover:bg-primary/30 shrink-0"
      >
        <div className="h-0.5 w-10 rounded-full bg-muted-foreground/30 group-hover:bg-primary/50" />
      </div>

      {/* Tab bar / header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b bg-muted/40 px-2">
        <div className="flex h-full items-center gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const active = activeConsoleId === t.id && consoleOpen;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setActiveConsole(t.id);
                  if (!consoleOpen) setConsoleOpen(true);
                }}
                className={cn(
                  "group flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                )}
              >
                {t.status ? <StatusDot status={t.status} /> : t.icon}
                <span className="max-w-[140px] truncate">{t.label}</span>
                {t.logCount > 0 && (
                  <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                    {t.logCount}
                  </span>
                )}
                {"instance" in t && t.instance && (t.instance.status === "stopped" || t.instance.status === "error") && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeInstance(t.id);
                    }}
                    className="ml-1 grid size-4 place-items-center rounded hover:bg-destructive/15 hover:text-destructive"
                    title="Close tab"
                  >
                    <X className="size-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => clearConsole(activeConsoleId)}
            title="Clear current console"
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={toggleConsole}
            title="Collapse console"
          >
            <ChevronDown className="size-4" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden bg-[hsl(var(--background))]">
        <Tabs value={activeConsoleId} onValueChange={setActiveConsole} className="h-full">
          {tabs.map((t) => (
            <TabsContent key={t.id} value={t.id} className="m-0 h-full data-[state=inactive]:hidden">
              <LogView instanceId={t.id} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}

/** Floating "show console" pill when collapsed */
export function ConsoleShowPill() {
  const consoleOpen = useLlamaStore((s) => s.consoleOpen);
  const setConsoleOpen = useLlamaStore((s) => s.setConsoleOpen);
  if (consoleOpen) return null;
  return (
    <button
      onClick={() => setConsoleOpen(true)}
      className="absolute bottom-4 right-6 z-30 flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-xs font-medium shadow-lg hover:bg-accent transition-colors"
    >
      <PanelBottomClose className="size-3.5" />
      Show Console
    </button>
  );
}
