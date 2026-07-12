import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Deterministic 32-bit FNV-1a hash — SSR safe (no Math.random). */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h | 0);
}

export function fmtTime(ts: Date | number) {
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toTimeString().slice(0, 8);
}
