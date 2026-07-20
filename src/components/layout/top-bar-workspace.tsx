/**
 * Top bar workspace dropdown.
 */

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import { workspaceColorDot } from "./top-bar-types";
import type { Workspace } from "@/lib/llama-store";

interface TopBarWorkspaceProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  setActiveWorkspace: (id: string) => void;
  addWorkspace: (w: { name: string; description: string; color: Workspace["color"] }) => string;
}

export function TopBarWorkspace({ workspaces, activeWorkspaceId, setActiveWorkspace, addWorkspace }: TopBarWorkspaceProps) {
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0] ?? null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium text-foreground/80 hover:bg-accent transition-colors">
            {activeWorkspace && (
              <span className="grid size-4.5 place-items-center rounded-md border">
                <span className={cn("size-1.5 rounded-sm", workspaceColorDot(activeWorkspace.color))} />
              </span>
            )}
            <span className="max-w-25 truncate">{activeWorkspace?.name ?? "Workspace"}</span>
            <ChevronDown className="size-3 opacity-40" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Workspaces</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {workspaces.map((w) => (
            <DropdownMenuItem key={w.id} onClick={() => setActiveWorkspace(w.id)} className="gap-2 py-1.5">
              <span className="grid size-4.5 place-items-center border rounded-md">
                <span className={cn("size-1.5 rounded-sm", workspaceColorDot(w.color))} />
              </span>
              <div className="flex flex-1 flex-col">
                <span className="text-[12px] font-medium">{w.name}</span>
                {w.description && <span className="text-[10px] text-muted-foreground">{w.description}</span>}
              </div>
              {w.id === activeWorkspaceId && <span className="text-[9px] font-medium text-primary">active</span>}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => addWorkspace({ name: `Workspace ${workspaces.length + 1}`, color: "orange", description: "New workspace" })} className="gap-2 py-1.5 text-[11px]">
            <Plus className="size-3" /> New workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChevronRight className="size-3 text-muted-foreground/40" />
    </>
  );
}
