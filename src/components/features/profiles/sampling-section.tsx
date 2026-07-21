/**
 * Sampling section.
 */

"use client";

import type { ProfileFormState } from "./new-profile-form";
import { Section, Field, NumInput } from "./new-profile-sections-base";

interface SamplingSectionProps {
  f: ProfileFormState;
  errors: Record<string, () => string>;
  dispatch: React.Dispatch<import("./new-profile-form").ProfileFormAction>;
}

export function SamplingSection({ f, errors, dispatch }: SamplingSectionProps) {
  return (
    <Section id="sampling" title="Sampling" open={true} onToggle={() => {}}>
      <div className="grid grid-cols-4 gap-3">
        <Field label="Temperature" error={errors.temperature}>
          <NumInput
            value={f.temperature}
            onChange={(v) => dispatch({ type: "SET_FIELD", key: "temperature", value: v })}
            error={errors.temperature}
          />
        </Field>
        <Field label="Top K" error={errors.topK}>
          <NumInput
            value={f.topK}
            onChange={(v) => dispatch({ type: "SET_FIELD", key: "topK", value: v })}
            error={errors.topK}
          />
        </Field>
        <Field label="Top P" error={errors.topP}>
          <NumInput
            value={f.topP}
            onChange={(v) => dispatch({ type: "SET_FIELD", key: "topP", value: v })}
            error={errors.topP}
          />
        </Field>
        <Field label="Min P" error={errors.minP}>
          <NumInput
            value={f.minP}
            onChange={(v) => dispatch({ type: "SET_FIELD", key: "minP", value: v })}
            error={errors.minP}
          />
        </Field>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <Field label="Repeat penalty" error={errors.repeatPenalty}>
          <NumInput
            value={f.repeatPenalty}
            onChange={(v) => dispatch({ type: "SET_FIELD", key: "repeatPenalty", value: v })}
            error={errors.repeatPenalty}
          />
        </Field>
        <Field label="Repeat last N" error={errors.repeatLastN}>
          <NumInput
            value={f.repeatLastN}
            onChange={(v) => dispatch({ type: "SET_FIELD", key: "repeatLastN", value: v })}
            error={errors.repeatLastN}
          />
        </Field>
        <Field label="Presence penalty" error={errors.presencePenalty}>
          <NumInput
            value={f.presencePenalty}
            onChange={(v) => dispatch({ type: "SET_FIELD", key: "presencePenalty", value: v })}
            error={errors.presencePenalty}
          />
        </Field>
        <Field label="Frequency penalty" error={errors.frequencyPenalty}>
          <NumInput
            value={f.frequencyPenalty}
            onChange={(v) => dispatch({ type: "SET_FIELD", key: "frequencyPenalty", value: v })}
            error={errors.frequencyPenalty}
          />
        </Field>
      </div>
      <Field label="Seed (-1=random)" error={errors.seed}>
        <NumInput
          value={f.seed}
          onChange={(v) => dispatch({ type: "SET_FIELD", key: "seed", value: v })}
          error={errors.seed}
        />
      </Field>
    </Section>
  );
}
