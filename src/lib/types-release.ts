/**
 * Release types — ReleaseVariant, GitHubRelease.
 */

export type ReleaseVariant = "cuda12" | "cuda13" | "vulkan" | "cpu" | "hip" | "opencl" | "metal";

export interface GitHubRelease {
  id: string;
  tag: string;
  published_at: string;
  commit: string;
  notes: string;
  installed: boolean;
  variant: string;
  priority: boolean;
  download_url: string;
  size_mb: number;
}
