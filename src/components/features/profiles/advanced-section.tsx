/**
 * Advanced section.
 */

"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { ProfileFormState } from "./new-profile-form";
import { Section, Field, NumInput, SW } from "./new-profile-sections-base";

interface AdvancedSectionProps {
  f: ProfileFormState;
  errors: Record<string, () => string>;
  dispatch: React.Dispatch<import("./new-profile-form").ProfileFormAction>;
}

export function AdvancedSection({ f, errors, dispatch }: AdvancedSectionProps) {
  return (
    <Section id="advanced" title="Advanced" open={true} onToggle={() => {}}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="LoRA path">
          <Input
            value={f.lora}
            onChange={(e) => dispatch({ type: "SET_FIELD", key: "lora", value: e.target.value })}
            placeholder="optional"
            className="h-8 text-xs font-mono"
          />
        </Field>
        <Field label="MMProj path">
          <Input
            value={f.mmproj}
            onChange={(e) => dispatch({ type: "SET_FIELD", key: "mmproj", value: e.target.value })}
            placeholder="optional"
            className="h-8 text-xs font-mono"
          />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Reasoning format">
          <Select value={f.reasoningFormat} onValueChange={(v) => dispatch({ type: "SET_FIELD", key: "reasoningFormat", value: v })}>
            <SelectTrigger className="w-full h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["auto","none","deepseek","deepseek-legacy"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Reasoning budget (-1=∞)" error={errors.reasoningBudget}>
          <NumInput value={f.reasoningBudget} onChange={(v) => dispatch({ type: "SET_FIELD", key: "reasoningBudget", value: v })} error={errors.reasoningBudget} />
        </Field>
        <Field label="Log level (0-5)" error={errors.logLevel}>
          <NumInput value={f.logLevel} onChange={(v) => dispatch({ type: "SET_FIELD", key: "logLevel", value: v })} error={errors.logLevel} />
        </Field>
      </div>
      <Field label="Chat template">
        <Input
          value={f.chatTemplate}
          onChange={(e) => dispatch({ type: "SET_FIELD", key: "chatTemplate", value: e.target.value })}
          placeholder="e.g. chatml, llama3"
          className="h-8 text-xs font-mono"
        />
      </Field>
      <div className="grid grid-cols-4 gap-3">
        <Field label="RoPE scaling">
          <Select value={f.ropeScaling} onValueChange={(v) => dispatch({ type: "SET_FIELD", key: "ropeScaling", value: v })}>
            <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="default" /></SelectTrigger>
            <SelectContent>
              {["","none","linear","yarn"].map((t) => <SelectItem key={t} value={t}>{t || "default"}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="RoPE scale" error={errors.ropeScale}>
          <NumInput value={f.ropeScale} onChange={(v) => dispatch({ type: "SET_FIELD", key: "ropeScale", value: v })} error={errors.ropeScale} />
        </Field>
        <Field label="RoPE freq base" error={errors.ropeFreqBase}>
          <NumInput value={f.ropeFreqBase} onChange={(v) => dispatch({ type: "SET_FIELD", key: "ropeFreqBase", value: v })} error={errors.ropeFreqBase} />
        </Field>
        <Field label="RoPE freq scale" error={errors.ropeFreqScale}>
          <NumInput value={f.ropeFreqScale} onChange={(v) => dispatch({ type: "SET_FIELD", key: "ropeFreqScale", value: v })} error={errors.ropeFreqScale} />
        </Field>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Jinja templates</Label>
        <div className="flex items-center h-8">
          <SW checked={f.jinja} onCheckedChange={(v) => dispatch({ type: "SET_FIELD", key: "jinja", value: v })} />
        </div>
      </div>
      <Field label="Grammar (BNF)">
        <Input
          value={f.grammar}
          onChange={(e) => dispatch({ type: "SET_FIELD", key: "grammar", value: e.target.value })}
          placeholder="optional BNF grammar"
          className="h-8 text-xs font-mono"
        />
      </Field>
      <Field label="JSON schema">
        <Input
          value={f.jsonSchema}
          onChange={(e) => dispatch({ type: "SET_FIELD", key: "jsonSchema", value: e.target.value })}
          placeholder='{"type":"object",...}'
          className="h-8 text-xs font-mono"
        />
      </Field>
    </Section>
  );
}
