"use client";
import type { SystemCapabilities } from "@/lib/types";

export function buildGpuOptions(
  systemCapabilities: SystemCapabilities,
): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  if (
    systemCapabilities.gpu_name &&
    systemCapabilities.gpu_name !== "CPU only"
  ) {
    opts.push({
      value: systemCapabilities.gpu_name,
      label: systemCapabilities.gpu_name,
    });
  }
  if (systemCapabilities.has_cuda)
    opts.push({ value: "auto-cuda", label: "Auto (CUDA)" });
  if (systemCapabilities.has_rocm)
    opts.push({ value: "auto-rocm", label: "Auto (ROCm)" });
  if (systemCapabilities.has_vulkan)
    opts.push({ value: "auto-vulkan", label: "Auto (Vulkan)" });
  if (systemCapabilities.has_metal)
    opts.push({ value: "auto-metal", label: "Auto (Metal)" });
  opts.push({ value: "cpu", label: "CPU" });
  return opts;
}
