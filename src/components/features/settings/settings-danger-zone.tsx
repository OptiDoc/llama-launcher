"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Trash2 } from "lucide-react";

export function DangerZoneCard({
  workspaceName, isLastWorkspace, instanceCount, modelCount, onDelete,
}: {
  workspaceName: string; isLastWorkspace: boolean; instanceCount: number; modelCount: number; onDelete: () => void;
}) {
  return (
    <Card className="p-4 border-red-200/70 dark:border-red-900/40">
      <CardHeader className="p-0 mb-3">
        <CardTitle className="flex items-center gap-2 text-[13px] text-red-600 dark:text-red-400">
          <AlertTriangle className="size-4" />Danger zone
        </CardTitle>
        <CardDescription>Irreversible actions affecting this workspace.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium">Delete this workspace</div>
            <p className="text-xs text-muted-foreground">
              Removes the workspace and all of its instances and models. This cannot be undone.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isLastWorkspace}
                title={isLastWorkspace ? "You must keep at least one workspace." : undefined}>
                <Trash2 className="mr-1.5 size-3.5" />Delete workspace
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete &quot;{workspaceName}&quot;?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove the workspace along with {instanceCount} instance{instanceCount === 1 ? "" : "s"} and {modelCount} model{modelCount === 1 ? "" : "s"}. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                  onClick={onDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
