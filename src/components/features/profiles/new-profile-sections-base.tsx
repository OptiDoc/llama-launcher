/**
 * Profile section components — Section, Field, NumInput, SW.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface SectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
  open: boolean;
  onToggle: (id: string) => void;
}

export function Section({ id, title, children, open, onToggle }: SectionProps) {
  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50"
      >
        {title}
        <span className="text-muted-foreground text-xs">{open ? "^" : "–"}</span>
      </button>
      {open && <div className="border-t px-3 py-3 space-y-3">{children}</div>}
    </div>
  );
}

interface FieldProps {
  label: string;
  error?: string | (() => string);
  children: React.ReactNode;
}

export function Field({ label, error, children }: FieldProps) {
  const errorMsg = typeof error === "function" ? error() : error;
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
    </div>
  );
}

interface NumInputProps {
  value: string;
  onChange: (v: string) => void;
  error?: string | (() => string);
  placeholder?: string;
}

export function NumInput({ value, onChange, error, placeholder, ...props }: NumInputProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const errorMsg = typeof error === "function" ? error() : error;
  return (
    <Input
      type="number"
      value={value}
      placeholder={placeholder}
      onChange={(e) => { onChange(e.target.value); }}
      className={cn("h-8 text-xs", errorMsg && "border-red-500")}
      {...props}
    />
  );
}

interface SWProps {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}

export function SW({ checked, onCheckedChange }: SWProps) {
  return <Switch checked={checked} onCheckedChange={onCheckedChange} />;
}
