"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLlamaStore } from "@/lib/llama-store";
import type { LlamaModel } from "@/lib/llama-store";
import { AlertTriangle, CheckCircle2, Edit3, Trash2 } from "lucide-react";

export function EditModelDialog({
  model,
  open,
  onOpenChange,
  focusPath,
}: {
  model: LlamaModel | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  focusPath?: boolean;
}) {
  const updateModel = useLlamaStore((s) => s.updateModel);
  const deleteModel = useLlamaStore((s) => s.deleteModel);
  const markModelMissing = useLlamaStore((s) => s.markModelMissing);
  const locateModel = useLlamaStore((s) => s.locateModel);

  const [name, setName] = React.useState("");
  const [path, setPath] = React.useState("");
  const [builder, setBuilder] = React.useState("");
  const [quant, setQuant] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const pathRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open || !model) return;
    setName(model.name);
    setPath(model.path);
    setBuilder(model.builder ?? "");
    setQuant(model.quant);
    setDescription(model.description);
    setConfirmDelete(false);
    if (focusPath) {
      setTimeout(() => pathRef.current?.focus(), 50);
    }
  }, [open, model, focusPath]);

  if (!model) return null;

  const handleSave = () => {
    updateModel(model.id, {
      name: name.trim(),
      path: path.trim(),
      builder: builder.trim(),
      quant: quant.trim(),
      description,
    });
    if (model.missing && path.trim() !== model.path) {
      locateModel(model.id, path.trim());
    }
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="size-4 text-primary" /> Edit model
            </DialogTitle>
            <DialogDescription>Update metadata, fix a moved file path, or remove this model.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="ed-name" className="text-xs">
                Display name
              </Label>
              <Input id="ed-name" value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-path" className="text-xs">
                File path
              </Label>
              <Input
                id="ed-path"
                ref={pathRef}
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="h-8 font-mono text-xs"
              />
              {model.missing && (
                <p className="text-[11px] text-red-600 dark:text-red-400">
                  File is currently missing. Update the path to mark the model as found.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ed-builder" className="text-xs">
                  Builder
                </Label>
                <Input id="ed-builder" value={builder} onChange={(e) => setBuilder(e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ed-quant" className="text-xs">
                  Quant
                </Label>
                <Input
                  id="ed-quant"
                  value={quant}
                  onChange={(e) => setQuant(e.target.value)}
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-desc" className="text-xs">
                Description
              </Label>
              <Textarea
                id="ed-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-red-500/10 hover:text-destructive"
              onClick={() => markModelMissing(model.id, !model.missing)}
            >
              <AlertTriangle className="mr-1.5 size-3.5" />
              {model.missing ? "Mark as found" : "Mark as missing"}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                <CheckCircle2 className="mr-1.5 size-3.5" /> Save
              </Button>
            </div>
          </DialogFooter>
          <Separator />
          <Card className="flex items-center justify-between border-red-200/60 bg-red-500/5 p-3 shadow-none">
            <div>
              <p className="text-xs font-medium text-red-700 dark:text-red-400">Delete this model</p>
              <p className="text-[11px] text-muted-foreground">
                Removes it from the list. File on disk is not touched.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-1.5 size-3.5" /> Delete
            </Button>
          </Card>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{model.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the model from LlamaLauncher. The GGUF file on disk is not deleted. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteModel(model.id);
                setConfirmDelete(false);
                onOpenChange(false);
              }}
            >
              Delete model
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
