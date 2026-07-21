"use client";

import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useLlamaStore } from "@/lib/llama-store";
import { Copy, FileText, Loader2, Move } from "lucide-react";

export interface LocalModelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFiles: string[];
  onImport: () => void;
  moveMode: boolean;
  onMoveModeChange: (move: boolean) => void;
  status: "idle" | "selecting" | "importing" | "done";
}

export function LocalModelImportDialog({
  open,
  onOpenChange,
  selectedFiles,
  onImport,
  moveMode,
  onMoveModeChange,
  status,
}: LocalModelImportDialogProps) {
  const modelsDir = useLlamaStore((s) => s.globalSettings.modelsDir);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Import Local Models</span>
            <Badge variant="outline" className="text-[10px]">{selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected</Badge>
          </DialogTitle>
          <DialogDescription>
            Select models to import from your filesystem.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2">
              {moveMode ? <Move className="size-4" /> : <Copy className="size-4" />}
              <Label className="text-sm font-medium cursor-pointer">
                {moveMode ? 'Move files' : 'Copy files'}
              </Label>
            </div>
            <Switch
              checked={moveMode}
              onCheckedChange={onMoveModeChange}
              aria-label={moveMode ? "Move files (remove from source)" : "Copy files (keep in source)"}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {moveMode
              ? "Files will be moved from their current location to the models directory."
              : "Files will be copied to the models directory, originals will be kept."
            }
          </p>

          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">Destination:</p>
            <p className="text-sm font-mono truncate">{modelsDir}</p>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1 border border-border/60 rounded-lg p-2">
            {selectedFiles.map((filePath, index) => {
              const filename = filePath.split(/[\\/]/).pop() || filePath;
              return (
                <label
                  key={`${filePath}-${index}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked
                    disabled
                    className="size-4"
                  />
                  <FileText className="size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono truncate">{filename}</p>
                    <p className="text-[10px] text-muted-foreground">{filePath}</p>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={status === "importing"}>
            Cancel
          </Button>
          <Button
            onClick={onImport}
            disabled={status === "importing" || selectedFiles.length === 0}
          >
            {status === "importing" && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            {status === "importing"
              ? "Importing..."
              : `Import ${selectedFiles.length} Model${selectedFiles.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
