"use client";
import { AlertCircle, AlertTriangle } from "lucide-react";
import type { LlamaModel } from "@/lib/types-model";
import type { SystemCapabilities } from "@/lib/types-system";

interface LaunchWarningsProps {
  selectedModel: LlamaModel | undefined;
  selectedModelMissing: boolean;
  overVram: boolean;
  overRam: boolean;
  systemCapabilities: SystemCapabilities;
}

export function LaunchWarnings({
  selectedModel,
  selectedModelMissing,
  overVram,
  overRam,
  systemCapabilities,
}: LaunchWarningsProps) {
  return (
    <>
      {selectedModelMissing && (
        <div className="flex items-start gap-2 rounded-lg border border-red-300/60 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            The selected model file is missing on disk. Restore the file or
            select another model before launching.
          </span>
        </div>
      )}
      {!selectedModelMissing && overRam && selectedModel && (
        <div className="flex items-start gap-2 rounded-lg border border-red-300/60 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            {"\u2717"} This model ({selectedModel.sizeGb} GB) exceeds total
            system RAM ({systemCapabilities.ram_gb} GB). It cannot be loaded.
          </span>
        </div>
      )}
      {!selectedModelMissing && !overRam && overVram && selectedModel && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {"\u26a0"} This model ({selectedModel.sizeGb} GB) is larger than
            your GPU VRAM ({systemCapabilities.gpu_vram_gb} GB). llama-server
            will offload some layers to CPU, which will be slower.
          </span>
        </div>
      )}
    </>
  );
}
