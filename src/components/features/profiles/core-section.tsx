/**
 * Core section for new profile dialog.
 */

"use client";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus } from "lucide-react";
import { useProfileValidation } from "./new-profile-validation";
import type { ProfileFormState, ProfileFormAction } from "./new-profile-form";
import { BasicSection } from "./basic-section";
import { ServerSection, PerformanceSection, SamplingSection, AdvancedSection } from "./new-profile-sections";

interface CoreSectionProps {
  f: ProfileFormState;
  dispatch: React.Dispatch<ProfileFormAction>;
  models: unknown[];
}

export function CoreSection({ f, dispatch, models }: CoreSectionProps) {
  const { errors } = useProfileValidation(f);

  return (
    <div className="grid gap-4">
      <BasicSection f={f} errors={errors} dispatch={dispatch} models={models} />

      <Separator />

      <ServerSection f={f} errors={errors} dispatch={dispatch} />

      <Separator />

      <PerformanceSection f={f} errors={errors} dispatch={dispatch} />

      <Separator />

      <SamplingSection f={f} errors={errors} dispatch={dispatch} />

      <Separator />

      <AdvancedSection f={f} errors={errors} dispatch={dispatch} />
    </div>
  );
}
