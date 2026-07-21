"use client";

import { Badge } from "@/components/ui/badge";
import { Loader2, XCircle, CheckCircle2, AlertCircle } from "lucide-react";
import type { LlamaModel } from "@/lib/llama-store";

export function StatusBadge({ model }: { model: LlamaModel }) {
  if (model.downloading === true) {
    const progress = Math.round(model.downloadProgress ?? 0);
    return (
      <Badge
        variant="secondary"
        className="gap-1 bg-amber-500/15 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300"
      >
        <Loader2 className="size-3 animate-spin" /> {progress}%
      </Badge>
    );
  }
  if (model.missing) {
    return (
      <Badge
        variant="secondary"
        className="gap-1 bg-red-500/15 text-[10px] font-semibold uppercase text-red-700 dark:text-red-300"
      >
        <XCircle className="size-3" /> Not found
      </Badge>
    );
  }
  if (model.downloaded) {
    return (
      <Badge
        variant="secondary"
        className="gap-1 bg-emerald-500/15 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300"
      >
        <CheckCircle2 className="size-3" /> Ready
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="gap-1 bg-amber-500/15 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300"
    >
      <AlertCircle className="size-3" /> Missing
    </Badge>
  );
}
