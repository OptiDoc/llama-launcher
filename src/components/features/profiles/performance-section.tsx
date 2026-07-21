/**
 * Performance section.
 */

"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProfileFormState } from "./new-profile-form";
import { Section, Field, NumInput, SW } from "./new-profile-sections-base";

interface PerformanceSectionProps {
  f: ProfileFormState;
  errors: Record<string, () => string>;
  dispatch: React.Dispatch<import("./new-profile-form").ProfileFormAction>;
}

export function PerformanceSection({ f, errors, dispatch }: PerformanceSectionProps) {
  return (
    <Section id="perf" title="Performance & Memory" open={true} onToggle={() => {}}>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Threads batch (-1=same)" error={errors.threadsBatch}>
          <NumInput
            value={f.threadsBatch}
            onChange={(v) => dispatch({ type: "SET_FIELD", key: "threadsBatch", value: v })}
            error={errors.threadsBatch}
          />
        </Field>
        <Field label="Batch size" error={errors.batchSize}>
          <NumInput
            value={f.batchSize}
            onChange={(v) => dispatch({ type: "SET_FIELD", key: "batchSize", value: v })}
            error={errors.batchSize}
          />
        </Field>
        <Field label="Ubatch size" error={errors.ubatchSize}>
          <NumInput
            value={f.ubatchSize}
            onChange={(v) => dispatch({ type: "SET_FIELD", key: "ubatchSize", value: v })}
            error={errors.ubatchSize}
          />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Cache type K">
          <Select
            value={f.cacheTypeK}
            onValueChange={(v) => dispatch({ type: "SET_FIELD", key: "cacheTypeK", value: v })}
          >
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["f32", "f16", "bf16", "q8_0", "q4_0", "q4_1", "iq4_nl", "q5_0", "q5_1"].map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Cache type V">
          <Select
            value={f.cacheTypeV}
            onValueChange={(v) => dispatch({ type: "SET_FIELD", key: "cacheTypeV", value: v })}
          >
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["f32", "f16", "bf16", "q8_0", "q4_0", "q4_1", "iq4_nl", "q5_0", "q5_1"].map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Split mode">
          <Select
            value={f.splitMode}
            onValueChange={(v) => dispatch({ type: "SET_FIELD", key: "splitMode", value: v })}
          >
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["layer", "row", "tensor", "none"].map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Tensor split" error={errors.mainGpu}>
          <Input
            value={f.tensorSplit}
            onChange={(e) => dispatch({ type: "SET_FIELD", key: "tensorSplit", value: e.target.value })}
            placeholder="e.g. 3,1"
            className="h-8 text-xs font-mono"
          />
        </Field>
        <Field label="Main GPU" error={errors.mainGpu}>
          <NumInput
            value={f.mainGpu}
            onChange={(v) => dispatch({ type: "SET_FIELD", key: "mainGpu", value: v })}
            error={errors.mainGpu}
          />
        </Field>
        <div className="grid gap-1.5">
          <Label className="text-xs">Flags</Label>
          <div className="flex flex-wrap items-center gap-3 h-8">
            {(
              [
                ["KV offload", "kvOffload"],
                ["Fit", "fit"],
                ["mmap", "mmap"],
                ["mlock", "mlock"],
                ["NUMA", "numa"],
              ] as const
            ).map(([label, key]) => (
              <label key={label} className="flex items-center gap-1.5 text-xs">
                <SW
                  checked={f[key] as boolean}
                  onCheckedChange={(v) => dispatch({ type: "SET_FIELD", key, value: v })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
