/**
 * Log view component.
 */

import * as React from "react";
import { cn, fmtTime } from "@/lib/utils";
import { useLlamaStore, SYSTEM_CONSOLE } from "@/lib/llama-store";

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
    return <div className="flex h-full items-center justify-center text-xs text-muted-foreground/70">Loading...</div>;
  }

  if (logs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground/70">
        {instanceId === SYSTEM_CONSOLE ? "System console ready." : "No output yet. Waiting for the server to start..."}
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="console-output h-full overflow-y-auto px-3 py-2">
      {logs.map((l) => (
        <div key={l.id} className={cn("log-line", `log-${l.kind}`)}>
          <span className="log-time">{fmtTime(l.ts)}</span>
          <span>{l.text}</span>
        </div>
      ))}
    </div>
  );
}

export { LogView };
