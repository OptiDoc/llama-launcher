/**
 * Instances slice — types.
 */

import type { LlamaInstance, ConsoleLine } from "@/lib/types";

export interface InstancesSlice {
  instances: LlamaInstance[];
  logs: Record<string, ConsoleLine[]>;
  activeConsoleId: string;
  consoleOpen: boolean;
  consoleHeight: number;
  _navigate: ((page: string) => void) | null;
  setNavigate: (fn: (page: string) => void) => void;
  refreshProcesses: () => Promise<void>;
  startInstance: (config: {
    name: string;
    model: string;
    profile: string;
    port: number;
    host: string;
    gpu: string;
  }) => string;
  stopInstance: (id: string) => Promise<void>;
  removeInstance: (id: string) => void;
  markRunning: (id: string) => void;
  markStopped: (id: string) => void;
  bumpStats: (id: string, prompt: number, gen: number, tps: number) => void;
  refreshConsoleLogs: (instanceId: string) => Promise<void>;
  setActiveConsole: (id: string) => void;
  toggleConsole: () => void;
  setConsoleOpen: (open: boolean) => void;
  setConsoleHeight: (h: number) => void;
  clearConsole: (id: string) => void;
  appendLog: (line: ConsoleLine) => void;
}
