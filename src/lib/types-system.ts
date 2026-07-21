/**
 * System types — SystemSnapshot, GpuInfo, SystemCapabilities.
 */

export type GpuVendor = "nvidia" | "amd" | "intel" | "apple" | "other";

export interface SystemSnapshot {
  cpu_percent: number;
  cpu_name: string;
  cpu_cores_physical: number;
  cpu_cores_logical: number;
  memory_total_mb: number;
  memory_used_mb: number;
  memory_available_mb: number;
  disk_total_gb: number;
  disk_used_gb: number;
  disk_free_gb: number;
  os_name: string;
  os_version: string;
}

export interface GpuInfo {
  index: number;
  name: string;
  vendor: GpuVendor;
  memory_total_mb: number;
  memory_used_mb: number;
  memory_free_mb: number;
  temperature_c: number | null;
  utilization_percent: number | null;
  compute_capability: string | null;
  driver_version: string | null;
}

export interface SystemCapabilities {
  gpu_name: string;
  gpu_vram_gb: number;
  gpu_vendor: string;
  ram_gb: number;
  cpu_name: string;
  cpu_cores: number;
  has_cuda: boolean;
  has_vulkan: boolean;
  has_metal: boolean;
  has_rocm: boolean;
  disk_free_gb: number;
  os_name: string;
}

// Aliases for camelCase access
export type SystemCapabilitiesCamel = {
  gpuName: string;
  gpuVramGb: number;
  gpuVendor: string;
  ramGb: number;
  cpuName: string;
  cpuCores: number;
  hasCuda: boolean;
  hasVulkan: boolean;
  hasMetal: boolean;
  hasRocm: boolean;
  diskFreeGb: number;
  osName: string;
};

// SystemCapabilities is already exported above

export interface MetricSample {
  t: number;
  cpu: number;
  ram: number;
  gpu: number;
  tps: number;
  reqPerMin: number;
  gpuMem?: number;
}

export type AppStatus = "active" | "hibernating" | "hibernated" | "idle" | "waking";
