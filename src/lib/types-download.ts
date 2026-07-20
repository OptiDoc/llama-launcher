/**
 * Download types — DownloadProgress.
 */

export interface DownloadProgress {
  total: number;
  downloaded: number;
  speed: number;
}

export interface HFDownload {
  id: string;
  repo: string;
  quant: string;
  modelName: string;
  builder: string;
  status: "pending" | "downloading" | "completed" | "failed";
  progress: number;
  speed: number;
  eta: string;
  startedAt: number;
  completedAt: number | null;
  filename?: string;
  sizeGb?: number;
  kind?: string;
  variant?: string;
}

export interface LlamaRelease {
  id: string;
  tag: string;
  published_at: string;
  publishedAt?: string;
  commit: string;
  notes: string;
  installed: boolean;
  variant: string;
  priority: boolean;
  download_url: string;
  size_mb: number;
  sizeMb?: number;
  installing?: boolean;
  installProgress?: number;
  workspaceId?: string;
}

export type NotificationKind = "info" | "success" | "warning" | "error" | "release" | "download" | "warn";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message?: string;
  body?: string;
  ts?: number;
  timestamp?: number;
  read: boolean;
  instanceId?: string;
  actionLabel?: string;
}
