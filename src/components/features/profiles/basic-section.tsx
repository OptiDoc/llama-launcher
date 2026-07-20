/**
 * Basic section for new profile dialog.
 */

"use client";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScopeOption } from "./profiles-badges";
import { Globe, Boxes } from "lucide-react";
import type { ProfileFormState, ProfileFormAction } from "./new-profile-form";

interface BasicSectionProps {
  f: ProfileFormState;
  errors: Record<string, () => string>;
  dispatch: React.Dispatch<ProfileFormAction>;
  models: unknown[];
}

export function BasicSection({ f, errors, dispatch, models }: BasicSectionProps) {
  return (
    <div className="grid gap-2">
      <div className="grid gap-1.5">
        <Label htmlFor="prof-name">Name</Label>
        <Input
          id="prof-name"
          placeholder="e.g. Balanced"
          value={f.name}
          onChange={(e) => {
            dispatch({ type: "SET_FIELD", key: "name", value: e.target.value });
          }}
          className={cn("h-8 text-xs", errors.name() && "border-red-500")}
        />
        {errors.name() && <p className="text-xs text-red-500">{errors.name()}</p>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="prof-desc">Description</Label>
        <Input
          id="prof-desc"
          placeholder="Short note"
          value={f.description}
          onChange={(e) => dispatch({ type: "SET_FIELD", key: "description", value: e.target.value })}
          className="h-8 text-xs"
        />
      </div>
      <div className="grid gap-1.5">
        <Label>Scope</Label>
        <div className="grid grid-cols-2 gap-2">
          <ScopeOption
            active={f.scope === "global"}
            onClick={() => dispatch({ type: "SET_FIELD", key: "scope", value: "global" })}
            icon={<Globe className="size-3.5 text-sky-500" />}
            label="Global"
            desc="All models"
          />
          <ScopeOption
            active={f.scope === "model"}
            onClick={() => dispatch({ type: "SET_FIELD", key: "scope", value: "model" })}
            icon={<Boxes className="size-3.5 text-violet-500" />}
            label="Model-bound"
            desc="One model"
          />
        </div>
      </div>
      {f.scope === "model" && (
        <div className="grid gap-1.5">
          <Label>Bound model</Label>
          <Select value={f.modelId} onValueChange={(v) => dispatch({ type: "SET_FIELD", key: "modelId", value: v })}>
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {models.map((m: any) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
