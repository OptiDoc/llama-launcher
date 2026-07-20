/**
 * New profile dialog logic.
 */

"use client";

import * as React from "react";
import { useLlamaStore, type LlamaProfile } from "@/lib/llama-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import {
  defaultFormState,
  profileFormReducer,
  type ProfileFormState,
  type ProfileFormAction,
} from "./new-profile-form";
import { CoreSection } from "./core-section";

export function NewProfileDialog() {
  const models = useLlamaStore((s) => s.models);
  const addProfile = useLlamaStore((s) => s.addProfile);
  const [open, setOpen] = React.useState(false);
  const [f, dispatch] = React.useReducer(profileFormReducer, defaultFormState);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addProfile({
      ...f,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as Omit<LlamaProfile, "id">);
    dispatch({ type: "RESET" });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-1.5 size-3.5" /> New Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Plus className="size-4 text-primary" /> New Profile
          </DialogTitle>
          <DialogDescription className="text-xs">
            Create a new inference profile with server, performance, sampling, and advanced settings.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
          <form onSubmit={handleSubmit} className="grid gap-4">
            <CoreSection f={f} dispatch={dispatch} models={models} />
            <DialogFooter className="flex-row justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Create Profile
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
