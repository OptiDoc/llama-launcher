"use client";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModelSelectProps {
  downloaded: { id: string; name: string }[];
  modelId: string;
  onModelChange: (id: string) => void;
  profileOptions: { id: string; name: string }[];
  profileId: string;
  onProfileChange: (id: string) => void;
}

export function ModelSelect({
  downloaded,
  modelId,
  onModelChange,
  profileOptions,
  profileId,
  onProfileChange,
}: ModelSelectProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="grid gap-2">
        <Label>Model</Label>
        <Select value={modelId} onValueChange={onModelChange}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {downloaded.length === 0 ? (
              <SelectItem value="__none" disabled>
                No models available
              </SelectItem>
            ) : (
              downloaded.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>Profile</Label>
        <Select value={profileId} onValueChange={onProfileChange}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue placeholder="Select profile" />
          </SelectTrigger>
          <SelectContent>
            {profileOptions.length === 0 ? (
              <SelectItem value="__none" disabled>
                No profiles available
              </SelectItem>
            ) : (
              profileOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
