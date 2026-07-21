/**
 * Utility helpers — uid, nowTs, uptimeString, pickPort, fmtNum, fmtBytes.
 */

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function nowTs() {
  return Date.now();
}

export function uptimeString(startedAt?: number) {
  if (!startedAt) return "--";
  const sec = Math.floor((Date.now() - startedAt) / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function pickPort() {
  return 8080 + Math.floor(Math.random() * 20);
}

export function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function fmtBytes(gb: number) {
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(gb * 1024).toFixed(0)} MB`;
}
