/**
 * HF download dialog helpers.
 */

function deriveModelName(repo: string): string {
  const slug = repo.split("/")[1] ?? repo;
  const base = slug
    .replace(/[-_]GGUF$/i, "")
    .replace(/[-_]Instruct$/i, "")
    .replace(/[_-]/g, " ")
    .trim();
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

export { deriveModelName };
