"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Server, Plus } from "lucide-react";

function EmptyState({ onLaunch }: { onLaunch: () => void }) {
  return (
    <Card className="border-2 border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-muted">
          <Server className="size-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">No instances yet</p>
          <p className="text-xs text-muted-foreground">
            Launch your first llama-server to get started.
          </p>
        </div>
        <Button size="sm" className="mt-1" onClick={onLaunch}>
          <Plus className="mr-1.5 size-3.5" />
          Launch Instance
        </Button>
      </CardContent>
    </Card>
  );
}

export { EmptyState };
