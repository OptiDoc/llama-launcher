"use client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ConnectionFieldsProps {
  port: string;
  host: string;
  gpu: string;
  gpuOptions: { value: string; label: string }[];
  errors: { port?: string; host?: string };
  onPortChange: (v: string) => void;
  onHostChange: (v: string) => void;
  onGpuChange: (v: string) => void;
  onClearError: (field: "port" | "host") => void;
}

export function ConnectionFields({
  port,
  host,
  gpu,
  gpuOptions,
  errors,
  onPortChange,
  onHostChange,
  onGpuChange,
  onClearError,
}: ConnectionFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="inst-port">Port</Label>
          <Input
            id="inst-port"
            type="number"
            value={port}
            onChange={(e) => {
              onPortChange(e.target.value);
              onClearError("port");
            }}
            className={cn("h-8", errors.port ? "border-red-500" : "")}
          />
          {errors.port && <p className="text-xs text-red-500">{errors.port}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="inst-host">Host</Label>
          <Input
            id="inst-host"
            value={host}
            onChange={(e) => {
              onHostChange(e.target.value);
              onClearError("host");
            }}
            className={cn("h-8", errors.host ? "border-red-500" : "")}
          />
          {errors.host && <p className="text-xs text-red-500">{errors.host}</p>}
        </div>
      </div>
      <div className="grid gap-2">
        <Label>GPU</Label>
        <Select value={gpu} onValueChange={onGpuChange}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {gpuOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
