/**
 * HF download dialog state management.
 */

"use client";

import * as React from "react";
import { useLlamaStore } from "@/lib/llama-store";
import type { HFSearchResult } from "@/lib/llama-store";
import { searchHFModels } from "@/lib/catalog";
import { deriveModelName } from "./hf-derive-model-name";

export function useHFDownloadDialog() {
  const startHFDownload = useLlamaStore((s) => s.startHFDownload);

  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<HFSearchResult[]>([]);
  const [selectedRepo, setSelectedRepo] = React.useState<HFSearchResult | null>(null);
  const [quant, setQuant] = React.useState<string>("Q4_K_M");
  const [modelName, setModelName] = React.useState<string>("");
  const [searching, setSearching] = React.useState(false);
  const [availableQuants, setAvailableQuants] = React.useState<string[]>([]);
  const [loadingQuants, setLoadingQuants] = React.useState(false);
  const PAGE_SIZE = 10;
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!selectedRepo) {
      setAvailableQuants([]);
      return;
    }
    let cancelled = false;
    setLoadingQuants(true);
    (async () => {
      try {
        const resp = await fetch(`https://huggingface.co/api/models/${selectedRepo.repo}/tree/main`);
        if (!resp.ok) {
          if (!cancelled) {
            setAvailableQuants([]);
            setLoadingQuants(false);
          }
          return;
        }
        const items: Array<{ path: string; type?: string }> = await resp.json();
        const found = new Set<string>();
        for (const item of items) {
          if (item.type === "file" && item.path.endsWith(".gguf")) {
            const m = item.path.match(/\.([A-Z0-9_]+)\.gguf$/i);
            if (m) found.add(m[1].toUpperCase());
          }
          if (item.type === "directory") {
            try {
              const subResp = await fetch(
                `https://huggingface.co/api/models/${selectedRepo.repo}/tree/main/${item.path}`,
              );
              if (subResp.ok) {
                const subItems: Array<{ path: string; type?: string }> = await subResp.json();
                for (const si of subItems) {
                  if (si.type === "file" && si.path.endsWith(".gguf")) {
                    const m = si.path.match(/\.[A-Z0-9_]+[.-]/i) ?? si.path.match(/[A-Z0-9_]+[.-]/i);
                    if (m) found.add(m[1].toUpperCase());
                  }
                }
              }
            } catch {
              /* ignore subdirectory fetch errors */
            }
          }
        }
        if (!cancelled) {
          const sorted = Array.from(found).sort();
          setAvailableQuants(sorted);
          if (sorted.length > 0 && !sorted.includes(quant)) {
            const preferred = sorted.find((q) => q === "Q4_K_M") ?? sorted.find((q) => q.startsWith("Q4")) ?? sorted[0];
            setQuant(preferred);
          }
        }
      } catch {
        if (!cancelled) setAvailableQuants([]);
      } finally {
        if (!cancelled) setLoadingQuants(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedRepo?.repo]);

  const handleOpenChange = (open: boolean) => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setQuant("Q4_K_M");
    setSearching(false);
    setVisibleCount(PAGE_SIZE);
    setSelectedRepo(null);
    setModelName("");
  };

  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setVisibleCount(PAGE_SIZE);
    let cancelled = false;
    const t = setTimeout(async () => {
      const results = await searchHFModels(query);
      if (!cancelled) {
        setResults(results);
        setSearching(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!el || !sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, results.length));
        }
      },
      { root: el, threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [results.length]);

  const visibleResults = results.slice(0, visibleCount);

  const baseSizeGb = selectedRepo?.baseSizeGb ?? 0;
  const estimatedGb = Math.round(baseSizeGb * 0.6 * 10) / 10;
  const filename = selectedRepo
    ? `${(selectedRepo.repo.split("/")[1] ?? selectedRepo.repo).replace(/[-_]?[Gg][Gg][Uu][Ff]$/i, "")}.${quant}.gguf`
    : "";
  const builder = selectedRepo?.builder ?? "";
  const quantAvailable = availableQuants.length === 0 || availableQuants.includes(quant);
  const canStart = !!selectedRepo && quantAvailable && modelName.trim().length > 0;

  const handleSelectResult = (r: HFSearchResult) => {
    setSelectedRepo(r);
    setModelName(deriveModelName(r.repo));
  };

  const handleSubmit = () => {
    if (!canStart || !selectedRepo) return;
    startHFDownload({ repo: selectedRepo.repo, quant, modelName: modelName.trim(), builder });
  };

  return {
    query,
    setQuery,
    results,
    visibleResults,
    visibleCount,
    selectedRepo,
    setSelectedRepo,
    quant,
    setQuant,
    modelName,
    setModelName,
    searching,
    availableQuants,
    loadingQuants,
    scrollRef,
    sentinelRef,
    estimatedGb,
    filename,
    builder,
    canStart,
    handleOpenChange,
    handleSelectResult,
    handleSubmit,
  };
}
