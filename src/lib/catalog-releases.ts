/**
 * Release variant catalog.
 */

import type { ReleaseVariant } from "./types-release";

export const RELEASE_VARIANTS: { id: ReleaseVariant; label: string; priority: boolean; note: string }[] = [
  { id: "cuda12", label: "CUDA 12.x", priority: true, note: "NVIDIA GPU (cuBLAS, recommended)" },
  { id: "cuda13", label: "CUDA 13.x", priority: true, note: "NVIDIA GPU (newest CUDA toolkit)" },
  { id: "vulkan", label: "Vulkan", priority: true, note: "Cross-vendor GPU (AMD/Intel/NVIDIA)" },
  { id: "cpu", label: "CPU", priority: false, note: "No GPU acceleration" },
  { id: "hip", label: "HIP / ROCm", priority: false, note: "AMD GPU (Linux)" },
  { id: "opencl", label: "OpenCL", priority: false, note: "OpenCL GPU backend" },
  { id: "metal", label: "Metal", priority: false, note: "Apple Silicon (macOS)" },
];
