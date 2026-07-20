/**
 * HF download quantization options.
 */

"use client";

import { cn } from "@/lib/utils";
import { HF_QUANTS } from "@/lib/llama-store";
import { CheckCircle2 } from "lucide-react";
import type { HFSearchResult } from "@/lib/llama-store";
import { Label } from "@/components/ui/label";

interface HFDownloadQuantProps {
  selectedRepo: HFSearchResult;
  quant: string;
  setQuant: (q: string) => void;
  availableQuants: string[];
  loadingQuants: boolean;
}

export function HFDownloadQuant({
  selectedRepo,
  quant,
  setQuant,
  availableQuants,
  loadingQuants,
}: HFDownloadQuantProps) {
  return (
    <>
      <Label className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Quantization {loadingQuants && <span className="text-muted-foreground">(loading…)</span>}
      </Label>
      <div className="space-y-1.5">
        {(availableQuants.length > 0 ? HF_QUANTS.filter((q) => availableQuants.includes(q.id)) : HF_QUANTS).map((q) => {
          const sizeGb = Math.round(selectedRepo.baseSizeGb * q.sizeFactor * 10) / 10;
          const isSel = quant === q.id;
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => setQuant(q.id)}
              className={cn(
                "flex w-full items-start gap-2 rounded-md border p-2 text-left transition-colors",
                isSel ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40",
              )}
            >
              <div className={cn(
                "mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full border",
                isSel ? "border-primary bg-primary" : "border-muted-foreground/40",
              )}>
                {isSel && <CheckCircle2 className="size-2.5 text-primary-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold">{q.label}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">~{sizeGb.toFixed(1)} GB</span>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{q.note}</p>
              </div>
            </button>
          );
        })}
        {!loadingQuants && availableQuants.length === 0 && selectedRepo && (
          <p className="text-[10px] text-muted-foreground italic">Could not verify available quants — all quantizations shown.</p>
        )}
      </div>
    </>
  );
}
