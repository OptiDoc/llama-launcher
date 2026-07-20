/**
 * Bottom console — tab definitions.
 */

"use client";

import {
  TerminalSquare,
  Server,
} from "lucide-react";
import type { LlamaInstance } from "@/lib/llama-store";
import { SYSTEM_CONSOLE } from "@/lib/llama-store";

interface ConsoleTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  status?: LlamaInstance["status"];
  logCount: number;
  instance?: LlamaInstance;
}

export function buildConsoleTabs(
  instances: LlamaInstance[],
  logs: Record<string, string[]>,
): ConsoleTab[] {
  return [
    {
      id: SYSTEM_CONSOLE,
      label: "System",
      icon: <TerminalSquare className="size-3.5" />,
      status: undefined,
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
}
