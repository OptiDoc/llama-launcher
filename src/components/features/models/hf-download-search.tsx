/**
 * HF download search results.
 */

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Search } from "lucide-react";
import { fmtNum } from "@/lib/llama-store";
import type { HFSearchResult } from "@/lib/llama-store";

interface HFSearchResultsProps {
  results: HFSearchResult[];
  visibleResults: HFSearchResult[];
  visibleCount: number;
  selectedRepo: HFSearchResult | null;
  searching: boolean;
  query: string;
  onSearch: (q: string) => void;
  onSelect: (r: HFSearchResult) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}

export function HFSearchResults({
  results,
  visibleResults,
  visibleCount,
  selectedRepo,
  searching,
  query,
  onSearch,
  onSelect,
  scrollRef,
  sentinelRef,
}: HFSearchResultsProps) {
  return (
    <div className="flex min-h-0 flex-col border-b border-border/60 md:border-b-0 md:border-r">
      <div className="border-b border-border/60 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search models on HuggingFace…"
            className="h-8 w-full rounded-md border border-input bg-transparent px-8 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searching && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">⟳</span>}
        </div>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {results.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <Search className="size-6 text-muted-foreground/50" />
            <p className="text-[11px] text-muted-foreground">
              {query.trim() ? "No models match your search." : "Type to search GGUF repos from any builder."}
            </p>
          </div>
        ) : (
          <>
          <ul className="divide-y divide-border/40">
            {visibleResults.map((r) => {
              const isSel = selectedRepo?.repo === r.repo;
              return (
                <li key={r.repo}>
                  <button
                    type="button"
                    onClick={() => onSelect(r)}
                    className={cn(
                      "flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors",
                      isSel ? "bg-primary/5" : "hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-[11px] font-medium">{r.repo}</span>
                      {isSel && <CheckCircle2 className="size-3.5 shrink-0 text-primary" />}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">{r.description}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-semibold">{r.builder}</Badge>
                      <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-semibold">{r.parameterCount}</Badge>
                      <span className="text-[10px] text-muted-foreground">{fmtNum(r.downloads)} downloads</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          {visibleCount < results.length && (
            <div ref={sentinelRef} className="flex justify-center py-3 text-[10px] text-muted-foreground">
              Showing {visibleCount} of {results.length} — scroll for more
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}
