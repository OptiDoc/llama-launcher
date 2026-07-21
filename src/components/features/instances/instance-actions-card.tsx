"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TerminalSquare, Square, Play, RotateCcw, Trash2 } from "lucide-react";
import { useLlamaStore, type LlamaInstance } from "@/lib/llama-store";

function InstanceActionsCard({
  instance,
  isRunning,
  isStopped,
  onRemoveClick,
}: {
  instance: LlamaInstance;
  isRunning: boolean;
  isStopped: boolean;
  onRemoveClick: () => void;
}) {
  const stopInstance = useLlamaStore((s) => s.stopInstance);
  const startInstance = useLlamaStore((s) => s.startInstance);
  const setActiveConsole = useLlamaStore((s) => s.setActiveConsole);

  return (
    <Card className="py-0">
      <CardContent className="space-y-2 p-5">
        <h3 className="text-[13px] font-semibold text-foreground">Actions</h3>
        <Separator className="mb-1" />
        <Button className="w-full justify-start" onClick={() => setActiveConsole(instance.id)}>
          <TerminalSquare className="mr-2 size-4" />
          Open Console
        </Button>
        {isRunning ? (
          <Button
            variant="secondary"
            className="w-full justify-start bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:text-red-300"
            onClick={() => stopInstance(instance.id)}
          >
            <Square className="mr-2 size-4" />
            Stop instance
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="w-full justify-start"
            disabled={instance.status === "stopping"}
            onClick={() =>
              startInstance({
                name: instance.name,
                model: instance.model,
                profile: instance.profile,
                port: instance.port,
                host: instance.host,
                gpu: instance.gpu,
              })
            }
          >
            <Play className="mr-2 size-4" />
            Start instance
          </Button>
        )}
        <Button
          variant="outline"
          className="w-full justify-start"
          disabled={!isRunning}
          onClick={() => stopInstance(instance.id)}
        >
          <RotateCcw className="mr-2 size-4" />
          Restart
        </Button>
        <Separator className="my-1" />
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={!isStopped}
          onClick={onRemoveClick}
        >
          <Trash2 className="mr-2 size-4" />
          Remove instance
        </Button>
      </CardContent>
    </Card>
  );
}

export { InstanceActionsCard };
