/**
 * HF download model info card.
 */

"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtNum } from "@/lib/llama-store";
import type { HFSearchResult } from "@/lib/llama-store";

interface HFDownloadInfoProps {
  selectedRepo: HFSearchResult;
}

export function HFDownloadInfo({ selectedRepo }: HFDownloadInfoProps) {
  return (
    <Card className="mb-3 gap-1.5 bg-muted/30 p-2.5 shadow-none">
      <p className="truncate font-mono text-[11px] font-semibold">{selectedRepo.repo}</p>
      <p className="text-[11px] text-muted-foreground">{selectedRepo.description}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-semibold">{selectedRepo.builder}</Badge>
        <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-semibold">{selectedRepo.parameterCount}</Badge>
        <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-semibold">{selectedRepo.license}</Badge>
        <span className="text-[10px] text-muted-foreground">{fmtNum(selectedRepo.downloads)} dl</span>
      </div>
    </Card>
  );
}
