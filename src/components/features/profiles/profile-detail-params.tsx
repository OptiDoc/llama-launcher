/**
 * Profile detail view — parameters section.
 */

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { DetailCard } from "./profiles-badges";
import type { LlamaProfile } from "@/lib/llama-store";
import { Gauge, Zap, Layers, Flashlight, Terminal, Activity } from "lucide-react";

function ParamTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

export function ProfileDetailParams({ profile }: { profile: LlamaProfile }) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Parameters</h3>
        <div className="grid grid-cols-2 gap-4">
          <ParamTile label="Port" value={String(profile.port)} />
          <ParamTile label="Host" value={profile.host} />
          <ParamTile label="Threads" value={String(profile.threadsBatch)} />
          <ParamTile label="Batch" value={String(profile.batchSize)} />
          <ParamTile label="Temperature" value={String(profile.temperature)} />
          <ParamTile label="Top K" value={String(profile.topK)} />
          <ParamTile label="Top P" value={String(profile.topP)} />
          <ParamTile label="Repeat Penalty" value={String(profile.repeatPenalty)} />
          <ParamTile label="Context" value={`${profile.contextSize} tokens`} />
          <ParamTile label="Max Predict" value={profile.nPredict === "-1" ? "∞" : String(profile.nPredict)} />
          <ParamTile label="Split Mode" value={profile.splitMode} />
          <ParamTile label="KV Offload" value={profile.kvOffload ? "Yes" : "No"} />
        </div>
      </CardContent>
    </Card>
  );
}
