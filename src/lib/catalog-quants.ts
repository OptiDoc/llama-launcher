/**
 * Quantization options catalog.
 */

export interface HFQuants {
  id: string;
  label: string;
  sizeFactor: number;
  note: string;
  bits: number;
}

export const HF_QUANTS: HFQuants[] = [
  { id: "Q4_0", label: "Q4_0 · 4-bit", sizeFactor: 0.55, note: "Most compressed. Good for limited VRAM.", bits: 4 },
  { id: "Q4_K_M", label: "Q4_K_M · 4-bit", sizeFactor: 0.62, note: "Recommended default for most users.", bits: 4 },
  { id: "Q5_K_M", label: "Q5_K_M · 5-bit", sizeFactor: 0.72, note: "Better quality, ~15% more memory.", bits: 5 },
  { id: "Q6_K", label: "Q6_K · 6-bit", sizeFactor: 0.82, note: "Close to fp16 quality.", bits: 6 },
  { id: "Q8_0", label: "Q8_0 · 8-bit", sizeFactor: 0.95, note: "Nearly indistinguishable from fp16.", bits: 8 },
  { id: "F16", label: "F16 · 16-bit", sizeFactor: 1.0, note: "Full precision. Largest size.", bits: 16 },
];
