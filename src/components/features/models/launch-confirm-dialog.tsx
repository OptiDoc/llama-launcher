"use client";

import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtBytes, fmtNum } from "@/lib/llama-store";
import type { LlamaModel } from "@/lib/llama-store";
import { CheckCircle2, Play } from "lucide-react";

export function LaunchConfirmDialog({ model, open, onOpenChange }: {
  model: LlamaModel | null; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  if (!model) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="size-4 text-primary" /> Launch instance
          </DialogTitle>
          <DialogDescription>
            Start a new llama-server instance using <span className="font-medium text-foreground">{model.name}</span>.
          </DialogDescription>
        </DialogHeader>
        <Card className="gap-2 bg-muted/40 p-3 shadow-none text-xs">
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Model</span><span className="font-medium">{model.name}</span></div>
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Quant</span><span className="font-mono">{model.quant}</span></div>
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Size</span><span className="font-mono">{fmtBytes(model.sizeGb)}</span></div>
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Context length</span><span className="font-mono">{fmtNum(model.contextLength)}</span></div>
        </Card>
        <p className="text-[11px] text-muted-foreground">
          Switch to the Instances page and click <span className="font-medium">Launch instance</span> to start serving this model.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onOpenChange(false)}><CheckCircle2 className="mr-1.5 size-3.5" /> Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
