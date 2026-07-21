/**
 * Model family inference.
 */

export function inferFamily(name: string, arch: string): string {
  const n = name.toLowerCase();
  if (n.includes("llama-3") || n.includes("llama3")) return "llama3";
  if (n.includes("llama-2") || n.includes("llama2")) return "llama2";
  if (n.includes("qwen")) return "qwen2";
  if (n.includes("mistral") || n.includes("codestral")) return "mistral";
  if (n.includes("mixtral")) return "mixtral";
  if (n.includes("gemma")) return "gemma2";
  if (n.includes("phi")) return "phi3";
  if (n.includes("deepseek")) return "deepseek";
  if (n.includes("starcoder")) return "starcoder";
  if (n.includes("code")) return "codellama";
  return arch;
}
