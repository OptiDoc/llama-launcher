/**
 * Top bar window controls (minimize, maximize, close).
 */

import { cn } from "@/lib/utils";
import { log } from "@/lib/logger";
import { isTauri } from "@/lib/tauri-api";
import { Minus, Square, X } from "lucide-react";
import React from "react";

interface TopBarWindowControlsProps {
  maximized: boolean;
  onToggleMaximize: () => void;
}

export function TopBarWindowControls({ maximized, onToggleMaximize }: TopBarWindowControlsProps) {
  const minimize = React.useCallback(async () => {
    if (!isTauri()) { return; }
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch (e) { log.error("[TopBar] minimize failed", { category: "ui", context: { error: e instanceof Error ? e.message : String(e) } }); }
  }, []);

  const close = React.useCallback(async () => {
    if (!isTauri()) { return; }
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch (e) { log.error("[TopBar] close failed", { category: "ui", context: { error: e instanceof Error ? e.message : String(e) } }); }
  }, []);

  return (
    <div className="flex items-center">
      <button onClick={minimize} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" aria-label="Minimize">
        <Minus className="size-3.5" />
      </button>
      <button onClick={onToggleMaximize} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" aria-label={maximized ? "Restore" : "Maximize"}>
        {maximized ? (
          <svg className="size-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="2" y="3.5" width="6.5" height="6.5" rx="0.5" /><path d="M4 3.5V2h6v6H8.5" /></svg>
        ) : (
          <Square className="size-2.5" />
        )}
      </button>
      <button onClick={close} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-red-500 hover:text-white transition-colors" aria-label="Close">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
