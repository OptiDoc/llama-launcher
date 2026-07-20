/**
 * New profile sections — Server, Performance, Sampling, Advanced.
 */

"use client";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { ProfileFormState } from "./new-profile-form";
import { Section, Field, NumInput, SW } from "./new-profile-sections-base";

interface ServerSectionProps {
  f: ProfileFormState;
  errors: Record<string, () => string>;
  dispatch: React.Dispatch<import("./new-profile-form").ProfileFormAction>;
}

export function ServerSection({ f, errors, dispatch }: ServerSectionProps) {
  return (
    <Section id="server" title="Server" open={true} onToggle={() => {}}>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Port" error={errors.port}>
          <NumInput value={f.port} onChange={(v) => dispatch({ type: "SET_FIELD", key: "port", value: v })} error={errors.port} />
        </Field>
        <Field label="Host" error={errors.host}>
          <Input
            value={f.host}
            onChange={(e) => { dispatch({ type: "SET_FIELD", key: "host", value: e.target.value }); }}
            className={cn("h-8 text-xs", errors.host && "border-red-500")}
          />
        </Field>
        <Field label="Parallel slots" error={errors.parallel}>
          <NumInput value={f.parallel} onChange={(v) => dispatch({ type: "SET_FIELD", key: "parallel", value: v })} error={errors.parallel} placeholder="-1 = auto" />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Max predict (-1=∞)" error={errors.nPredict}>
          <NumInput value={f.nPredict} onChange={(v) => dispatch({ type: "SET_FIELD", key: "nPredict", value: v })} error={errors.nPredict} />
        </Field>
        <Field label="Timeout (sec)" error={errors.timeout}>
          <NumInput value={f.timeout} onChange={(v) => dispatch({ type: "SET_FIELD", key: "timeout", value: v })} error={errors.timeout} />
        </Field>
        <div className="grid gap-1.5">
          <Label className="text-xs">Options</Label>
          <div className="flex items-center gap-4 h-8">
            <label className="flex items-center gap-1.5 text-xs">
              <SW checked={f.contBatching} onCheckedChange={(v) => dispatch({ type: "SET_FIELD", key: "contBatching", value: v })} />
              Cont. batching
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <SW checked={f.metrics} onCheckedChange={(v) => dispatch({ type: "SET_FIELD", key: "metrics", value: v })} />
              Metrics
            </label>
          </div>
        </div>
      </div>
      <Field label="API key">
        <Input
          value={f.apiKey}
          onChange={(e) => dispatch({ type: "SET_FIELD", key: "apiKey", value: e.target.value })}
          placeholder="optional"
          className="h-8 text-xs font-mono"
        />
      </Field>
    </Section>
  );
}
