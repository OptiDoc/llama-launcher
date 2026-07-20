/**
 * HF download dialog footer.
 */

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Download } from "lucide-react";

interface HFDialogFooterProps {
  selectedRepo: { baseSizeGb: number } | null;
  estimatedGb: number;
  builder: string;
  filename: string;
  canStart: boolean;
  onOpenChange: (v: boolean) => void;
  handleSubmit: () => void;
}

export function HFDialogFooter({
  selectedRepo,
  estimatedGb,
  builder,
  filename,
  canStart,
  onOpenChange,
  handleSubmit,
}: HFDialogFooterProps) {
  return (
    <div className="border-t border-border/60 px-5 py-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>Will download <span className="font-mono font-semibold text-foreground">{selectedRepo ? `~${estimatedGb.toFixed(1)} GB` : "—"}</span></span>
        {builder && <><span>·</span><span>builder <span className="font-medium text-foreground">{builder}</span></span></>}
        {filename && <><span>·</span><span className="truncate font-mono">/models/{filename}</span></>}
      </div>
      <DialogFooter className="flex-row justify-end gap-2 sm:justify-end">
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={!canStart}>
          <Download className="mr-1.5 size-3.5" /> Start download
        </Button>
      </DialogFooter>
    </div>
  );
}
