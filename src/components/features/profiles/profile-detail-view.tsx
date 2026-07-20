/**
 * Profile detail view component.
 */

"use client";

import * as React from "react";
import { useLlamaStore, type LlamaProfile } from "@/lib/llama-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Pencil, Files, Share2, Wand2, Trash2, Copy, Check,
  Gauge, Zap, Layers, Flashlight, Terminal, Activity,
} from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { ProfileDetailHeader } from "./profile-detail-header";
import { ProfileDetailParams } from "./profile-detail-params";

function deriveCalibration(id: string) {
  const score = useLlamaStore.getState().profiles.find((p) => p.id === id)?.calibrationScore ?? 0;
  const dims = ["speed", "memory", "quality", "stability", "throughput"] as const;
  return dims.map((dim) => ({ dim, value: score }));
}

export function ProfileDetailView({ profile, onBack }: {
  profile: LlamaProfile; onBack: () => void;
}) {
  const shareProfile = useLlamaStore((s) => s.shareProfile);
  const calibrateProfile = useLlamaStore((s) => s.calibrateProfile);
  const removeProfile = useLlamaStore((s) => s.removeProfile);
  const [calibrating, setCalibrating] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const radarData = React.useMemo(() => deriveCalibration(profile.id), [profile.id]);
  const usageCount = React.useMemo(
    () => useLlamaStore.getState().instances.filter((i) => i.profile === profile.name).length,
    [profile.name],
  );
  const hasCalib = typeof profile.calibrationScore === "number";
  const calibScore = hasCalib ? profile.calibrationScore! : 0;

  const onCalibrate = () => {
    setCalibrating(true);
    setTimeout(() => { calibrateProfile(profile.id); setCalibrating(false); }, 1400);
  };
  const onShare = () => { if (!profile.shared) shareProfile(profile.id); };
  const onCopy = () => {
    if (profile.shareId) {
      try { navigator.clipboard?.writeText(profile.shareId); } catch { /* clipboard unavailable */ }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const onDelete = () => { removeProfile(profile.id); onBack(); };

  return (
    <div className="space-y-5">
      <ProfileDetailHeader profile={profile} onBack={onBack} />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <ProfileDetailParams profile={profile} />

          <Card className="shadow-none">
            <CardContent className="p-5">
              <h3 className="mb-3 text-sm font-semibold">Calibration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Button size="sm" onClick={onCalibrate} disabled={calibrating}>
                    <Wand2 className="mr-1.5 size-3.5" /> {calibrating ? "Calibrating…" : "Calibrate"}
                  </Button>
                  <Progress value={hasCalib ? calibScore * 100 : 0} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {hasCalib ? `Score: ${Math.round(calibScore * 100)}%` : "Not calibrated yet"}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">Usage count: {usageCount}</p>
                  <p className="text-xs text-muted-foreground">Created: {new Date(profile.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardContent className="p-5">
              <h3 className="mb-3 text-sm font-semibold">Actions</h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline">
                  <Pencil className="mr-1.5 size-3.5" /> Edit
                </Button>
                <Button size="sm" variant="outline">
                  <Files className="mr-1.5 size-3.5" /> Clone
                </Button>
                <Button size="sm" variant="outline" onClick={onShare}>
                  <Share2 className="mr-1.5 size-3.5" /> Share
                </Button>
                <Button size="sm" variant="outline" onClick={onCopy}>
                  {copied ? <Check className="mr-1.5 size-3.5" /> : <Copy className="mr-1.5 size-3.5" />}
                  {copied ? "Copied" : "Copy ID"}
                </Button>
                <Button size="sm" variant="destructive" onClick={onDelete}>
                  <Trash2 className="mr-1.5 size-3.5" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="shadow-none">
            <CardContent className="p-5">
              <h3 className="mb-3 text-sm font-semibold">Radar</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 1]} />
                    <Radar dataKey="value" fill="hsl(var(--primary))" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
